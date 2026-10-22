import type { Brand, KeyboardInput } from '@choose/catalog'
import { Facts, linesOf, parseHtml } from '../facts'
import { EUR_PER_USD } from '../prices'
import { listPrice, listProducts, productPage } from '../shopify'
import type { Source } from '../source'
import type { SwitchResolver } from '../switches'
import { slugify } from '../text'
import { type GenericModel, type Listing, mapListings, nameOf, SIZE_LABEL, sizeOf } from './generic'

// mechanicalkeyboards.com, a US shop carrying ~60 brands (Ducky, Varmilo, Leopold, Vortex, Filco,
// Realforce, HHKB, Wooting…), one listing per colourway. Each page has a "Characteristics" sheet
// (Series, Size, Key Count, materials, Interface, Hotswap, Backlighting, Max Polling Rate…).
// - Listings of the same brand, series and size are one model; colourways and switches are its
//   variants. Only listings with something in stock count, and no kits, barebones, macro pads,
//   limited runs or shop collaborations.
// - Prices are in dollars, without VAT: euros are estimated (× EUR_PER_USD), then the usual policy.
// - Keychron and Lemokey come from keychron.com, which also has euro prices and AZERTY.

const MK = 'https://mechanicalkeyboards.com'
const SKIP_VENDORS = new Set(['Keychron', 'Lemokey', 'Gateron', 'WLMOUSE'])
const EXCLUDE =
  /\bkit\b|barebones?|pcb module|macro pad|numpad|\blimited\b|year of the|anniversary|\bmk x\b|\bx mk\b|\bx\s+\w+\s+(collab|edition)\b|\bcase\b/i

type Specs = KeyboardInput['specs']
export type Model = GenericModel

/** Brand names as the shop spells them, tidied: "Glorious PC" → Glorious. */
const BRAND_NAMES: Record<string, string> = {
  'Glorious PC': 'Glorious',
  'KBtalking (KBT)': 'KBtalking',
  MK: 'MechanicalKeyboards',
  LUMINKEY: 'Luminkey',
  WOBKEY: 'Wobkey',
  PMOKEY: 'Pmokey',
}
export const brandOf = (vendor: string): Brand => {
  const name = BRAND_NAMES[vendor] ?? vendor
  return { slug: slugify(name), name }
}

// ─── Models ──────────────────────────────────────────────────────────────────────────────────────

export async function loadModels(): Promise<Model[]> {
  const models = new Map<string, Model>()
  for (const product of await listProducts(MK, 'mechanical-keyboards')) {
    if (SKIP_VENDORS.has(product.vendor) || product.product_type === 'Numpad Keyboards') continue
    if (!product.variants.some((v) => v.available) || EXCLUDE.test(product.title)) continue
    const html = await productPage(MK, product.handle)
    const facts = Facts.fromHtml(html, 'main')
    if (/^yes/i.test(facts.first(/^barebones$/) ?? '')) continue
    const { name } = nameOf(product.title, product.vendor, facts.first(/^series$/))
    if (!name) continue
    const brand = brandOf(product.vendor)
    // One model per brand, name and size: "One 3" full-size and "One 3 TKL" are two keyboards.
    const size = sizeOf(facts, product) ?? 'full'
    const key = `${brand.slug}|${name.toLowerCase()}|${size}`
    const text = linesOf(parseHtml(product.body_html)).join('\n')
    const model = models.get(key) ?? {
      brand: brand.slug,
      brandName: brand.name,
      name,
      slug: '',
      listings: [],
    }
    model.listings.push({ product, facts, text, origin: MK })
    models.set(key, model)
  }
  // The slug only carries the size when two sizes share a name.
  const names = new Map<string, number>()
  for (const key of models.keys()) {
    const base = key.slice(0, key.lastIndexOf('|'))
    names.set(base, (names.get(base) ?? 0) + 1)
  }
  for (const [key, model] of models) {
    const size = key.slice(key.lastIndexOf('|') + 1) as Specs['formFactor']
    const shared = (names.get(key.slice(0, key.lastIndexOf('|'))) ?? 0) > 1
    if (shared && SIZE_LABEL[size]) model.name = `${model.name} ${SIZE_LABEL[size]}`
    model.slug = slugify(`${model.brandName} ${model.name}`)
  }
  return [...models.values()]
}

// ─── Mapping ─────────────────────────────────────────────────────────────────────────────────────

export const mapModel = (model: Model, resolver: SwitchResolver) =>
  mapListings(model, resolver, {
    colorway: (l: Listing) =>
      nameOf(l.product.title, l.product.vendor, l.facts.first(/^series$/)).colorway,
    toEur: (usd) => usd * EUR_PER_USD,
  })

/** Today's regular prices by SKU, in euros estimated from the dollar price. */
export async function priceIndex() {
  const index = new Map<string, { eur?: number; usd?: number }>()
  for (const p of await listProducts(MK, 'mechanical-keyboards')) {
    for (const v of p.variants) {
      if (v.sku) index.set(v.sku, { usd: listPrice(v), eur: listPrice(v) * EUR_PER_USD })
    }
  }
  return index
}

export const source: Source = {
  host: new URL(MK).host,
  label: 'mechanicalkeyboards.com (prix € estimés depuis les prix US)',
  intro: (brand) => [
    `# ${brand.name} : importés de mechanicalkeyboards.com par \`pnpm ingest mk\`.`,
    `# Boutique américaine : dispositions US seulement, prix € estimés (prix US × ${EUR_PER_USD}).`,
  ],
  candidates: async () =>
    (await loadModels()).map((m) => ({
      slug: m.slug,
      brand: { slug: m.brand, name: m.brandName },
      map: (resolver) => mapModel(m, resolver),
    })),
  priceIndex,
}
