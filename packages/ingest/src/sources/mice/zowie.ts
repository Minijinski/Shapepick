import type { Brand, MouseRecord } from '@choose/catalog'
import { type Fact, Facts, linesOf, parseHtml } from '../../facts'
import { get, getJson } from '../../http'
import type { MouseSource, PriceIndex } from '../../source'
import { slugify } from '../../text'
import { type MouseModel, type MouseVariant, mapMouse, type OfficialMouse, TOP } from './official'

// ZOWIE (BenQ), from its European site (zowie.benq.eu/fr-fr). The mice page reads its list from
// a JSON service: every model with its size letter ("EC2-DW (M)"), page, shop SKU, view from above
// and filters (shape, version, finish). A model's page holds its sheet (a <th>/<td> table whose
// dimensions row is empty: ZOWIE draws them on a picture) and its EAN. The outline comparison of
// the global site (zowie.benq.com) gives them in text: length × widest width × height, and the
// weight (zowie.benq.eu's gives the width at the middle of the shell instead). Prices load in the
// browser from the BenQ shop, whose API answers the pages of the site only (their address as
// referrer); a model the shop does not sell takes the recommended price of data/msrp.yaml, else is
// left out. Older generations (A, B and their V2 colours) are left out; a "Glossy" edition is the
// white colour of its DW model.

const ORIGIN = 'https://zowie.benq.eu'
const BRAND: Brand = { slug: 'zowie', name: 'ZOWIE', website: 'https://zowie.benq.eu' }
const LIST = `${ORIGIN}/services/game/page/productLinePage?path=/content/game/fr-fr/mouse.html`
const OUTLINES =
  'https://zowie.benq.com/services/game/page/productLinePage?path=/content/game/en-us/mouse.html'
const SHOP = `${ORIGIN}/api/magento/g6/queryMixedProduct/BQE/fr-buy-zowie?skuids=`
/** The page the shop's API is called from. */
const REFERER = `${ORIGIN}/fr-fr/mouse.html`
const PICTURE = (name: string) =>
  `https://image.benq.com/is/image/benqco/${name}?wid=2000&fmt=png-alpha`

type Shape = MouseRecord['specs']['shape']
type Hand = MouseRecord['specs']['hand']

type Listed = {
  name: string
  link: string
  skucode: string
  dmImage?: string
  filter?: string[]
}
type Outline = { name?: string; size?: string }
type ShopItem = {
  sku: string
  /** "ZOWIE EC2-DW Souris sans fil 4K pour Esports", "MOUSE GAMING GEAR FK1-DW GREY". */
  name?: string
  stock_status?: string
  price_range?: {
    minimum_price?: { regular_price?: { value?: number }; final_price?: { value?: number } }
  }
}

/**
 * Each series' shell and thumb-side buttons, counted on the official side views (`…-left`,
 * `…-right`): two on the left flank, none on the right, the wireless FK included (the wired FK
 * had buttons on both flanks).
 */
const SERIES: [RegExp, { shape: Shape; hand: Hand; sideButtons: number }][] = [
  [/^EC/, { shape: 'ergonomic', hand: 'right', sideButtons: 2 }],
  [/^(FK|ZA|S\d|U\d)/, { shape: 'symmetrical', hand: 'right', sideButtons: 2 }],
]

/** "EC2-DW Glossy (M)" → EC2-DW; "FK1+-C (XL)" → FK1+-C. */
const modelOf = (name: string) =>
  name
    .replace(/\s*\(.*$/, '')
    .replace(/\s+glossy\b/i, '')
    .trim()
    .toUpperCase()
const isGlossy = (l: Listed) => /glossy/i.test(l.name)
/** First generations and their colour editions, the receiver: not current mice. */
const isCurrent = (l: Listed) =>
  /-(DW|CW|C)$|^U\d$/.test(modelOf(l.name)) && !/V\s?2|récepteur|receiver/i.test(l.name)

/** The global outline comparison, model → "123x65x42.1mm. Weight: 60g". */
async function outlines(): Promise<Map<string, string>> {
  const data = await getJson<{ data?: { comparison?: Outline[] } }>(OUTLINES)
  return new Map(
    (data.data?.comparison ?? [])
      .filter((o) => o.name && o.size)
      .map((o) => [modelOf(o.name ?? ''), o.size ?? '']),
  )
}

/** Today's regular price and stock of SKUs at the BenQ shop (20 per call, as the site asks). */
async function shopPrices(skus: string[]): Promise<Map<string, ShopItem>> {
  const out = new Map<string, ShopItem>()
  const wanted = [...new Set(skus.filter(Boolean))].sort()
  for (let i = 0; i < wanted.length; i += 20) {
    const res = await getJson<{ response?: string }>(
      `${SHOP}${wanted.slice(i, i + 20).join(',')}`,
      { referer: REFERER },
    )
    const items =
      (JSON.parse(res.response ?? '{}') as { data?: { products?: { items?: ShopItem[] } } }).data
        ?.products?.items ?? []
    for (const item of items) out.set(item.sku, item)
  }
  return out
}

const listedPrice = (item?: ShopItem) => {
  const p = item?.price_range?.minimum_price
  return Math.max(p?.regular_price?.value ?? 0, p?.final_price?.value ?? 0) || undefined
}

/** The page's sheet, its photos of this model (views from above first) and its EAN. */
function readPage(html: string, model: string) {
  const root = parseHtml(html)
  const table = root.querySelector('#game-spec-table') ?? root
  const facts: Fact[] = []
  for (const f of Facts.fromHtml(table.toString()).list) {
    if (!f.value || facts.some((g) => g.label === f.label)) continue
    // "80hrs(1Khz) / 30hrs(2Khz) / 24hrs(4Khz)": one figure per report rate.
    facts.push(
      /autonomie|battery/i.test(f.label) ? { ...f, value: f.value.replace(/\//g, ';') } : f,
    )
  }
  // "ec2-dw-top", "1-ec2dw-top", "U2-DW_Left", "05-u2_left": the U2's own, not the U2-DW's. The
  // feature pictures ("u2dw-pp-thumb-angle"), the bottom, the measurements and the mouse on its
  // receiver ("08-ec3-cw-rx") are left out.
  const id = model.toLowerCase().replace('+', 'plus')
  const own = new RegExp(`(^|[-_])${id.replace(/-/g, '-?')}(?![-_]?(dw|cw|c)([-_]|$))([-_]|$)`)
  const rank = (name: string) =>
    /(^|[-_])(pp|rx)([-_]|$)|bottom|measure|info|kv|size/i.test(name)
      ? 9
      : /[-_]top\b/i.test(name)
        ? 0
        : /left|right|45/i.test(name)
          ? 1
          : 2
  const names = [
    ...new Set(
      [...html.matchAll(/image\.benq\.com\/is\/image\/benqco\/([\w-]+)/g)].map((m) => m[1] ?? ''),
    ),
  ]
    .filter((name) => own.test(name.toLowerCase()) && rank(name) < 9)
    .sort((a, b) => rank(a) - rank(b))
  const main = parseHtml(html.slice(0, html.indexOf('id="game-spec-table"')))
  return {
    facts,
    text: linesOf(main.querySelector('main') ?? main).join('\n'),
    pictures: names.map(PICTURE),
    ean: /id="EANCode" value="(\d{8,14})"/.exec(html)?.[1],
  }
}

type Model = { name: string; matte: Listed; glossy?: Listed }

async function models(): Promise<Model[]> {
  const data = await getJson<{ data?: { list?: Listed[] } }>(LIST)
  const byName = new Map<string, Model>()
  const list = (data.data?.list ?? []).filter(isCurrent)
  for (const l of list.filter((l) => !isGlossy(l))) {
    byName.set(modelOf(l.name), { name: modelOf(l.name), matte: l })
  }
  for (const l of list.filter(isGlossy)) {
    const model = byName.get(modelOf(l.name))
    if (model) model.glossy = l
  }
  return [...byName.values()].slice(0, TOP)
}

async function read(model: Model, sizes: Map<string, string>, shop: Map<string, ShopItem>) {
  const page = readPage(await get(model.matte.link), model.name)
  const series = SERIES.find(([re]) => re.test(model.name))?.[1]
  const facts = [...page.facts]
  const size = sizes.get(model.name)
  const dims = /([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*mm/i.exec(size ?? '')
  if (dims)
    facts.push({
      label: 'Dimensions (L x l x H)',
      value: `${dims[1]} x ${dims[2]} x ${dims[3]} mm`,
    })
  const weight = /weight\s*:\s*(\d+(?:\.\d+)?)\s*g/i.exec(size ?? '')?.[1]
  if (weight && !facts.some((f) => /poids|weight/i.test(f.label)))
    facts.push({ label: 'Poids', value: `${weight} g` })
  if (series) facts.push({ label: 'Side buttons', value: String(series.sideButtons) })
  // The receiver doubles as a stand for the charging cable ("station de charge … charge
  // filaire"): a rechargeable battery, no wireless charging.
  if (/station de (re)?charge|charge filaire|chargement avec fil/i.test(page.text))
    facts.push({ label: 'Batterie', value: 'rechargeable, chargée par câble' })
  facts.push({ label: 'Recharge sans fil', value: 'Non' })
  // The shop sells some matte models in a pale grey ("MOUSE GAMING GEAR FK1-DW GREY"), the others
  // in black.
  const matteName = /\b(grey|gray|gris)\b/i.test(shop.get(model.matte.skucode)?.name ?? '')
    ? 'Gris clair'
    : 'Noir'
  const colour = (l: Listed, name: string): MouseVariant => {
    const item = shop.get(l.skucode)
    const price = listedPrice(item)
    return { sku: l.skucode || undefined, color: name, regularPrice: price, available: true }
  }
  const variants = [colour(model.matte, matteName)]
  if (model.glossy) variants.push(colour(model.glossy, 'Blanc brillant'))
  const glossyTop = model.glossy?.dmImage?.split('/').pop()
  const mouse: OfficialMouse = {
    url: model.matte.link,
    name: model.name,
    gtins: page.ean ? [page.ean] : undefined,
    facts,
    text: page.text,
    hints: { segment: 'gaming', shape: series?.shape, hand: series?.hand },
    variants,
    images: [...page.pictures, ...(glossyTop ? [PICTURE(glossyTop)] : [])].map((src) => ({ src })),
    notes: size ? [] : ['mesures absentes de la comparaison des formes de zowie.benq.com'],
  }
  return mouse
}

export const source: MouseSource = {
  category: 'mouse',
  host: new URL(ORIGIN).host,
  label: 'zowie.benq.eu/fr-fr (prix € de la boutique BenQ, sinon prix conseillé)',
  intro: (brand) => [
    `# ${brand.name} : souris importées de zowie.benq.eu par \`pnpm ingest zowie\` ; mesures (longueur ×`,
    '# largeur maximale × hauteur) et poids de la comparaison des formes de zowie.benq.com.',
  ],
  candidates: async () => {
    const all = await models()
    const sizes = await outlines()
    const shop = await shopPrices(all.flatMap((m) => [m.matte.skucode, m.glossy?.skucode ?? '']))
    return all.map((m) => {
      const model: MouseModel = {
        brand: BRAND,
        slug: slugify(`zowie ${m.name.replace('+', ' plus')}`),
        read: () => read(m, sizes, shop),
      }
      return {
        slug: model.slug,
        brand: BRAND,
        map: async () => mapMouse(model, await model.read()),
      }
    })
  },
  // The weekly refresh: every SKU of the line, priced by the shop.
  priceIndex: async () => {
    const all = await models()
    const shop = await shopPrices(all.flatMap((m) => [m.matte.skucode, m.glossy?.skucode ?? '']))
    const index: PriceIndex = new Map()
    for (const [sku, item] of shop) {
      const eur = listedPrice(item)
      if (eur) index.set(sku, { eur })
    }
    return index
  },
}
