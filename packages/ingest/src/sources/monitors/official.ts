import type { Brand, MonitorInput, ProductImage } from '@choose/catalog'
import { type Fact, Facts } from '../../facts'
import { get } from '../../http'
import { familyOf } from '../../mapping'
import { monitorSpecsOf } from '../../monitor-specs'
import { msrps } from '../../msrp'
import { priceVariants, roundPrice } from '../../prices'
import {
  type MonitorCandidate,
  type MonitorDraft,
  type MonitorSource,
  type PriceIndex,
  Skip,
} from '../../source'

// Official monitor sites, whatever their structure: an adapter reads a product page into an
// OfficialMonitor (name, reference, spec sheet as label/value pairs with the ambiguous labels
// renamed, variants with their prices, photos front view first), and this module turns it into
// our schema with the rules every brand shares: specs (monitor-specs.ts), prices, photos.

/**
 * Models kept per brand: its 50 most relevant (the user's choice, 23 October 2026), in the order
 * the brand itself puts forward (best sellers, its recommended sort, its reviews).
 */
export const TOP = 50

export type MonitorPicture = { src: string; width?: number; height?: number }

export type MonitorVariant = {
  sku?: string
  color?: string
  /** Today's price in euros at the brand's own shop. */
  price?: number
  /** The regular price, when the shop shows a promotion. */
  regularPrice?: number
  available: boolean
}

export type OfficialMonitor = {
  url: string
  /** The model as the brand names it: "Odyssey OLED G6 G60SF 27"", "UltraGear 27GX790A". */
  name: string
  /** The commercial reference (LS27FG602SUXEN, 27GX790A-B, AW2725DF). */
  modelNumber?: string
  gtins?: string[]
  releaseYear?: number
  facts: Fact[]
  /** Description and feature bullets, for the few things a sheet leaves to them (KVM, HDR level). */
  text: string
  /** Colours on sale, each with its SKU and price; none when the brand sells nothing itself. */
  variants: MonitorVariant[]
  /** Photos, the straight front view first when the site says which one it is. */
  images: MonitorPicture[]
  /** The prices of the resellers the brand's page lists, when it sells nothing itself (AOC). */
  resellerPrices?: number[]
  /** The price the brand's page states for a model its own shop does not sell (BenQ). */
  standardPrice?: number
  /** What the adapter had to assume, for the review sheet. */
  notes?: string[]
}

export type MonitorModel = {
  brand: Brand
  slug: string
  /** Fetches and reads the product page: only for the models a batch takes. */
  read: () => Promise<OfficialMonitor>
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2
}

/** The listed price of a variant: the struck-through price when the shop runs a promotion. */
const listed = (v: MonitorVariant) => Math.max(v.price ?? 0, v.regularPrice ?? 0) || undefined

export async function mapMonitor(model: MonitorModel, m: OfficialMonitor) {
  const read = monitorSpecsOf(new Facts(m.facts), { name: m.name, text: m.text })
  const { specs } = read
  const notes = [...(m.notes ?? []), ...read.notes]
  type Variant = MonitorInput['variants'][number]
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
  let priceFrom: MonitorDraft['priceFrom'] = 'shop'
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
      kind: 'cutout_front',
      width: img.width || undefined,
      height: img.height || undefined,
    })
  }
  const [first] = images
  if (first) first.primary = true

  const input: MonitorInput = {
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

/** A MonitorSource over an official site: models listed by the adapter, prices re-read page by page. */
export function monitorSource(opts: {
  host: string
  label: string
  intro: (brand: Brand) => string[]
  models: () => Promise<MonitorModel[]>
  /** Reads a product page already fetched, for the weekly price refresh. */
  read: (url: string, html: string) => OfficialMonitor | undefined
}): MonitorSource {
  return {
    category: 'monitor',
    host: opts.host,
    label: opts.label,
    intro: opts.intro,
    candidates: async (): Promise<MonitorCandidate[]> =>
      (await opts.models()).map((model) => ({
        slug: model.slug,
        brand: model.brand,
        map: async () => mapMonitor(model, await model.read()),
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
        // A brand that sells nothing itself: its resellers' median, or the price its page
        // states, stands for every variant.
        const brandPrice = m.resellerPrices?.length ? median(m.resellerPrices) : m.standardPrice
        if (!m.variants.some(listed) && brandPrice && m.modelNumber) {
          index.set(m.modelNumber, { eur: brandPrice })
        }
      }
      return index
    },
  }
}

// ─── Page helpers ────────────────────────────────────────────────────────────────────────────────

/**
 * The data a Next.js App Router page streams in its `self.__next_f.push([1, "…"])` scripts, joined
 * into one string (LG and AOC keep their product there).
 */
export function nextFlight(html: string): string {
  let out = ''
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      out += JSON.parse(`"${m[1] ?? ''}"`) as string
    } catch {}
  }
  return out
}

/** The JSON value (object or array) that starts at `start` in `text`, brackets balanced. */
export function jsonAt<T>(text: string, start: number): T | undefined {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === '{' || c === '[') depth++
    else if ((c === '}' || c === ']') && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1)) as T
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

/** The JSON value of the first `"key":` in `text`. */
export function jsonAfter<T>(text: string, key: string): T | undefined {
  const at = text.indexOf(`"${key}":`)
  return at < 0 ? undefined : jsonAt<T>(text, at + key.length + 3)
}
