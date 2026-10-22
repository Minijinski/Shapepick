import { fileURLToPath } from 'node:url'
import type { KeyboardInput, MonitorInput } from '@choose/catalog'
import { loadData } from '@choose/catalog/node'
import { eq, notInArray, sql } from 'drizzle-orm'
import { connectDirect } from './client'
import * as t from './schema'

// data/*.yaml → Postgres. Validated by Zod on the way in (loadData), upserted by slug, and the
// per-product children (translations, variants, specs) are replaced wholesale, so re-running the
// seed after editing a YAML file always converges on what the file says. That includes removals:
// products, switches and brands the files no longer list are deleted (offers go with products).

const dataDir = fileURLToPath(new URL('../../../data', import.meta.url))
// One interactive transaction: a TCP connection, not the site's HTTP driver.
const db = connectDirect()
const data = await loadData(dataDir)

const excluded = (columns: string[]) =>
  Object.fromEntries(
    columns.map((c) => [
      c,
      sql.raw(`excluded.${c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`),
    ]),
  )

await db.transaction(async (tx) => {
  const brandIds = new Map<string, number>()
  for (const brand of data.brands) {
    const [row] = await tx
      .insert(t.brands)
      .values(brand)
      .onConflictDoUpdate({ target: t.brands.slug, set: excluded(['name', 'country', 'website']) })
      .returning({ id: t.brands.id })
    if (row) brandIds.set(brand.slug, row.id)
  }

  const switchIds = new Map<string, number>()
  for (const sw of data.switches) {
    const { slug: _, ...rest } = sw
    const [row] = await tx
      .insert(t.switches)
      .values(sw)
      .onConflictDoUpdate({ target: t.switches.slug, set: excluded(Object.keys(rest)) })
      .returning({ id: t.switches.id })
    if (row) switchIds.set(sw.slug, row.id)
  }

  async function upsertProduct(p: KeyboardInput | MonitorInput, category: 'keyboard' | 'monitor') {
    const brandId = brandIds.get(p.brand)
    if (!brandId) throw new Error(`${p.slug}: unknown brand "${p.brand}"`)
    const values = {
      slug: p.slug,
      category,
      brandId,
      name: p.name,
      modelNumber: p.modelNumber,
      releaseYear: p.releaseYear,
      status: p.status,
      msrpEur: p.msrpEur,
      msrpUsd: p.msrpUsd,
      popularity: p.popularity,
      editorialScore: p.editorialScore,
    }
    const { slug: _, ...rest } = values
    const [row] = await tx
      .insert(t.products)
      .values(values)
      .onConflictDoUpdate({
        target: t.products.slug,
        set: { ...excluded(Object.keys(rest)), updatedAt: new Date() },
      })
      .returning({ id: t.products.id })
    if (!row) throw new Error(`${p.slug}: upsert returned nothing`)
    const productId = row.id

    await tx.delete(t.productTranslations).where(eq(t.productTranslations.productId, productId))
    for (const locale of ['fr', 'en'] as const) {
      if (!p.tagline && !p.description) continue
      await tx.insert(t.productTranslations).values({
        productId,
        locale,
        tagline: p.tagline?.[locale],
        description: p.description?.[locale],
      })
    }
    await tx.delete(t.productImages).where(eq(t.productImages.productId, productId))
    if (p.images?.length) {
      await tx.insert(t.productImages).values(
        p.images.map((img) => ({
          productId,
          url: img.url,
          kind: img.kind,
          width: img.width,
          height: img.height,
          isPrimary: img.primary ?? false,
        })),
      )
    }
    await tx.delete(t.productVariants).where(eq(t.productVariants.productId, productId))
    return productId
  }

  for (const k of data.keyboards) {
    const productId = await upsertProduct(k, 'keyboard')
    await tx.insert(t.productVariants).values(
      k.variants.map((v) => {
        const switchId = v.switch ? switchIds.get(v.switch) : undefined
        if (v.switch && !switchId) throw new Error(`${k.slug}: unknown switch "${v.switch}"`)
        return {
          productId,
          sku: v.sku,
          colorName: v.colorName,
          colorFamily: v.colorFamily,
          layout: v.layout,
          switchId,
          msrpEur: v.msrpEur,
        }
      }),
    )
    await tx.delete(t.keyboardSpecs).where(eq(t.keyboardSpecs.productId, productId))
    await tx.insert(t.keyboardSpecs).values({ productId, ...k.specs })
  }

  for (const m of data.monitors) {
    const productId = await upsertProduct(m, 'monitor')
    await tx.insert(t.productVariants).values(
      m.variants.map((v) => ({
        productId,
        sku: v.sku,
        colorName: v.colorName,
        colorFamily: v.colorFamily,
        msrpEur: v.msrpEur,
      })),
    )
    await tx.delete(t.monitorSpecs).where(eq(t.monitorSpecs.productId, productId))
    await tx.insert(t.monitorSpecs).values({ productId, ...m.specs })
  }

  // Children first: products cascade to their variants, so the switches they used can go next.
  const products = [...data.keyboards, ...data.monitors].map((p) => p.slug)
  // A seed run on a half-written data/ (an import in progress, a bad checkout) must not empty the
  // live catalogue: large removals need SEED_PRUNE=force, and the transaction rolls back otherwise.
  const doomed = await tx
    .select({ slug: t.products.slug })
    .from(t.products)
    .where(notInArray(t.products.slug, products))
  const [{ total } = { total: 0 }] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(t.products)
  if (doomed.length > Math.max(30, total / 2) && process.env.SEED_PRUNE !== 'force') {
    throw new Error(
      `Refusing to remove ${doomed.length} of ${total} products the files no longer list (set SEED_PRUNE=force to confirm).`,
    )
  }
  const gone = {
    products: await tx
      .delete(t.products)
      .where(notInArray(t.products.slug, products))
      .returning({ slug: t.products.slug }),
    switches: await tx
      .delete(t.switches)
      .where(
        notInArray(
          t.switches.slug,
          data.switches.map((s) => s.slug),
        ),
      )
      .returning({ slug: t.switches.slug }),
    brands: await tx
      .delete(t.brands)
      .where(
        notInArray(
          t.brands.slug,
          data.brands.map((b) => b.slug),
        ),
      )
      .returning({ slug: t.brands.slug }),
  }
  for (const [kind, rows] of Object.entries(gone)) {
    if (rows.length)
      console.info(`Removed ${rows.length} ${kind}: ${rows.map((r) => r.slug).join(', ')}`)
  }
})

console.info(
  `Seeded ${data.brands.length} brands, ${data.switches.length} switches, ${data.keyboards.length} keyboards, ${data.monitors.length} monitors.`,
)
await db.$client.end()
