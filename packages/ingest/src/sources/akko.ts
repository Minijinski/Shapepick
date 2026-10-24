import type { KeyboardInput } from '@choose/catalog'
import { type Fact, Facts, linesOf, parseHtml } from '../facts'
import { get, getJson } from '../http'
import { EUR_PER_USD } from '../prices'
import type { ShopifyProduct } from '../shopify'
import type { PriceIndex, Source } from '../source'
import { slugify } from '../text'
import { type GenericModel, type Listing, mapListings } from './generic'

// Akko, from its international store (en.akkogear.com, WooCommerce, prices in US dollars: euros
// estimated like the other US stores'). The store's public API (wc/store/v1/products) lists every
// product with its regular price, stock and Switch options; a keyboard is sold as one product per
// colourway ("Glacier 5098 V5", "Black & Gold 3108v3"), gathered here into one model per number,
// its colourways as variants. A product page carries the sheet (.ak-specs2-row: Structure,
// Connection, Battery Capacity, Polling Rate, Materials, Keycap Profile, Product Weight,
// Dimensions; on the HE pages, a table comparing it with its TMR twin), a card per switch (Type,
// Operating Force, Travel), copied into data/switches.yaml by hand, and its variations as JSON
// (colour, switch, regular price, photo). A variation that changes the board ("Wired - Akko
// Hakutaku Magnetic" beside "Wireless - …", "1KHz (…)" beside "8KHz (…)") is another product: only
// the wireless, 8 kHz ones are kept.
// Licensed editions (Sanrio, anime, games), anniversary and world-tour editions, kits and blind
// boxes are left out, and so are the models whose page gives no sheet in text (TAC87, TAC75 HE,
// 3108 v3, 5098B: pictures only) or whose variations change the board (MOD007 V5 HE: plates,
// weights, links).

const ORIGIN = 'https://en.akkogear.com'
const BRAND = { slug: 'akko', name: 'Akko', website: 'https://en.akkogear.com' }

/** The models kept, by the number their products' names end in, and their size. */
const MODELS: [RegExp, string, string][] = [
  [/\b5075 V5 HE\b/i, '5075 V5 HE', '75%'],
  [/\b5087 V5 HE\b/i, '5087 V5 HE', '80%'],
  [/\b5075 V5 TMR\b/i, '5075 V5 TMR', '75%'],
  [/\b5087 V5 TMR\b/i, '5087 V5 TMR', '80%'],
  [/\b5075 V5\b/i, '5075 V5', '75%'],
  [/\b5087 V5\b/i, '5087 V5', '80%'],
  [/\b5098 V5\b/i, '5098 V5', '96%'],
  [/\b5108 V5\b/i, '5108 V5', '100%'],
]

/** Licensed and limited editions, kits. */
const EDITION =
  /hello kitty|kuromi|my melody|cinnamoroll|keroppi|pompompurin|pochacco|gudetama|sanrio|lord of the mysteries|legend of hei|miku|spy x family|yier and bubu|lulu liu|king.s avatar|joy of life|sailor moon|honkai|naraka|taiko|tokidoki|spongebob|dora(emon|mi)|nezuko|tanjirou|world tour|anniversary|year of the|blind box|barebone|\bkit\b|bundle|team blue rain|degenerate|cabbage dog|chicago|los angeles/i

type StoreProduct = {
  id: number
  name: string
  permalink: string
  is_in_stock: boolean
  categories?: { name: string }[]
  prices: { regular_price: string; price: string; currency_minor_unit: number }
  attributes?: { name: string; terms: { name: string }[] }[]
  images?: { src: string }[]
}

/** "Black&#038;Gold 5098 V5" → Black&Gold 5098 V5. */
const decode = (s: string) => parseHtml(s).text.replace(/\s+/g, ' ').trim()

async function listed(): Promise<StoreProduct[]> {
  const all: StoreProduct[] = []
  for (let page = 1; page < 20; page++) {
    const list = await getJson<StoreProduct[]>(
      `${ORIGIN}/wp-json/wc/store/v1/products?per_page=100&page=${page}`,
    )
    all.push(...list)
    if (list.length < 100) break
  }
  return all
}

const dollars = (cents: string, unit: number) => Number(cents) / 10 ** unit

/**
 * The sheet of a product page: its .ak-specs2-row label/value pairs, else the column of the
 * comparison table headed by the model ("Specification | 5075 V5 HE | 5075 V5 TMR").
 */
function sheetOf(html: string, model: string): Fact[] {
  const root = parseHtml(html)
  const rows = root.querySelectorAll('.ak-specs2-row').flatMap((row) => {
    const label = row.querySelector('.spec-label')?.text.replace(/:\s*$/, '').trim()
    const value = row.querySelector('.spec-value')?.text.replace(/\s+/g, ' ').trim()
    return label && value ? [{ label, value }] : []
  })
  if (rows.length) return rows
  for (const table of root.querySelectorAll('table')) {
    const lines = table
      .querySelectorAll('tr')
      .map((tr) => tr.querySelectorAll('th, td').map((c) => c.text.replace(/\s+/g, ' ').trim()))
    const column = lines.find((cells) => cells.includes(model))?.indexOf(model) ?? -1
    if (column < 1) continue
    // "LED: South- and North-Facing ARGB" is the backlight.
    return lines.flatMap((cells) => {
      const [label, value] = [cells[0], cells[column]]
      if (!label || !value || value === model) return []
      return [{ label: /^led$/i.test(label) ? 'Backlight' : label, value }]
    })
  }
  return []
}

type Variation = {
  attributes: Record<string, string>
  display_regular_price?: number
  display_price?: number
  image?: { src?: string; full_src?: string }
}

/** The page's variations: colour, switch or link, regular price, photo. */
function variationsOf(html: string): Variation[] {
  const raw = /data-product_variations="([^"]*)"/.exec(html)?.[1]
  if (!raw) return []
  try {
    return JSON.parse(parseHtml(`<i>${raw}</i>`).text) as Variation[]
  } catch {
    return []
  }
}

/** The one switch a page's cards describe ("Linear | Akko Prism Magnetic Switch | Initial Force"). */
const cardSwitch = (text: string) => {
  const names = [
    ...new Set(
      [
        ...text.matchAll(
          /^((?:Akko|Kailh|Gateron|TTC)\s[^\n]{2,40}?)\s*(?:Switch)?\n(?:Type|Initial Force|INITIAL FORCE|Operating Force)/gm,
        ),
      ].map((m) => m[1]?.trim() ?? ''),
    ),
  ]
  return names.length === 1 ? names[0] : undefined
}

/** "Glacier 5098 V5" → Glacier, "TAC75 HE White" → White: the colourway a product's name gives. */
const colorwayOf = (name: string, model: string) =>
  name.replace(new RegExp(`\\s*${model.replace(/\s/g, '\\s?')}\\s*`, 'i'), ' ').trim()

/** The colour a variation names, after its product's theme when the name gives one ("Greedy Bear Pink SP"). */
const colourOf = (v: Variation, colorway: string) =>
  [colorway, v.attributes.attribute_color].filter(Boolean).join(' ') || 'Default'

/** "Akko V3 Piano Pro", "Wireless - Akko Prism Magnetic", "8KHz (Akko Creamy Yellow U1)" → the switch. */
const switchOf = (v: Variation) =>
  v.attributes.attribute_switch ||
  v.attributes.attribute_connection?.replace(/^(wired|wireless)\s*-\s*/i, '') ||
  /\(([^)]+)\)/.exec(v.attributes.attribute_model ?? '')?.[1] ||
  undefined

/** "8KHz (Akko Creamy Yellow U1)" → 8: a version's polling rate, when the variations differ by it. */
const khzOf = (v: Variation) =>
  Number(/^(\d+)\s*khz/i.exec(v.attributes.attribute_model ?? '')?.[1]) || undefined

/** A variant's SKU: the product's id, its colour and switch. */
const skuOf = (id: number, colour: string, sw: string | undefined) =>
  `${id}-${slugify(`${colour} ${sw ?? ''}`)}`

function listingOf(p: StoreProduct, model: string, size: string, html: string): Listing {
  const name = decode(p.name)
  const colorway = colorwayOf(name, model)
  const main = parseHtml(html)
  const text = linesOf(main.querySelector('main') ?? main).join('\n')
  const facts = sheetOf(html, model)
  const single = cardSwitch(text)
  if (single && !facts.some((f) => /^switch/i.test(f.label)))
    facts.push({ label: 'Switches', value: single })
  const fallback = dollars(p.prices.regular_price || p.prices.price, p.prices.currency_minor_unit)
  // A wired version beside wireless ones is another board: only the wireless ones stay. So is a
  // 1 kHz version beside an 8 kHz one ("1KHz (Akko V3 Piano Pro)"): the model's other colourways
  // are the 8 kHz board, only that one stays.
  const all = variationsOf(html)
  const wireless = all.some((v) => /^wireless/i.test(v.attributes.attribute_connection ?? ''))
  const fastest = Math.max(0, ...all.map((v) => khzOf(v) ?? 0))
  const variations = all.filter(
    (v) =>
      !(wireless && /^wired/i.test(v.attributes.attribute_connection ?? '')) &&
      (khzOf(v) ?? fastest) === fastest,
  )
  const list = variations.length ? variations : [{ attributes: {} } as Variation]
  const colour = (v: Variation) => colourOf(v, colorway)
  const photo = (v: Variation) =>
    v.image?.full_src || v.image?.src?.replace(/-\d+x\d+(?=\.\w+$)/, '')
  // One id per picture: a variation showing the product's own photo is not a second picture.
  const ids = new Map<string, number>()
  const idOf = (src: string) => ids.get(src) ?? ids.set(src, ids.size).size - 1
  const product: ShopifyProduct = {
    id: p.id,
    title: `Akko ${model}`,
    handle: slugify(name),
    body_html: '',
    created_at: '',
    vendor: 'Akko',
    product_type: 'Keyboard',
    tags: [size],
    options: [
      { name: 'Color', position: 1, values: [...new Set(list.map(colour))] },
      { name: 'Switch', position: 2, values: [...new Set(list.map((v) => switchOf(v) ?? ''))] },
    ],
    variants: list.map((v, i) => {
      const sw = switchOf(v)
      const src = photo(v)
      return {
        id: p.id * 100 + i,
        title: '',
        option1: colour(v),
        option2: sw ?? null,
        option3: null,
        sku: skuOf(p.id, colour(v), sw),
        price: String(v.display_regular_price || v.display_price || fallback),
        compare_at_price: null,
        available: true,
        featured_image: src
          ? { id: idOf(src), src, width: 0, height: 0, position: i + 1, variant_ids: [] }
          : null,
      }
    }),
    images: (p.images ?? []).map((img, i) => ({
      id: idOf(img.src),
      src: img.src,
      width: 0,
      height: 0,
      position: i + 1,
      variant_ids: [],
    })),
  }
  return {
    product,
    facts: new Facts(facts),
    text: text.slice(0, 6000),
    origin: ORIGIN,
    url: p.permalink,
  }
}

export const source: Source = {
  host: new URL(ORIGIN).host,
  label: 'en.akkogear.com (prix € estimés depuis les prix US)',
  intro: (brand) => [
    `# ${brand.name} : claviers importés de en.akkogear.com (boutique internationale, WooCommerce) par \`pnpm ingest akko\`.`,
    `# Prix € estimés (prix US × ${EUR_PER_USD}). Un produit par coloris chez Akko : ici une variante.`,
  ],
  candidates: async () => {
    const byModel = new Map<string, { size: string; products: StoreProduct[] }>()
    for (const p of await listed()) {
      const name = decode(p.name)
      if (!p.is_in_stock || EDITION.test(name)) continue
      if (!p.categories?.some((c) => /^keyboard$/i.test(c.name))) continue
      const found = MODELS.find(([re]) => re.test(name))
      if (!found) continue
      const [, model, size] = found
      const entry = byModel.get(model) ?? { size, products: [] }
      entry.products.push(p)
      byModel.set(model, entry)
    }
    return [...byModel].map(([model, { size, products }]) => ({
      slug: slugify(`akko ${model}`),
      brand: BRAND,
      map: async (resolver) => {
        const listings: Listing[] = []
        for (const p of products) listings.push(listingOf(p, model, size, await get(p.permalink)))
        const generic: GenericModel = {
          brand: BRAND.slug,
          brandName: BRAND.name,
          name: model,
          slug: slugify(`akko ${model}`),
          listings,
        }
        const draft = await mapListings(generic, resolver, {
          toEur: (usd) => usd * EUR_PER_USD,
        })
        // A US store: ANSI boards. The sheet's layout words would not say otherwise.
        const variants: KeyboardInput['variants'] = draft.input.variants.map((v) => ({
          ...v,
          layout: 'ansi_us',
        }))
        return { ...draft, input: { ...draft.input, variants } }
      },
    }))
  },
  // The weekly refresh re-reads the product pages the entries came from, every variation they list.
  priceIndex: async (urls) => {
    const index: PriceIndex = new Map()
    const products = new Map((await listed()).map((p) => [p.permalink, p]))
    for (const url of urls) {
      const p = products.get(url)
      const model = p && MODELS.find(([re]) => re.test(decode(p.name)))?.[1]
      if (!p || !model) continue
      const colorway = colorwayOf(decode(p.name), model)
      for (const v of variationsOf(await get(url))) {
        const usd = v.display_regular_price || v.display_price
        if (usd)
          index.set(skuOf(p.id, colourOf(v, colorway), switchOf(v)), {
            usd,
            eur: usd * EUR_PER_USD,
          })
      }
    }
    return index
  },
}
