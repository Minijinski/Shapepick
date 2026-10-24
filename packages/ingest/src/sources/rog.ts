import type { Brand } from '@choose/catalog'
import { type Fact, linesOf, parseHtml } from '../facts'
import { get, getJson } from '../http'
import { clean } from '../monitor-specs'
import { Skip } from '../source'
import { slugify } from '../text'
import { specRows } from './mice/asus'
import { estorePrice } from './monitors/asus'
import {
  type OfficialModel,
  type OfficialProduct,
  type OfficialVariant,
  officialSource,
  type Picture,
} from './official'

// ASUS ROG keyboards, from rog.asus.com/fr, listed by the API behind the ASUS sites as the ROG mice
// are (sources/mice/asus.ts). A keyboard's sheet is its /spec/ page (one row per heading), its
// photos its /gallery/ page, its price the ASUS eStore's on its page: one price for every version,
// the price the eStore sells it at, else the keyboard is left out (older models the eStore no
// longer sells). Every French part number on a page ends in FA (90MP0316-BKFA00): the French
// AZERTY versions. The pages do not tie a switch to a part number: the sheet names the switch
// ("ROG HFX V2 Magnetic Switch", "ROG NX Mechanical Switch (Snow V2 / Strom V2)") or the copy does
// ("équipé de switches mécaniques ROG NX Snow pré-lubrifiés"), read into the table below; their
// feel and figures are ROG's switch page's (data/switches.yaml). Special editions are left out.

const BRAND: Brand = { slug: 'asus', name: 'ASUS', website: 'https://www.asus.com' }
const API = 'https://odinapi.asus.com/recent-data/apiv2'
const EDITION = /edition|\beva\b|zywoo|miku|moonlight-white|gundam/i

/** The switches each keyboard is sold with in France, as its French sheet or copy names them. */
const SWITCHES: [RegExp, string[]][] = [
  // Sheet: « ROG HFX V2 Magnetic Switch ».
  [/azoth 96 he|falcata/i, ['ROG HFX V2 Magnetic']],
  // Sheet: « ROG HFX V2 Magnetic Switch ; ROG HFX V2X Magnetic Switch ».
  [/falchion ace 75 he/i, ['ROG HFX V2 Magnetic', 'ROG HFX V2X Magnetic']],
  // Sheet: « ROG HFX Magnetic Switch ».
  [/falchion ace hfx/i, ['ROG HFX Magnetic']],
  // Sheet « ROG NX Mechanical Switch (Snow V2 / Strom V2) », copy « switches mécaniques ROG NX
  // Storm V2 » and « NX Snow V2 » on all three pages.
  [/azoth x|strix scope ii x|strix morph 96/i, ['ROG NX Snow V2', 'ROG NX Storm V2']],
  // Sheet: « ROG NX Mechanical Switch (Snow / Strom) ».
  [/azoth extreme/i, ['ROG NX Snow', 'ROG NX Storm']],
  // Copy: « Il est équipé de switches mécaniques ROG NX Snow pré-lubrifiés ».
  [/strix scope ii 96 wireless/i, ['ROG NX Snow']],
  // Copy: « Les switches mécaniques ROG NX Red présentent une distance d'activation de 1,8 mm ».
  [/^azoth$/i, ['ROG NX Red']],
  // Sheet: « ROG NX Mechanical: Red ».
  [/^falchion ace$/i, ['ROG NX Red']],
  // Copy: « Les switches RX Red et RX Blue pré-lubrifiés » (low-profile versions).
  [/falchion rx low profile/i, ['ROG RX Red Low-Profile', 'ROG RX Blue Low-Profile']],
  // Copy: « Équipé des switches optiques ROG RX Red ou Blue ».
  [/strix scope ii (96 )?rx/i, ['ROG RX Red', 'ROG RX Blue']],
]

/** What the magnetic switches let the actuation point be set to (ROG's switch page). */
const ACTUATION: [RegExp, string][] = [
  [/HFX Magnetic/, '0.1 mm - 4.0 mm'],
  [/HFX V2X? Magnetic/, '0.1 mm - 3.5 mm'],
]

type Listed = {
  Name?: string
  ProductURL?: string
  isRogFlag?: number
  ModelSpec?: string
  ImageList?: { ImageURL?: string[] }[]
}

/** A list field's HTML ("Clavier gaming personnalis&eacute;…") as text. */
const decode = (html: string) => clean(parseHtml(html).text)

/** "ROG Strix Morph 96 Wireless Gaming Keyboard", "Clavier ROG Azoth 96 HE Gaming" → Strix Morph 96 Wireless. */
const nameOf = (p: Listed) =>
  decode(p.Name ?? '')
    .replace(/^Clavier\s+/i, '')
    .replace(/^ROG\s+/i, '')
    .replace(/\s+Gaming(\s+Keyboard)?$/i, '')
    .trim()

async function listed(): Promise<Listed[]> {
  const all: Listed[] = []
  for (let page = 1; page < 10; page++) {
    const data = await getJson<{ Result?: { TotalCount?: number; ProductList?: Listed[] } }>(
      `${API}/SeriesFilterResult?SystemCode=asus&WebsiteCode=fr&ProductLevel1Code=accessories&ProductLevel2Code=keyboards&PageSize=60&PageIndex=${page}&CategoryName=&SeriesName=&SubSeriesName=&Spec=&SubSpec=&PriceMin=&PriceMax=&Sort=Recommend&siteID=www&sitelang=`,
    )
    const list = data.Result?.ProductList ?? []
    all.push(...list)
    if (!list.length || all.length >= (data.Result?.TotalCount ?? 0)) break
  }
  return all
}

/** The size, from the name or the list's summary ("au format clavier 75", "75 % divisé"). */
function sizeTag(name: string, summary: string): string {
  if (/divisé|split/i.test(summary)) return 'split'
  const pct =
    /\b(96|75|65|60)\b/.exec(name)?.[1] ??
    /\b(\d{2,3})\s?%|format clavier (\d{2})/.exec(summary)?.slice(1).find(Boolean)
  return pct ? `${pct}%` : '100%'
}

/** A ROG keyboard's own photos, from its /gallery/ page, in the order it shows them. */
async function gallery(url: string): Promise<string[]> {
  const html = await get(`${url.replace(/\/$/, '')}/gallery/`).catch(() => '')
  const start = html.indexOf('ProductGallery__productGallery')
  return [
    ...new Set(
      [
        ...html
          .slice(Math.max(0, start))
          .matchAll(/https:\/\/dlcdnwebimgs\.asus\.com\/gain\/[0-9A-Fa-f-]{36}/g),
      ].map((m) => m[0]),
    ),
  ]
}

/** The sheet worded for the generic mapper's labels. */
function factsOf(rows: Fact[], switches: string[]): Fact[] {
  const value = (label: RegExp) => rows.find((r) => label.test(r.label))?.value
  const box = value(/^contenu/i) ?? ''
  const rate = value(/taux de rapport/i) ?? ''
  const facts: Fact[] = [
    { label: 'Connectivity', value: value(/connectivit/i) ?? '' },
    // "8000 Hz with ROG Polling Rate Booster": the booster is in some boxes only.
    {
      label: 'Polling rate',
      value: /booster/i.test(rate) && !/booster/i.test(box) ? '1000 Hz' : rate,
    },
    { label: 'Weight', value: value(/^poids/i) ?? '' },
    { label: 'Dimensions', value: value(/^dimension/i) ?? '' },
    { label: 'Backlight', value: value(/^éclairage|^eclairage/i) ?? '' },
    { label: 'OS', value: value(/^se$|^os$/i) ?? '' },
  ]
  const range = ACTUATION.find(([re]) => switches.some((s) => re.test(s)))?.[1]
  if (range) facts.push({ label: 'Actuation point', value: `adjustable ${range}` })
  return facts.filter((f) => f.value)
}

async function read(p: Listed): Promise<OfficialProduct> {
  const url = p.ProductURL ?? ''
  const name = nameOf(p)
  const page = await get(url)
  const price = estorePrice(page)
  if (!price) throw new Skip('sans prix ASUS eStore')
  const switches = SWITCHES.find(([re]) => re.test(name))?.[1]
  if (!switches) throw new Skip('switch non nommé par la page française')
  const rows = specRows(await get(`${url.replace(/\/$/, '')}/spec/`))
  const summary = decode(p.ModelSpec ?? '')
  const main = parseHtml(page)
  // The copy describes the switches' housings ("matériau composite POM pour la tige"): no keycaps.
  const text = [summary, ...linesOf(main.querySelector('main') ?? main)]
    .join('\n')
    .replace(/\bPOM\b/g, 'polyacétal')
    .slice(0, 6000)
  const colours = (rows.find((r) => /^couleur/i.test(r.label))?.value ?? 'Black')
    .split(/\s*[;/]\s*/)
    .map((c) => c.trim())
    .filter((c) => c && !/^noir$/i.test(c))
  const sku = /\/([^/]+)\/?$/.exec(url)?.[1] ?? slugify(name)
  const variants: OfficialVariant[] = [...new Set(colours.length ? colours : ['Black'])].flatMap(
    (color) =>
      switches.map((switchName) => ({
        sku,
        color,
        layout: 'AZERTY (FR)',
        switchName,
        regularPrice: price,
        available: true,
      })),
  )
  const tags = [sizeTag(name, summary)]
  if (/remplaçables? à chaud|hot-?swap/i.test(`${summary}\n${text}`)) tags.push('hot-swap')
  if (/low[- ]profile/i.test(name)) tags.push('low profile')
  if (/\bRX\b/.test(switches.join(' '))) tags.push('optical')
  if (/HFX/.test(switches.join(' '))) tags.push('magnetic')
  const keycaps = /pbt-keycaps/.test(url) || /\bPBT\b/.test(summary) ? 'PBT' : 'ABS'
  const pictures: Picture[] = [
    ...new Set([
      ...(p.ImageList?.[0]?.ImageURL ?? []).map((src) => src.replace(/\/w\d+$/, '')),
      ...(await gallery(url)),
    ]),
  ].map((src) => ({ src }))
  return {
    url,
    name,
    facts: [...factsOf(rows, switches), { label: 'Keycaps', value: keycaps }],
    text,
    tags,
    variants,
    images: pictures.slice(0, 12),
  }
}

async function models(): Promise<OfficialModel[]> {
  const out: OfficialModel[] = []
  for (const p of await listed()) {
    const url = p.ProductURL ?? ''
    if (p.isRogFlag !== 1 || !/\/keyboards\/keyboards\//.test(url) || EDITION.test(url)) continue
    const name = nameOf(p)
    let product: OfficialProduct
    try {
      product = await read(p)
    } catch (e) {
      if (!(e instanceof Skip)) throw e
      continue
    }
    out.push({ brand: BRAND, name, slug: slugify(`asus rog ${name}`), products: [product] })
  }
  return out
}

export const source = officialSource({
  host: 'rog.asus.com',
  label: 'rog.asus.com/fr (prix € de l’eStore ASUS, versions françaises AZERTY)',
  intro: (brand) => [
    `# ${brand.name} ROG : claviers importés de rog.asus.com/fr par \`pnpm ingest rog\` (prix de l’eStore ASUS).`,
    '# Les références françaises (90MP…-BKFA…) sont les versions AZERTY ; switchs nommés par la fiche ou le',
    '# texte de la page française, chiffres de la page officielle des switchs ROG.',
  ],
  models,
  // The weekly refresh: the page's eStore price, under the name its URL ends with.
  read: (url, html) => {
    const price = estorePrice(html)
    const sku = /\/([^/]+)\/?$/.exec(url)?.[1] ?? url
    return price
      ? {
          url,
          name: sku,
          facts: [],
          text: '',
          tags: [],
          variants: [{ sku, regularPrice: price, available: true }],
          images: [],
        }
      : undefined
  },
})
