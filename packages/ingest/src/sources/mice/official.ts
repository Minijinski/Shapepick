import type { Brand, MouseRecord, ProductImage } from '@choose/catalog'
import { type Fact, Facts } from '../../facts'
import { get } from '../../http'
import { familyOf } from '../../mapping'
import { type MouseHints, mouseSpecsOf } from '../../mouse-specs'
import { msrps } from '../../msrp'
import { median, priceVariants, roundPrice } from '../../prices'
import {
  type MouseCandidate,
  type MouseDraft,
  type MouseSource,
  type PriceIndex,
  Skip,
} from '../../source'

// Official mouse sites, whatever their structure: an adapter reads a product page into an
// OfficialMouse (name, spec sheet as label/value pairs with the labels its site uses in another
// sense renamed, the page's text, variants with their prices, photos the view from above first),
// and this module turns it into our schema with the rules every brand shares: specs
// (mouse-specs.ts), prices, photos. Same flow as the monitors (sources/monitors/official.ts).

/** Models kept per brand: at most 30, in the order the brand itself puts them forward. */
export const TOP = 30

export type MousePicture = { src: string; width?: number; height?: number }

export type MouseVariant = {
  sku?: string
  color?: string
  /** Today's price in euros at the brand's own shop. */
  price?: number
  /** The regular price, when the shop shows a promotion. */
  regularPrice?: number
  available: boolean
}

export type OfficialMouse = {
  url: string
  /** The model as the brand names it: "PRO X SUPERLIGHT 2", "DeathAdder V3 Pro". */
  name: string
  /** The commercial reference (910-006630, RZ01-04630100-R3G1), for a shop search. */
  modelNumber?: string
  gtins?: string[]
  releaseYear?: number
  facts: Fact[]
  /** Description and feature bullets: a free-spin wheel or silent clicks are often only there. */
  text: string
  /** What the listing says better than the page: the line (gaming, office), the shape. */
  hints?: Pick<MouseHints, 'segment' | 'shape' | 'hand'>
  variants: MouseVariant[]
  /** Photos, the view from above first when the site says which one it is. */
  images: MousePicture[]
  /** The prices of the resellers the brand's page lists, when it sells nothing itself. */
  resellerPrices?: number[]
  /** The price the brand's page states for a model its own shop does not sell. */
  standardPrice?: number
  /** What the adapter had to assume, for the review sheet. */
  notes?: string[]
}

export type MouseModel = {
  brand: Brand
  slug: string
  /** Fetches and reads the product page: only for the models a batch takes. */
  read: () => Promise<OfficialMouse>
}

/** The listed price of a variant: the struck-through price when the shop runs a promotion. */
const listed = (v: MouseVariant) => Math.max(v.price ?? 0, v.regularPrice ?? 0) || undefined

export async function mapMouse(model: MouseModel, m: OfficialMouse): Promise<MouseDraft> {
  const read = mouseSpecsOf(new Facts(m.facts), { name: m.name, text: m.text, ...m.hints })
  const { specs } = read
  const notes = [...(m.notes ?? []), ...read.notes]
  type Variant = MouseRecord['variants'] extends (infer V)[] | undefined ? V : never
  // One variant per colour: a size, a report rate or a cable makes another product (the adapter
  // splits those), so what is left differs by its finish only.
  const byColor = new Map<string, Variant>()
  for (const v of m.variants) {
    const colorName = v.color?.trim() || 'Noir'
    const variant: Variant = {
      sku: v.sku,
      colorName,
      colorFamily: familyOf(colorName),
      msrpEur: listed(v),
    }
    const prev = byColor.get(colorName)
    if (!prev || (!prev.msrpEur && variant.msrpEur)) byColor.set(colorName, variant)
  }
  if (!byColor.size)
    byColor.set('Noir', { sku: m.modelNumber, colorName: 'Noir', colorFamily: 'black' })
  const priced = priceVariants([...byColor.values()])

  // Where the price comes from: the brand's shop, else its resellers, else its recommended price.
  const sources = [m.url]
  let msrpEur = priced.msrpEur
  let priceFrom: MouseDraft['priceFrom'] = 'shop'
  if (!msrpEur && m.resellerPrices?.length) {
    msrpEur = roundPrice(median(m.resellerPrices))
    priceFrom = 'resellers'
  }
  if (!msrpEur && m.standardPrice) {
    msrpEur = roundPrice(m.standardPrice)
    priceFrom = 'msrp'
  }
  if (!msrpEur) {
    const msrp = (await msrps()).get(model.slug)
    if (msrp) {
      msrpEur = roundPrice(msrp.eur)
      sources.push(msrp.source)
      priceFrom = 'msrp'
    }
  }
  if (!msrpEur) throw new Skip('sans prix')

  const images: ProductImage[] = []
  for (const img of m.images) {
    if (images.some((i) => i.url === img.src)) continue
    images.push({
      url: img.src,
      kind: 'cutout_top',
      width: img.width || undefined,
      height: img.height || undefined,
    })
  }
  const [first] = images
  if (first) first.primary = true

  const input: MouseRecord = {
    slug: model.slug,
    brand: model.brand.slug,
    name: m.name,
    modelNumber: m.modelNumber,
    releaseYear: m.releaseYear,
    status: 'active',
    msrpEur,
    popularity: 0.5,
    editorialScore: 0.5,
    images: images.slice(0, 8),
    sources,
    gtins: m.gtins?.length ? [...new Set(m.gtins)] : undefined,
    specs,
    variants: priced.variants,
  }
  return { input, notes: [...new Set(notes)], priceFrom }
}

/** A MouseSource over an official site: models listed by the adapter, prices re-read page by page. */
export function mouseSource(opts: {
  host: string
  label: string
  intro: (brand: Brand) => string[]
  models: () => Promise<MouseModel[]>
  /** Reads a product page already fetched, for the weekly price refresh. */
  read: (url: string, html: string) => OfficialMouse | undefined
}): MouseSource {
  return {
    category: 'mouse',
    host: opts.host,
    label: opts.label,
    intro: opts.intro,
    candidates: async (): Promise<MouseCandidate[]> =>
      (await opts.models()).map((model) => ({
        slug: model.slug,
        brand: model.brand,
        map: async () => mapMouse(model, await model.read()),
      })),
    priceIndex: async (urls) => {
      const index: PriceIndex = new Map()
      for (const url of urls) {
        const m = opts.read(url, await get(url))
        if (!m) continue
        for (const v of m.variants) {
          const eur = listed(v)
          if (v.sku && eur) index.set(v.sku, { eur })
        }
        const brandPrice = m.resellerPrices?.length ? median(m.resellerPrices) : m.standardPrice
        if (!m.variants.some(listed) && brandPrice && m.modelNumber) {
          index.set(m.modelNumber, { eur: brandPrice })
        }
      }
      return index
    },
  }
}
