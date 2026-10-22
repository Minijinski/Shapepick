import type { Brand } from '@choose/catalog'
import { type Fact, Facts } from '../facts'
import { get } from '../http'
import type { ShopifyImage, ShopifyProduct } from '../shopify'
import type { Candidate, PriceIndex, Source } from '../source'
import type { SwitchResolver } from '../switches'
import { slugify } from '../text'
import { type GenericModel, type Listing, mapListings } from './generic'

// Official brand sites (Logitech, Corsair, Razer…) are not Shopify, but every product page carries
// the same things in its own structure: a name, variants (colour, layout, switch, SKU, euro price,
// stock), photos and a spec sheet. An adapter reads a page into an OfficialProduct, with its facts
// already worded the way the generic mapper reads them ("Connectivity: 2.4 GHz receiver,
// Bluetooth, up to 3 devices"); this module turns it into a listing, so the rules that turn specs
// into our schema (size, connectivity, prices, switches…) are the same for every source.

export type Picture = { src: string; width?: number; height?: number }

export type OfficialVariant = {
  sku?: string
  color?: string
  layout?: string
  switchName?: string
  /** Today's price in euros. */
  price?: number
  /** The regular price, when the site shows a promotion. */
  regularPrice?: number
  available: boolean
  image?: Picture
}

export type OfficialProduct = {
  url: string
  name: string
  facts: Fact[]
  /** Description and feature text, for keyword checks. */
  text: string
  /** Words the mapper looks for: "75%", "2.4ghz", "bluetooth", "optical", "low profile"… */
  tags: string[]
  variants: OfficialVariant[]
  images: Picture[]
}

export type OfficialModel = {
  brand: Brand
  name: string
  slug: string
  releaseYear?: number
  products: OfficialProduct[]
}

const picture = (img: Picture, id: number): ShopifyImage => ({
  id,
  src: img.src,
  width: img.width ?? 0,
  height: img.height ?? 0,
  position: id,
  variant_ids: [],
})

function toListing(p: OfficialProduct, brand: Brand): Listing {
  const values = (pick: (v: OfficialVariant) => string | undefined) => [
    ...new Set(p.variants.map(pick).filter((x): x is string => !!x)),
  ]
  const product: ShopifyProduct = {
    id: 0,
    title: `${brand.name} ${p.name}`,
    handle: slugify(p.name),
    body_html: '',
    created_at: '',
    vendor: brand.name,
    product_type: 'Keyboard',
    tags: p.tags,
    options: [
      { name: 'Color', position: 1, values: values((v) => v.color) },
      { name: 'Layout', position: 2, values: values((v) => v.layout) },
      { name: 'Switch', position: 3, values: values((v) => v.switchName) },
    ],
    variants: p.variants.map((v, i) => ({
      id: i,
      title: '',
      option1: v.color ?? null,
      option2: v.layout ?? null,
      option3: v.switchName ?? null,
      sku: v.sku ?? null,
      price: String(v.price ?? v.regularPrice ?? 0),
      compare_at_price: v.regularPrice ? String(v.regularPrice) : null,
      available: v.available,
      featured_image: v.image ? picture(v.image, 1000 + i) : null,
    })),
    images: p.images.map(picture),
  }
  return {
    product,
    facts: new Facts(p.facts),
    text: p.text,
    origin: new URL(p.url).origin,
    url: p.url,
  }
}

export const mapOfficial = (model: OfficialModel, resolver: SwitchResolver) => {
  const generic: GenericModel = {
    brand: model.brand.slug,
    brandName: model.brand.name,
    name: model.name,
    slug: model.slug,
    releaseYear: model.releaseYear,
    listings: model.products.map((p) => toListing(p, model.brand)),
  }
  return mapListings(generic, resolver, { toEur: (eur) => eur, currency: 'EUR' })
}

// ─── Page helpers ────────────────────────────────────────────────────────────────────────────────

/** Every JSON-LD object of a page, @graph entries included. */
export function jsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const m of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const data = JSON.parse(m[1] ?? '') as unknown
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || typeof item !== 'object') continue
        const graph = (item as { '@graph'?: unknown[] })['@graph']
        if (Array.isArray(graph)) out.push(...(graph as Record<string, unknown>[]))
        else out.push(item as Record<string, unknown>)
      }
    } catch {}
  }
  return out
}

/** The JSON of a <script id="…" type="application/json"> tag (__NEXT_DATA__, ng-state…). */
export function scriptJson(html: string, id: string): unknown {
  const m = new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`).exec(html)
  if (!m?.[1]) return undefined
  try {
    return JSON.parse(m[1])
  } catch {
    return undefined
  }
}

/** "1,000Hz", "8 000 Hz", "0.934" kg… → plain numbers the mapper reads. */
export const plainNumber = (s: string) =>
  s.replace(/(\d)[\s  ](?=\d{3}\b)/g, '$1').replace(/(\d),(?=\d{3}\b)/g, '$1')

export const fact = (label: string, value: string | number | undefined): Fact[] =>
  value === undefined || value === '' ? [] : [{ label, value: plainNumber(String(value)) }]

// ─── Source ──────────────────────────────────────────────────────────────────────────────────────

/** A Source over an official site: models listed by the adapter, prices re-read page by page. */
export function officialSource(opts: {
  host: string
  label: string
  intro: (brand: Brand) => string[]
  models: () => Promise<OfficialModel[]>
  read: (url: string, html: string) => OfficialProduct | undefined
}): Source {
  return {
    host: opts.host,
    label: opts.label,
    intro: opts.intro,
    candidates: async (): Promise<Candidate[]> =>
      (await opts.models()).map((m) => ({
        slug: m.slug,
        brand: m.brand,
        map: (resolver) => mapOfficial(m, resolver),
      })),
    // The weekly refresh re-reads the pages the entries came from.
    priceIndex: async (urls) => {
      const index: PriceIndex = new Map()
      for (const url of urls) {
        const p = opts.read(url, await get(url))
        for (const v of p?.variants ?? []) {
          const eur = Math.max(v.price ?? 0, v.regularPrice ?? 0)
          if (v.sku && eur) index.set(v.sku, { eur })
        }
      }
      return index
    },
  }
}
