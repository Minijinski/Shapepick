import type { Brand, MouseRecord } from '@choose/catalog'
import { type Fact, Facts, linesOf, parseHtml } from '../../facts'
import { EUR_PER_USD } from '../../prices'
import { listPrice, listProducts, optionsOf, productPage, type ShopifyProduct } from '../../shopify'
import type { MouseSource, PriceIndex } from '../../source'
import { slugify } from '../../text'
import {
  type MouseModel,
  type MousePicture,
  type MouseVariant,
  mapMouse,
  type OfficialMouse,
  TOP,
} from './official'

// Mouse makers' Shopify stores, whose catalogues the keyboards already read (sources/stores.ts).
// The store's public JSON lists every product with its variants, dollar prices and photos; the
// spec sheet is the description's "Label: value" list (HyperX: no page to read) or the product
// page's accordion, "<h6>Sensor</h6><ul><li>…</li></ul>" (Turtle Beach). Both are US stores: euros
// are estimated like the keyboards' (× EUR_PER_USD). Products out of stock everywhere, which the
// stores keep listing once discontinued (the ROCCAT range, Pulsefire Core), are left out.

type Shape = MouseRecord['specs']['shape']

type Store = {
  id: string
  origin: string
  brand: Brand
  isMouse: (p: ShopifyProduct) => boolean
  /** The model's name from the store's title. */
  nameOf: (title: string) => string
  /** Where the sheet is: the feed's description, or the product page. */
  sheet: 'feed' | 'page'
  /** The ranges' shapes, for the sheets that name none. */
  shapes?: [RegExp, Shape][]
}

const STORES: Store[] = [
  {
    id: 'hyperx-mice',
    origin: 'https://hyperx.com',
    brand: { slug: 'hyperx', name: 'HyperX' },
    isMouse: (p) => /^gaming mice$/i.test(p.product_type),
    // "HyperX Pulsefire Haste 2 – Wireless Gaming Mouse" → "Pulsefire Haste 2 Wireless": the
    // title's tail tells the wired and wireless models apart.
    nameOf: (title) =>
      title
        .replace(/^HyperX\s+/i, '')
        .replace(/\s+[–—-]\s+/, ' ')
        .replace(/\b(RGB\s+)?Gaming Mouse\b/i, '')
        .replace(/\s+/g, ' ')
        .trim(),
    sheet: 'feed',
    // The Saga's sheet says "Modular", its shell is asymmetrical.
    shapes: [[/saga/i, 'ergonomic']],
  },
  {
    id: 'turtlebeach-mice',
    origin: 'https://turtlebeach.com',
    brand: { slug: 'turtle-beach', name: 'Turtle Beach' },
    isMouse: (p) => /^mice$/i.test(p.product_type),
    nameOf: (title) =>
      title
        .replace(/^(Turtle Beach|ROCCAT)\s+/i, '')
        .replace(/\s+Mouse$/i, '')
        .trim(),
    sheet: 'page',
    // Pure Air and Pure SEL keep the Kone Pure's ergonomic shell, the right-handed Command Series
    // is 78 to 85 mm wide; the Burst's shell is symmetrical.
    shapes: [
      [/kone|pure|command series/i, 'ergonomic'],
      [/burst/i, 'symmetrical'],
    ],
  },
]

/** "Battery Specifications Battery Life: …": a section's heading glued to its first label. */
const HEADING = /^(mouse|battery|physical|cable|sensor|general)\s+specifications\s+/i

/** Each "<h6>Battery</h6><ul><li>…</li>…</ul>" group as one fact: "Battery: Rechargeable ; …". */
function groupFacts(html: string): Fact[] {
  return parseHtml(html)
    .querySelectorAll('main h6')
    .flatMap((h) => {
      const list = h.nextElementSibling
      if (list?.tagName !== 'UL') return []
      const value = list
        .querySelectorAll('li')
        .map((li) => li.text.trim())
        .filter(Boolean)
        .join(' ; ')
      return value ? [{ label: h.text.trim(), value }] : []
    })
}

const GRAMS = { lb: 453.592, lbs: 453.592, oz: 28.3495, g: 1 } as Record<string, number>

/**
 * The weight of a sheet that gives it in pounds or ounces ("Mouse only: 0.14 lb; With alkaline
 * battery: 0.16 lb", "2.43 oz / 0.15 lb"), in grams: with its battery for a mouse that takes one,
 * else without cable. Pounds have two decimals (± 2 g): the copy's exact grams ("weighs just 51g")
 * win when they agree.
 */
function weightOf(value: string, text: string, notes: string[]): number | undefined {
  const parts = value.split(/;|\.\s/)
  const part =
    parts.find((p) => /batter/i.test(p)) ??
    parts.find((p) => /without cable|mouse only/i.test(p)) ??
    parts[0] ??
    ''
  const m = /(\d*\.?\d+)\s*(lbs?|oz|g)\b/i.exec(part)
  if (!m?.[1] || !m[2]) return undefined
  const sheet = Number(m[1]) * (GRAMS[m[2].toLowerCase()] ?? 1)
  if (/^g$/i.test(m[2])) return sheet
  for (const c of text.matchAll(
    /(?:weigh\w*|lightweight|light)[^.\d]{0,30}?(\d{2,3}(?:\.\d)?)\s?(?:g|grams?)\b/gi,
  )) {
    if (/less than|under|below/i.test(c[0])) continue
    const said = Number(c[1])
    if (Math.abs(said - sheet) <= 6) return said
  }
  notes.push(`poids converti de ${m[1]} ${m[2]} : ${Math.round(sheet)} g à 2 g près`)
  return Math.round(sheet)
}

/** Photos, the views from above first; infographics and packaging left out. */
function picturesOf(p: ShopifyProduct): MousePicture[] {
  const rank = (src: string) => (/top[-_ ]?(down|view)/i.test(src) ? 0 : 1)
  return p.images
    .filter((i) => !/annotated|infographic|comparison|lifestyle|banner|package/i.test(i.src))
    .sort((a, b) => rank(a.src) - rank(b.src) || a.position - b.position)
    .slice(0, 8)
    .map((i) => ({ src: i.src.split('?')[0] ?? i.src, width: i.width, height: i.height }))
}

function officialOf(store: Store, p: ShopifyProduct, name: string, page?: string): OfficialMouse {
  const notes: string[] = []
  const html = page ?? p.body_html
  const scope = page ? 'main' : undefined
  const root = parseHtml(html)
  const text = linesOf((scope && root.querySelector(scope)) || root).join('\n')
  const facts = [
    ...Facts.fromHtml(html, scope).list.map((f) => ({ ...f, label: f.label.replace(HEADING, '') })),
    ...(page ? groupFacts(page) : []),
  ].flatMap((f) => {
    if (!/^weight$/i.test(f.label)) return [f]
    const grams = weightOf(f.value, text, notes)
    return grams ? [{ label: 'Poids', value: `${grams} g` }] : []
  })
  const toEur = (usd: string | null) => (Number(usd) || 0) * EUR_PER_USD || undefined
  const variants: MouseVariant[] = p.variants
    .filter((v) => v.available)
    .map((v) => {
      const options = optionsOf(p, v)
      return {
        sku: v.sku ?? undefined,
        color: options.Color ?? options.Colour ?? (/default/i.test(v.title) ? undefined : v.title),
        price: toEur(v.price),
        regularPrice: toEur(v.compare_at_price),
        available: true,
      }
    })
  return {
    url: `${store.origin}/products/${p.handle}`,
    name,
    modelNumber: variants[0]?.sku,
    facts: [...new Map(facts.map((f) => [`${f.label}|${f.value}`, f])).values()],
    text,
    hints: { segment: 'gaming', shape: store.shapes?.find(([re]) => re.test(name))?.[1] },
    variants,
    images: picturesOf(p),
    notes,
  }
}

async function models(store: Store): Promise<MouseModel[]> {
  const out: MouseModel[] = []
  for (const p of await listProducts(store.origin)) {
    if (!store.isMouse(p) || !p.variants.some((v) => v.available)) continue
    const name = store.nameOf(p.title)
    out.push({
      brand: store.brand,
      slug: slugify(`${store.brand.name} ${name}`),
      // The page is read only for the models a batch takes.
      read: async () =>
        officialOf(
          store,
          p,
          name,
          store.sheet === 'page' ? await productPage(store.origin, p.handle) : undefined,
        ),
    })
  }
  return out.slice(0, TOP)
}

function storeSource(store: Store): MouseSource {
  const host = new URL(store.origin).host
  return {
    category: 'mouse',
    host,
    label: `${host} (prix € estimés depuis les prix US)`,
    intro: (brand) => [
      `# ${brand.name} : souris importées de ${host} par \`pnpm ingest ${store.id}\`.`,
      `# Prix € estimés (prix US × ${EUR_PER_USD}).`,
    ],
    candidates: async () =>
      (await models(store)).map((model) => ({
        slug: model.slug,
        brand: model.brand,
        map: async () => mapMouse(model, await model.read()),
      })),
    // The weekly refresh prices every SKU from the store's JSON, as the keyboards' does.
    priceIndex: async () => {
      const index: PriceIndex = new Map()
      for (const p of await listProducts(store.origin)) {
        for (const v of p.variants) {
          if (v.sku) index.set(v.sku, { usd: listPrice(v), eur: listPrice(v) * EUR_PER_USD })
        }
      }
      return index
    },
  }
}

export const sources = Object.fromEntries(STORES.map((s) => [s.id, storeSource(s)]))
