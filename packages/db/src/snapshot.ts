import {
  type Brand,
  type Category,
  type ItemOf,
  keyboardInputSchema,
  monitorInputSchema,
  mouseInputSchema,
  type Switch,
  switchSchema,
  toKeyboardItems,
  toMonitorItems,
  toMouseItems,
} from '@choose/catalog'
import { and, eq, inArray, max } from 'drizzle-orm'
import type { Db } from './client'
import * as t from './schema'

// Database → the flat items the finder works on. Rows are turned back into the seed's input shape
// and run through the same Zod schemas and item builders as the YAML, so the browser can never
// receive something the engine was not written for.

/** Postgres returns null for empty columns; the domain schemas expect the key to be absent. */
const compact = <T extends Record<string, unknown>>(row: T) =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v != null)) as T

export type Snapshot<C extends Category> = {
  version: string
  /** When a product of the category last changed (ISO 8601), for the sitemap; null if never. */
  updatedAt: string | null
  items: ItemOf<C>[]
}

export async function loadSnapshot<C extends Category>(db: Db, category: C): Promise<Snapshot<C>> {
  // In the order products were first seeded (their ids): a reseed rewrites rows, which would
  // otherwise come back in whatever order Postgres stored the new versions.
  const products = await db
    .select({ product: t.products, brand: t.brands })
    .from(t.products)
    .innerJoin(t.brands, eq(t.products.brandId, t.brands.id))
    .where(and(eq(t.products.category, category), eq(t.products.status, 'active')))
    .orderBy(t.products.id)
  const ids = products.map((p) => p.product.id)
  const [stamp] = await db
    .select({ updated: max(t.products.updatedAt) })
    .from(t.products)
    .where(eq(t.products.category, category))
  const version = `${ids.length}-${stamp?.updated?.getTime() ?? 0}`
  const updatedAt = stamp?.updated?.toISOString() ?? null
  if (!ids.length) return { version, updatedAt, items: [] }

  const [translations, variants, images] = await Promise.all([
    db.select().from(t.productTranslations).where(inArray(t.productTranslations.productId, ids)),
    db
      .select({ variant: t.productVariants, switch: t.switches })
      .from(t.productVariants)
      .leftJoin(t.switches, eq(t.productVariants.switchId, t.switches.id))
      .where(inArray(t.productVariants.productId, ids))
      .orderBy(t.productVariants.id),
    // In the seed's order, which the ids follow.
    db
      .select()
      .from(t.productImages)
      .where(inArray(t.productImages.productId, ids))
      .orderBy(t.productImages.id),
  ])

  const brands = new Map<string, Brand>()
  const switches = new Map<string, Switch>()
  const base = products.map(({ product, brand }) => {
    brands.set(
      brand.slug,
      compact({
        slug: brand.slug,
        name: brand.name,
        country: brand.country,
        website: brand.website,
      }) as Brand,
    )
    const own = translations.filter((tr) => tr.productId === product.id)
    const localized = (field: 'tagline' | 'description') => {
      const fr = own.find((tr) => tr.locale === 'fr')?.[field]
      const en = own.find((tr) => tr.locale === 'en')?.[field]
      return fr || en ? { fr: fr ?? en ?? '', en: en ?? fr ?? '' } : undefined
    }
    const ownImages = images
      .filter((img) => img.productId === product.id)
      .map((img) =>
        compact({
          url: img.url,
          kind: img.kind,
          width: img.width,
          height: img.height,
          primary: img.isPrimary,
        }),
      )
    return {
      id: product.id,
      input: compact({
        slug: product.slug,
        brand: brand.slug,
        name: product.name,
        modelNumber: product.modelNumber,
        releaseYear: product.releaseYear,
        status: product.status,
        msrpEur: product.msrpEur,
        msrpUsd: product.msrpUsd,
        popularity: product.popularity,
        editorialScore: product.editorialScore,
        amazonAsin: product.amazonAsin,
        tagline: localized('tagline'),
        description: localized('description'),
        images: ownImages.length ? ownImages : undefined,
      }),
      variants: variants
        .filter((v) => v.variant.productId === product.id)
        .map(({ variant, switch: sw }) => {
          if (sw) {
            const { id: _, ...rest } = sw
            switches.set(sw.slug, switchSchema.parse(compact(rest)))
          }
          return compact({
            sku: variant.sku,
            colorName: variant.colorName,
            colorFamily: variant.colorFamily,
            layout: variant.layout,
            switch: sw?.slug,
            msrpEur: variant.msrpEur,
          })
        }),
    }
  })

  const specsOf = <S extends { productId: number }>(rows: S[]) =>
    new Map(rows.map((r) => [r.productId, r]))
  const strip = <S extends { productId: number; extra: unknown }>({
    productId: _,
    extra: __,
    ...rest
  }: S) => compact(rest)

  const kind: Category = category
  switch (kind) {
    case 'keyboard': {
      const specs = specsOf(
        await db.select().from(t.keyboardSpecs).where(inArray(t.keyboardSpecs.productId, ids)),
      )
      const inputs = base.flatMap((p) => {
        const row = specs.get(p.id)
        return row
          ? [keyboardInputSchema.parse({ ...p.input, specs: strip(row), variants: p.variants })]
          : []
      })
      return {
        version,
        updatedAt,
        items: toKeyboardItems(inputs, [...brands.values()], [...switches.values()]) as ItemOf<C>[],
      }
    }
    case 'monitor': {
      const specs = specsOf(
        await db.select().from(t.monitorSpecs).where(inArray(t.monitorSpecs.productId, ids)),
      )
      const inputs = base.flatMap((p) => {
        const row = specs.get(p.id)
        if (!row) return []
        const { ppi: _, ...rest } = strip(row)
        return [monitorInputSchema.parse({ ...p.input, specs: rest, variants: p.variants })]
      })
      return {
        version,
        updatedAt,
        items: toMonitorItems(inputs, [...brands.values()]) as ItemOf<C>[],
      }
    }
    case 'mouse': {
      const specs = specsOf(
        await db.select().from(t.mouseSpecs).where(inArray(t.mouseSpecs.productId, ids)),
      )
      const inputs = base.flatMap((p) => {
        const row = specs.get(p.id)
        return row
          ? [mouseInputSchema.parse({ ...p.input, specs: strip(row), variants: p.variants })]
          : []
      })
      return {
        version,
        updatedAt,
        items: toMouseItems(inputs, [...brands.values()]) as ItemOf<C>[],
      }
    }
    default: {
      const unknown: never = kind
      throw new Error(`No snapshot for category "${unknown}"`)
    }
  }
}
