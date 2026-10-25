import { type CatalogItem, type Category, categories, isLocale, type Locale } from '@choose/catalog'
import { createServerFn } from '@tanstack/react-start'
import {
  LISTED,
  livingCollections,
  membersOf,
  neighboursOf,
  rankingOf,
} from '~/features/catalogue/collections'
import { type SpecCell, specCells } from '~/features/product/specs'
import { countsOf, shownCategories } from './catalog'

// What the catalogue's pages show, worked out on the server from the category's catalogue: its
// index (every product, by brand) and its collections (the products a few answers keep, ranked).
// They send the page's lines only, never the catalogue: a page of text, light to load, which the
// server renders whole.

/** A product as the catalogue's lists print it. */
export type CatalogueRow = {
  slug: string
  brand: string
  name: string
  /** Its main specs in a line: "75 % · Magnétique · Sans fil". */
  line: string
  /** What sets it apart beside them: "AZERTY", "21:9", "Gaucher". */
  tags: string[]
  priceEur: number
}

/** The catalogue's index: every product of the category, brand by brand, A to Z. */
export type IndexPage = {
  shown: Category[]
  failed: boolean
  total: number
  brands: { slug: string; name: string; rows: CatalogueRow[] }[]
  /** The category's collections, with how many products each holds. */
  collections: { id: string; size: number }[]
  prices: [number, number]
}

/** A collection's page: its products in the order the finder ranks them. */
export type CollectionPage = {
  shown: Category[]
  failed: boolean
  total: number
  brands: number
  prices: [number, number]
  /** The first three, whole, for their pictures. */
  podium: CatalogItem[]
  /**
   * The products listed (LISTED at most), ranked, the first three included: their specs in the
   * results' columns too.
   */
  rows: (CatalogueRow & { cells: SpecCell[] })[]
  neighbours: { id: string; size: number }[]
}

type Input = { category: Category; locale: Locale }

const valid = (input: Input) => {
  if (!categories.includes(input.category) || !isLocale(input.locale)) throw new Error('Bad input')
  return input
}

/**
 * A product's line: the values of the results' columns, then the qualifiers worth a tag (a
 * keyboard sold in AZERTY or low, a monitor wider than 16:10 or curved, a mouse that is not for
 * the right hand alone).
 */
function rowOf(item: CatalogItem, locale: Locale): CatalogueRow & { cells: SpecCell[] } {
  const cells = specCells(item, locale)
  const [first] = cells
  const details = first?.details ?? []
  const tags =
    item.category === 'keyboard'
      ? details
      : item.category === 'monitor'
        ? details.filter((d, i) => (i === 0 ? !d.startsWith('16:') : item.specs.curvatureR != null))
        : item.specs.hand === 'right' && item.specs.shape !== 'trackball'
          ? []
          : details
  return {
    slug: item.slug,
    brand: item.brand.name,
    name: item.name,
    line: cells
      .map((cell) => cell.value)
      .filter(Boolean)
      .join(' · '),
    tags,
    cells,
    priceEur: item.priceEur,
  }
}

/** The index needs no columns. */
const indexRowOf = (item: CatalogItem, locale: Locale): CatalogueRow => {
  const { cells: _, ...row } = rowOf(item, locale)
  return row
}

const priceRange = (items: CatalogItem[]): [number, number] => {
  const prices = items.map((item) => item.priceEur)
  return prices.length ? [Math.min(...prices), Math.max(...prices)] : [0, 0]
}

const byName = (locale: Locale) => {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  return (a: string, b: string) => collator.compare(a, b)
}

/**
 * The category's catalogue, and the categories the site offers (for the header). Straight from
 * the snapshots, kept a minute per server process: the same list from one request to the next,
 * so each collection is ranked once per snapshot (collections.ts). A category that fails to load
 * is left out; the page's own failing, there is no page.
 */
async function catalogueOf(category: Category) {
  const { snapshotOf } = await import('./snapshot.server')
  const failed: Category[] = []
  const entries = await Promise.all(
    categories.map(async (c) => {
      try {
        return [c, (await snapshotOf(c)).items as CatalogItem[]] as const
      } catch (error) {
        const cause = error instanceof Error ? (error.cause ?? error) : error
        console.error(
          `The ${c} catalogue failed to load:`,
          cause instanceof Error ? cause.message : cause,
        )
        failed.push(c)
        return [c, [] as CatalogItem[]] as const
      }
    }),
  )
  if (failed.includes(category)) throw new Error(`The ${category} catalogue is unavailable`)
  const catalogs = Object.fromEntries(entries) as Record<Category, CatalogItem[]>
  return {
    items: catalogs[category],
    shown: shownCategories(countsOf(catalogs)),
    failed: failed.length > 0,
  }
}

export const getCatalogueIndex = createServerFn({ method: 'GET' })
  .validator(valid)
  .handler(async ({ data: { category, locale } }): Promise<IndexPage> => {
    const { items, shown, failed } = await catalogueOf(category)
    const compare = byName(locale)
    const brands = new Map<string, IndexPage['brands'][number]>()
    for (const item of items) {
      const brand = brands.get(item.brand.slug)
      const row = indexRowOf(item, locale)
      if (brand) brand.rows.push(row)
      else
        brands.set(item.brand.slug, { slug: item.brand.slug, name: item.brand.name, rows: [row] })
    }
    const sorted = [...brands.values()].sort((a, b) => compare(a.name, b.name))
    for (const brand of sorted) brand.rows.sort((a, b) => compare(a.name, b.name))
    return {
      shown,
      failed,
      total: items.length,
      brands: sorted,
      collections: livingCollections(category, items).map((c) => ({
        id: c.id,
        size: membersOf(c, items).length,
      })),
      prices: priceRange(items),
    }
  })

export const getCollectionPage = createServerFn({ method: 'GET' })
  .validator((input: Input & { id: string }) => ({ ...valid(input), id: String(input.id) }))
  .handler(async ({ data: { category, locale, id } }): Promise<CollectionPage | null> => {
    const { items, shown, failed } = await catalogueOf(category)
    const living = livingCollections(category, items)
    const collection = living.find((c) => c.id === id)
    // Too few products for a page (or none at all, the catalogue failing): no page.
    if (!collection) return null
    const ranked = rankingOf(collection, items)
    const members = ranked.map((r) => r.item)
    return {
      shown,
      failed,
      total: ranked.length,
      brands: new Set(members.map((item) => item.brand.slug)).size,
      prices: priceRange(members),
      podium: members.slice(0, 3),
      rows: members.slice(0, LISTED).map((item) => rowOf(item, locale)),
      neighbours: neighboursOf(collection, living).map((c) => ({
        id: c.id,
        size: membersOf(c, items).length,
      })),
    }
  })
