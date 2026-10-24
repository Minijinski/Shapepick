import type { Brand, MouseRecord } from '@choose/catalog'
import { type Fact, linesOf, parseHtml } from '../../facts'
import { get } from '../../http'
import type { MouseSource, PriceIndex } from '../../source'
import { slugify } from '../../text'
import { itemOf, large, variantOf } from '../corsair'
import { scriptJson } from '../official'
import { type MouseModel, type MouseVariant, mapMouse, type OfficialMouse } from './official'

// Corsair mice, from its French site (corsair.com/fr/fr), read like its keyboards (sources/
// corsair.ts): the product sitemap lists one URL per SKU, and a page's __NEXT_DATA__ holds the
// configurable product, every colour with its SKU, stock and euro prices, photos, and a tech sheet
// (battery, sensor, DPI, connectivity). That sheet gives no measurements, no button count, no
// report rate, and its weight is often the boxed one (152 g for a 97 g M65 RGB ULTRA): Corsair
// states those in its articles and product FAQs, transcribed below with the page each comes from.
// A model none of them measures is left out (M65 RGB ULTRA, KATAR ELITE, HARPOON RGB PRO,
// IRONCLAW RGB, SCIMITAR RGB ELITE). One page may sell several shells (the SABRE v3 PRO page lists
// all six): a model takes its SKUs wherever they are listed. A carbon-fibre shell shares its
// magnesium twin's size, and is its colour "Carbon"; licensed editions are left out.

const ORIGIN = 'https://www.corsair.com'
const BRAND: Brand = { slug: 'corsair', name: 'Corsair', website: 'https://www.corsair.com' }
const EDITION = /edition|call-of-duty|witcher|cyberpunk|doom|gumayusi|apple|-se-|revival/i

type Shape = MouseRecord['specs']['shape']
type Hand = MouseRecord['specs']['hand']

type Model = {
  name: string
  /** The model's SKUs, its own colours first; a carbon-fibre twin's SKUs become "Carbon". */
  skus: RegExp
  carbon?: RegExp
  /** Length × widest width × height (mm), weight (g), as `source` states them. */
  dims: [number, number, number]
  weight: number
  /** All the buttons, as `source` counts them (none for the SABRE: Corsair gives no count). */
  buttons?: number
  /** Counted on the official side views or the manual's list (forward, back, …). */
  sideButtons: number
  pollingHz: number
  shape: Shape
  hand: Hand
  /** Played wired too, over its charging cable, as `source` or the page says. */
  wired?: boolean
  /** Hours on 2.4 GHz at 1 000 Hz, lighting off, where the sheet mixes figures or gives none. */
  batteryHours?: number
  /** No lighting at all, as `source` says (the copy names RGB for the whole range). */
  unlit?: boolean
  /** A wheel that tilts left and right, as the manual lists it. */
  tilt?: boolean
  source: string
}

const ARTICLE = `${ORIGIN}/us/en/explorer/gamer/mice`
const SABRE_V3 = `${ARTICLE}/corsair-sabre-v3-pro-purevector-sabre-v3-pro-purevector-ergo-everything-you-need-to-know/`
const M75 = `${ARTICLE}/corsair-m75-vs-m75-air-whats-the-difference/`

const MODELS: Model[] = [
  {
    name: 'SABRE v3 PRO PureVector',
    skus: /^CH-931G40[01]-/,
    dims: [119.2, 62.5, 38.2],
    weight: 37,
    sideButtons: 2,
    pollingHz: 8000,
    shape: 'symmetrical',
    hand: 'right',
    wired: true,
    source: SABRE_V3,
  },
  {
    name: 'SABRE v3 PRO PureVector ERGO',
    skus: /^CH-931H00[01]-/,
    dims: [119, 64.5, 41],
    weight: 41,
    sideButtons: 2,
    pollingHz: 8000,
    shape: 'ergonomic',
    hand: 'right',
    wired: true,
    source: SABRE_V3,
  },
  {
    name: 'SABRE v3 PRO PureVector MG',
    skus: /^CH-931G50[01]-/,
    carbon: /^CH-931G600-/,
    dims: [122.9, 64.1, 38.8],
    weight: 49,
    sideButtons: 2,
    pollingHz: 8000,
    shape: 'symmetrical',
    hand: 'right',
    wired: true,
    source: SABRE_V3,
  },
  {
    name: 'SABRE v3 PRO PureVector MG ERGO',
    skus: /^CH-931H10[01]-/,
    carbon: /^CH-931H200-/,
    dims: [125, 67.5, 44],
    weight: 55,
    sideButtons: 2,
    pollingHz: 8000,
    shape: 'ergonomic',
    hand: 'right',
    wired: true,
    source: SABRE_V3,
  },
  {
    name: 'SABRE v2 PRO ULTRALIGHT WIRELESS',
    skus: /^CH-931G00[0167]-/,
    dims: [119.25, 62.55, 38.21],
    weight: 36,
    sideButtons: 2,
    pollingHz: 8000,
    shape: 'symmetrical',
    hand: 'right',
    wired: true,
    source: `${ORIGIN}/us/en/p/gaming-mouse/ch-931g000-ww/sabre-v2-pro-ultralight-wireless-gaming-mouse-ch-931g000-ww`,
  },
  {
    name: 'SABRE v2 PRO WIRELESS MG',
    skus: /^CH-931G10[01]-/,
    carbon: /^CH-931G200-/,
    dims: [122.85, 64.12, 38.83],
    weight: 56,
    sideButtons: 2,
    pollingHz: 8000,
    shape: 'symmetrical',
    hand: 'right',
    source: `${ORIGIN}/us/en/p/gaming-mouse/ch-931g100-ww/sabre-v2-pro-wireless-magnesium-alloy-gaming-mouse-black-ch-931g100-ww`,
  },
  {
    name: 'M75 AIR WIRELESS',
    skus: /^CH-931D10[0-2]-/,
    dims: [128, 65, 42],
    weight: 60,
    buttons: 5,
    sideButtons: 2,
    pollingHz: 1000,
    shape: 'symmetrical',
    hand: 'right',
    unlit: true,
    source: M75,
  },
  {
    name: 'M75 WIRELESS',
    skus: /^CH-931D01[01]-/,
    dims: [128, 65, 42],
    weight: 89,
    buttons: 7,
    sideButtons: 2,
    pollingHz: 1000,
    shape: 'symmetrical',
    hand: 'ambidextrous',
    source: `${ARTICLE}/corsair-m75-and-m75-wireless-everything-you-need-to-know/`,
  },
  {
    name: 'M75',
    skus: /^CH-930D010-/,
    dims: [128, 65, 42],
    weight: 74,
    buttons: 7,
    sideButtons: 2,
    pollingHz: 8000,
    shape: 'symmetrical',
    hand: 'ambidextrous',
    source: `${ARTICLE}/corsair-m75-and-m75-wireless-everything-you-need-to-know/`,
  },
  {
    name: 'NIGHTSABRE WIRELESS',
    skus: /^CH-931B011-/,
    dims: [129.41, 63, 40.41],
    weight: 99,
    buttons: 11,
    sideButtons: 2,
    pollingHz: 2000,
    shape: 'symmetrical',
    hand: 'right',
    wired: true,
    source: `${ARTICLE}/corsair-nightsabre-wireless-everything-you-need-to-know/`,
  },
  {
    name: 'DARKSTAR WIRELESS',
    skus: /^CH-931A011-/,
    dims: [129.05, 67.9, 43.64],
    weight: 96,
    buttons: 15,
    sideButtons: 6,
    pollingHz: 2000,
    shape: 'ergonomic',
    hand: 'right',
    wired: true,
    source: `${ARTICLE}/corsair-darkstar-wireless-everything-you-need-to-know/`,
  },
  {
    name: 'SCIMITAR ELITE WIRELESS',
    skus: /^CH-9314311-/,
    dims: [119.23, 73.48, 42.17],
    weight: 114,
    buttons: 16,
    sideButtons: 12,
    pollingHz: 2000,
    shape: 'ergonomic',
    hand: 'right',
    wired: true,
    batteryHours: 120,
    source: `${ARTICLE}/corsair-scimitar-elite-wireless-everything-you-need-to-know/`,
  },
  {
    name: 'NIGHTSWORD v2 WIRELESS',
    skus: /^CH-931E010-/,
    dims: [129.6, 78, 40.9],
    weight: 89,
    buttons: 11,
    sideButtons: 3,
    pollingHz: 8000,
    shape: 'ergonomic',
    hand: 'right',
    batteryHours: 170,
    tilt: true,
    source: `${ARTICLE}/corsair-nightsword-v2-wireless-sd-stream-deck-gaming-mouse-everything-you-need-to-know/`,
  },
  {
    name: 'HARPOON v2 WIRELESS',
    skus: /^CH-9311110-/,
    dims: [115.5, 68.3, 40.4],
    weight: 80,
    buttons: 6,
    sideButtons: 2,
    pollingHz: 1000,
    shape: 'ergonomic',
    hand: 'right',
    wired: true,
    source: `${ARTICLE}/harpoon-v2-wireless-everything-you-need-to-know/`,
  },
]

type Listed = { url: string; sku: string }

/**
 * The page's own copy, its Contentful sections (features, FAQ): where Corsair says how the mouse
 * connects and charges. HTML fragments and JSON-encoded entries alike, deduplicated; the entries'
 * internal titles ("iCUE UNITE YOUR SETUP | RGB | COMMON FOR ALL PRODUCTS", shared by every page)
 * and asset paths are no copy.
 */
function copyOf(html: string): string {
  const data = scriptJson(html, '__NEXT_DATA__') as
    | { props?: { pageProps?: { productDataContentful?: unknown } } }
    | undefined
  const out = new Set<string>()
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === 'object') Object.values(node).forEach(walk)
    else if (typeof node === 'string' && node.length > 30 && !/^https?:/.test(node)) {
      if (/^[[{]/.test(node.trim())) {
        try {
          walk(JSON.parse(node))
          return
        } catch {}
      }
      for (const line of linesOf(parseHtml(node)))
        if (line.length > 20 && !/\s\|\s|akamai\/|\.(png|jpe?g|webp|mp4)\b/i.test(line))
          out.add(line)
    }
  }
  walk(data?.props?.pageProps?.productDataContentful)
  return [...out].join('\n').slice(0, 8000)
}

async function listed(): Promise<Listed[]> {
  const xml = await get(`${ORIGIN}/fr-sitemap-products-1.xml`)
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => (m[1] ?? '').replace(/&amp;/g, '&'))
    .filter((u) => /\/fr\/fr\/p\/gaming-mouse\//.test(u) && !EDITION.test(u))
    .map((url) => ({
      url,
      sku: /\/p\/gaming-mouse\/([^/]+)\//.exec(url)?.[1]?.toUpperCase() ?? '',
    }))
}

/** The sheet worded for the mapper, from Corsair's tech specs and the model's measured figures. */
function factsOf(model: Model, specs: { code: string; value: string }[]): Fact[] {
  const keep = specs
    .filter((s) => /^(connectivity|battery life|sensor|dpi|grip type|hand size)$/i.test(s.code))
    .filter((s) => !(model.batteryHours && /battery/i.test(s.code)))
    .map((s) => ({ label: s.code, value: s.value.replace(/\|/g, ' ; ') }))
  const [l, w, h] = model.dims
  return [
    ...keep,
    ...(model.wired ? [{ label: 'Connexion', value: 'USB filaire (câble de charge)' }] : []),
    ...(model.unlit ? [{ label: 'Éclairage', value: 'Non' }] : []),
    ...(model.batteryHours
      ? [
          {
            label: 'Autonomie',
            value: `${model.batteryHours} h (2,4 GHz, 1 000 Hz, sans éclairage)`,
          },
        ]
      : []),
    { label: 'Dimensions (L x l x H)', value: `${l} x ${w} x ${h} mm` },
    { label: 'Poids', value: `${model.weight} g` },
    ...(model.buttons ? [{ label: 'Boutons', value: String(model.buttons) }] : []),
    ...(model.tilt ? [{ label: 'Molette inclinable', value: 'Oui' }] : []),
    { label: 'Side buttons', value: String(model.sideButtons) },
    { label: 'Taux de rapport', value: `${model.pollingHz} Hz` },
  ]
}

async function read(model: Model, pages: Listed[]): Promise<OfficialMouse> {
  // The model's own page, its black colour's where it has one (Corsair's SKUs end in 0): its
  // photos are of that shell, and a white mouse shot on white does not cut out.
  const own = pages
    .filter((p) => model.skus.test(p.sku))
    .sort((a, b) => Number(!/0-[A-Z]+\d*$/.test(a.sku)) - Number(!/0-[A-Z]+\d*$/.test(b.sku)))[0]
  if (!own) throw new Error(`${model.name} : aucune page`)
  const html = await get(own.url)
  const item = itemOf(html)
  if (!item) throw new Error(`${model.name} : page illisible`)
  const variants: MouseVariant[] = []
  // A model sold in one colour is a simple product: the item is its own variant.
  for (const v of item.variants?.length ? item.variants : [{ product: item }]) {
    const p = v.product ?? {}
    const sku = p.sku?.toUpperCase() ?? ''
    const carbon = model.carbon?.test(sku)
    if (!model.skus.test(sku) && !carbon) continue
    const variant = variantOf(p, 'attributes' in v ? v.attributes : [])
    variants.push({
      sku: p.sku,
      color: carbon ? 'Carbon' : variant.color,
      price: variant.price,
      regularPrice: variant.regularPrice,
      available: true,
    })
  }
  const pictures = [
    ...(item.media_gallery ?? []).map((m) => large(m.url)),
    ...(item.variants ?? [])
      .filter((v) => model.skus.test(v.product?.sku?.toUpperCase() ?? ''))
      .map((v) => large(v.product?.image?.url)),
  ].filter((u): u is string => !!u)
  return {
    url: own.url,
    name: model.name,
    facts: factsOf(model, item.tech_specs ?? []),
    text: copyOf(html),
    hints: { segment: 'gaming', shape: model.shape, hand: model.hand },
    variants,
    images: [...new Set(pictures)].slice(0, 8).map((src) => ({ src })),
  }
}

export const source: MouseSource = {
  category: 'mouse',
  host: new URL(ORIGIN).host,
  label: 'corsair.com/fr/fr (prix € du site français ; mesures des articles corsair.com)',
  intro: (brand) => [
    `# ${brand.name} : souris importées de corsair.com (site français) par \`pnpm ingest corsair-mice\` ;`,
    '# mesures, poids, boutons et fréquence lus dans les articles et FAQ de corsair.com (source au-dessus',
    '# de chaque fiche) : la fiche technique des pages n’en donne pas.',
  ],
  candidates: async () => {
    const pages = await listed()
    return MODELS.map((m) => {
      const model: MouseModel = {
        brand: BRAND,
        slug: slugify(`corsair ${m.name}`),
        read: () => read(m, pages),
      }
      return {
        slug: model.slug,
        brand: BRAND,
        map: async () => mapMouse(model, await model.read()),
      }
    })
  },
  // The weekly refresh re-reads the pages the entries came from, every colour they list.
  priceIndex: async (urls) => {
    const index: PriceIndex = new Map()
    for (const url of urls) {
      const item = itemOf(await get(url))
      if (!item) continue
      for (const v of item.variants?.length ? item.variants : [{ product: item }]) {
        const variant = variantOf(v.product ?? {}, 'attributes' in v ? v.attributes : [])
        const eur = Math.max(variant.price ?? 0, variant.regularPrice ?? 0)
        if (variant.sku && eur) index.set(variant.sku, { eur })
      }
    }
    return index
  },
}
