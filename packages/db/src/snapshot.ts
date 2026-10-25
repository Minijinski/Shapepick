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
import { and, count, eq, inArray, max, sql } from 'drizzle-orm'
import type { Db } from './client'
import * as t from './schema'

// Database → the flat items the finder works on. Rows are turned back into the seed's input shape
// and run through the same Zod schemas and item builders as the YAML, so the browser can never
// receive something the engine was not written for. The rows come from the tables themselves, or,
// in one query, from the copy the seed keeps of them (`catalog_snapshots`): the items are built
// from either with the code deployed, so a change to that code shows without a new seed.

/** Postgres returns null for empty columns; the domain schemas expect the key to be absent. */
const compact = <T extends Record<string, unknown>>(row: T) =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v != null)) as T

export type Snapshot<C extends Category> = {
  version: string
  /** When a product of the category last changed (ISO 8601), for the sitemap; null if never. */
  updatedAt: string | null
  items: ItemOf<C>[]
}

type SpecRow = { productId: number; extra?: unknown } & Record<string, unknown>

/** What a category's items are built from: its rows, as the tables give them. */
export type SnapshotRows = {
  products: { product: typeof t.products.$inferSelect; brand: typeof t.brands.$inferSelect }[]
  translations: (typeof t.productTranslations.$inferSelect)[]
  variants: {
    variant: typeof t.productVariants.$inferSelect
    switch: typeof t.switches.$inferSelect | null
  }[]
  images: (typeof t.productImages.$inferSelect)[]
  specs: SpecRow[]
}

const specTables = {
  keyboard: t.keyboardSpecs,
  monitor: t.monitorSpecs,
  mouse: t.mouseSpecs,
} as const

/** A category's version: its active products, and when one of its products last changed. */
async function versionOf(db: Db, category: Category) {
  const [stamp] = await db
    .select({
      active: count(sql`case when ${t.products.status} = 'active' then 1 end`),
      updated: max(t.products.updatedAt),
    })
    .from(t.products)
    .where(eq(t.products.category, category))
  return {
    version: `${stamp?.active ?? 0}-${stamp?.updated?.getTime() ?? 0}`,
    updatedAt: stamp?.updated?.toISOString() ?? null,
  }
}

/** A category's rows, read from the tables themselves. */
export async function fetchSnapshotRows(db: Db, category: Category) {
  // In the order products were first seeded (their ids): a reseed rewrites rows, which would
  // otherwise come back in whatever order Postgres stored the new versions.
  const [products, stamp] = await Promise.all([
    db
      .select({ product: t.products, brand: t.brands })
      .from(t.products)
      .innerJoin(t.brands, eq(t.products.brandId, t.brands.id))
      .where(and(eq(t.products.category, category), eq(t.products.status, 'active')))
      .orderBy(t.products.id),
    versionOf(db, category),
  ])
  const ids = products.map((p) => p.product.id)
  const rows: SnapshotRows = { products, translations: [], variants: [], images: [], specs: [] }
  if (!ids.length) return { ...stamp, rows }
  const specs = specTables[category]
  const [translations, variants, images, specRows] = await Promise.all([
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
    db.select().from(specs).where(inArray(specs.productId, ids)),
  ])
  return {
    ...stamp,
    rows: { products, translations, variants, images, specs: specRows as SpecRow[] },
  }
}

/** A category's items, built from its rows with the code deployed. */
export function buildItems<C extends Category>(category: C, rows: SnapshotRows): ItemOf<C>[] {
  const { products, translations, variants, images } = rows
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

  const specs = new Map(rows.specs.map((r) => [r.productId, r]))
  const strip = ({ productId: _, extra: __, ...rest }: SpecRow) => compact(rest)

  const kind: Category = category
  switch (kind) {
    case 'keyboard': {
      const inputs = base.flatMap((p) => {
        const row = specs.get(p.id)
        return row
          ? [keyboardInputSchema.parse({ ...p.input, specs: strip(row), variants: p.variants })]
          : []
      })
      return toKeyboardItems(inputs, [...brands.values()], [...switches.values()]) as ItemOf<C>[]
    }
    case 'monitor': {
      const inputs = base.flatMap((p) => {
        const row = specs.get(p.id)
        if (!row) return []
        const { ppi: _, ...rest } = strip(row)
        return [monitorInputSchema.parse({ ...p.input, specs: rest, variants: p.variants })]
      })
      return toMonitorItems(inputs, [...brands.values()]) as ItemOf<C>[]
    }
    case 'mouse': {
      const inputs = base.flatMap((p) => {
        const row = specs.get(p.id)
        return row
          ? [mouseInputSchema.parse({ ...p.input, specs: strip(row), variants: p.variants })]
          : []
      })
      return toMouseItems(inputs, [...brands.values()]) as ItemOf<C>[]
    }
    default: {
      const unknown: never = kind
      throw new Error(`No snapshot for category "${unknown}"`)
    }
  }
}

/** A category's catalogue, read from the tables themselves (four round trips). */
export async function loadSnapshot<C extends Category>(db: Db, category: C): Promise<Snapshot<C>> {
  const { version, updatedAt, rows } = await fetchSnapshotRows(db, category)
  return { version, updatedAt, items: buildItems(category, rows) }
}

/**
 * A category's catalogue as the site reads it: the seed's copy of its rows and the category's
 * version, asked for together (one round trip). The tables themselves when the copy is missing (its
 * migration not run yet, no seed since) or behind them (a product changed since the seed).
 */
export async function readSnapshot<C extends Category>(db: Db, category: C): Promise<Snapshot<C>> {
  const [stored, current] = await Promise.all([
    db
      .select({ version: t.catalogSnapshots.version, rows: t.catalogSnapshots.rows })
      .from(t.catalogSnapshots)
      .where(eq(t.catalogSnapshots.category, category))
      .then(
        ([row]) => row,
        () => undefined,
      ),
    versionOf(db, category),
  ])
  if (!stored || stored.version !== current.version) return loadSnapshot(db, category)
  return {
    version: current.version,
    updatedAt: current.updatedAt,
    items: buildItems(category, stored.rows as SnapshotRows),
  }
}

/** Keeps a copy of a category's rows for the site (the seed, inside its transaction). */
export async function storeSnapshot(db: Db, category: Category) {
  const { version, updatedAt, rows } = await fetchSnapshotRows(db, category)
  await db
    .insert(t.catalogSnapshots)
    .values({ category, version, updatedAt: updatedAt ? new Date(updatedAt) : null, rows })
    .onConflictDoUpdate({
      target: t.catalogSnapshots.category,
      set: {
        version,
        updatedAt: updatedAt ? new Date(updatedAt) : null,
        rows,
        writtenAt: new Date(),
      },
    })
}
