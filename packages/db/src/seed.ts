import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  type Category,
  categories,
  type KeyboardInput,
  type MonitorInput,
  type MouseInput,
} from '@choose/catalog'
import { loadData } from '@choose/catalog/node'
import { inArray, notInArray, sql } from 'drizzle-orm'
import { connectDirect, type Db } from './client'
import * as t from './schema'
import { storeSnapshot } from './snapshot'

// data/*.yaml → Postgres. Validated by Zod on the way in (loadData), upserted by slug, and the
// per-product children (translations, variants, specs) are replaced wholesale, so re-running the
// seed after editing a YAML file always converges on what the file says. That includes removals:
// products, switches and brands the files no longer list are deleted (offers go with products).

// SEED_DATA_DIR: another data folder, to rehearse a seed (a checkout without some category…).
const dataDir =
  process.env.SEED_DATA_DIR ?? fileURLToPath(new URL('../../../data', import.meta.url))
// One interactive transaction: a TCP connection, not the site's HTTP driver.
const db = connectDirect()
const data = await loadData(dataDir)

// One seed at a time. Two at once each write the whole catalogue and the last to commit wins for
// every row (two started a minute apart on 2026-10-25): the second one stops before writing. The
// lock belongs to this connection and goes with it. The seed names itself in pg_stat_activity
// (`seed:<commit>`) and says which database and which commit's files it writes.
const SEED_LOCK = 7_302_025
const commit = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
})()
const target = new URL(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '')
console.info(`Seeding ${target.hostname}${target.pathname} from ${commit} (${dataDir}).`)
await db.execute(sql`select set_config('application_name', ${`seed:${commit}`}, false)`)
const [lock] = await db.execute<{ locked: boolean }>(
  sql`select pg_try_advisory_lock(${SEED_LOCK}) as locked`,
)
if (!lock?.locked) {
  console.error(
    'Another seed is running on this database (application_name seed:* in pg_stat_activity): stopped, nothing written.',
  )
  await db.$client.end()
  process.exit(1)
}

const excluded = (columns: string[]) =>
  Object.fromEntries(
    columns.map((c) => [
      c,
      sql.raw(`excluded.${c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`),
    ]),
  )

/** Rows per INSERT: a few hundred, well under the 65 535 parameters of Postgres' widest statement. */
const CHUNK = 500
const chunked = <T>(rows: T[]): T[][] =>
  Array.from({ length: Math.ceil(rows.length / CHUNK) }, (_, i) =>
    rows.slice(i * CHUNK, (i + 1) * CHUNK),
  )

// Each table is written in a few statements of many rows, not a statement per row: the seed ran
// ~9 000 queries one after the other, 8 to 14 minutes from this Mac to Frankfurt, long enough for a
// dropped connection to roll it all back. Rows go in in the files' order, which the ids follow (a
// product's images and variants are read back in that order).
await db.transaction(async (tx) => {
  const brandIds = new Map<string, number>()
  for (const rows of chunked(data.brands)) {
    const written = await tx
      .insert(t.brands)
      .values(rows)
      .onConflictDoUpdate({ target: t.brands.slug, set: excluded(['name', 'country', 'website']) })
      .returning({ id: t.brands.id, slug: t.brands.slug })
    for (const row of written) brandIds.set(row.slug, row.id)
  }

  // Every column a switch can have, so that one left out of its file is emptied, not kept.
  const switchColumns = [
    ...new Set(data.switches.flatMap(({ slug: _, ...rest }) => Object.keys(rest))),
  ]
  const switchIds = new Map<string, number>()
  for (const rows of chunked(data.switches)) {
    const written = await tx
      .insert(t.switches)
      .values(rows)
      .onConflictDoUpdate({ target: t.switches.slug, set: excluded(switchColumns) })
      .returning({ id: t.switches.id, slug: t.switches.slug })
    for (const row of written) switchIds.set(row.slug, row.id)
  }

  const listed: { p: KeyboardInput | MonitorInput | MouseInput; category: Category }[] = [
    ...data.keyboards.map((p) => ({ p, category: 'keyboard' as const })),
    ...data.monitors.map((p) => ({ p, category: 'monitor' as const })),
    ...data.mice.map((p) => ({ p, category: 'mouse' as const })),
  ]
  const productRows = listed.map(({ p, category }) => {
    const brandId = brandIds.get(p.brand)
    if (!brandId) throw new Error(`${p.slug}: unknown brand "${p.brand}"`)
    return {
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
      amazonAsin: p.amazonAsin ?? null,
    }
  })
  const { slug: _slug, ...productColumns } = productRows[0] ?? { slug: '' }
  const productIds = new Map<string, number>()
  for (const rows of chunked(productRows)) {
    const written = await tx
      .insert(t.products)
      .values(rows)
      .onConflictDoUpdate({
        target: t.products.slug,
        set: { ...excluded(Object.keys(productColumns)), updatedAt: new Date() },
      })
      .returning({ id: t.products.id, slug: t.products.slug })
    for (const row of written) productIds.set(row.slug, row.id)
  }
  const idOf = (slug: string) => {
    const id = productIds.get(slug)
    if (id == null) throw new Error(`${slug}: upsert returned nothing`)
    return id
  }

  // Their children are replaced wholesale: what the files say now, nothing left of before.
  const ids = [...productIds.values()]
  for (const table of [
    t.productTranslations,
    t.productImages,
    t.productVariants,
    t.keyboardSpecs,
    t.monitorSpecs,
    t.mouseSpecs,
  ]) {
    for (const part of chunked(ids)) await tx.delete(table).where(inArray(table.productId, part))
  }

  const insertAll = async <R>(
    table:
      | typeof t.productTranslations
      | typeof t.productImages
      | typeof t.productVariants
      | typeof t.keyboardSpecs
      | typeof t.monitorSpecs
      | typeof t.mouseSpecs,
    rows: R[],
  ) => {
    // biome-ignore lint/suspicious/noExplicitAny: each call passes rows of its own table
    for (const part of chunked(rows)) await tx.insert(table).values(part as any)
  }

  await insertAll(
    t.productTranslations,
    listed.flatMap(({ p }) =>
      p.tagline || p.description
        ? (['fr', 'en'] as const).map((locale) => ({
            productId: idOf(p.slug),
            locale,
            tagline: p.tagline?.[locale],
            description: p.description?.[locale],
          }))
        : [],
    ),
  )
  await insertAll(
    t.productImages,
    listed.flatMap(({ p }) =>
      (p.images ?? []).map((img) => ({
        productId: idOf(p.slug),
        url: img.url,
        kind: img.kind,
        width: img.width,
        height: img.height,
        isPrimary: img.primary ?? false,
      })),
    ),
  )
  await insertAll(t.productVariants, [
    ...data.keyboards.flatMap((k) =>
      k.variants.map((v) => {
        const switchId = v.switch ? switchIds.get(v.switch) : undefined
        if (v.switch && !switchId) throw new Error(`${k.slug}: unknown switch "${v.switch}"`)
        return {
          productId: idOf(k.slug),
          sku: v.sku,
          colorName: v.colorName,
          colorFamily: v.colorFamily,
          layout: v.layout,
          switchId,
          msrpEur: v.msrpEur,
        }
      }),
    ),
    ...[...data.monitors, ...data.mice].flatMap((m) =>
      m.variants.map((v) => ({
        productId: idOf(m.slug),
        sku: v.sku,
        colorName: v.colorName,
        colorFamily: v.colorFamily,
        msrpEur: v.msrpEur,
      })),
    ),
  ])
  await insertAll(
    t.keyboardSpecs,
    data.keyboards.map((k) => ({ productId: idOf(k.slug), ...k.specs })),
  )
  await insertAll(
    t.monitorSpecs,
    data.monitors.map((m) => ({ productId: idOf(m.slug), ...m.specs })),
  )
  await insertAll(
    t.mouseSpecs,
    data.mice.map((m) => ({ productId: idOf(m.slug), ...m.specs })),
  )

  // Children first: products cascade to their variants, so the switches they used can go next.
  const products = [...data.keyboards, ...data.monitors, ...data.mice].map((p) => p.slug)
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
  // The same, category by category: a checkout that predates a category (no data/mice) would
  // otherwise wipe it out, its products being few next to the whole catalogue.
  const perCategory = await tx
    .select({ category: t.products.category, total: sql<number>`count(*)::int` })
    .from(t.products)
    .groupBy(t.products.category)
  const leaving = await tx
    .select({ category: t.products.category, total: sql<number>`count(*)::int` })
    .from(t.products)
    .where(notInArray(t.products.slug, products))
    .groupBy(t.products.category)
  for (const { category, total: gone } of leaving) {
    const had = perCategory.find((c) => c.category === category)?.total ?? 0
    if (gone > Math.max(10, had / 2) && process.env.SEED_PRUNE !== 'force') {
      throw new Error(
        `Refusing to remove ${gone} of ${had} ${category} products the files no longer list (set SEED_PRUNE=force to confirm).`,
      )
    }
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

  // The site's copy of each category's rows, read in one query (src/snapshot.ts), written with the
  // rest so that it is never ahead of the tables or behind them. Left out while its table's
  // migration has not run: the site then reads the tables themselves.
  const [table] = await tx.execute<{ name: string | null }>(
    sql`select to_regclass('public.catalog_snapshots')::text as name`,
  )
  if (table?.name) {
    for (const category of categories) await storeSnapshot(tx as unknown as Db, category)
  } else {
    console.warn('catalog_snapshots is missing (pnpm db:migrate): the site reads the tables.')
  }
})

console.info(
  `Seeded ${data.brands.length} brands, ${data.switches.length} switches, ${data.keyboards.length} keyboards, ${data.monitors.length} monitors, ${data.mice.length} mice.`,
)
await db.$client.end()
