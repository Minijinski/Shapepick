import type { Brand, MouseRecord } from '@choose/catalog'
import type { Fact } from '../../facts'
import { get, getJson } from '../../http'
import { clean } from '../../monitor-specs'
import { slugify } from '../../text'
import { estorePrice } from '../monitors/asus'
import {
  type MouseModel,
  type MousePicture,
  type MouseVariant,
  mouseSource,
  type OfficialMouse,
  TOP,
} from './official'

// ASUS ROG mice, listed by the public API behind asus.com (as the monitors are, sources/monitors/
// asus.ts). A ROG mouse's sheet is its /spec/ page, one row per heading ("Dimensions (L x l x H)",
// "Ambidextre : Droitier", "Prise en main" with one value per grip); its product page shows the ASUS
// eStore price when the eStore sells it, the price we take. The main site's mice (office ranges,
// TUF) show none and wait for a recommended price. ROG files its mice by shape in their URLs
// (/mice/ambidextrous/, /mice/ergonomic-right-handed/); the wireless ones by link only, whose shape
// is their range's, from the table below.

const BRAND: Brand = { slug: 'asus', name: 'ASUS', website: 'https://www.asus.com' }
const API = 'https://odinapi.asus.com/recent-data/apiv2'
/** Special and licensed editions of a mouse already listed; a colour sold as its own product. */
const EDITION = /\beva\b|gundam|hatsune|phantom blade|edition 20|-kjp\b|moonlight white/i

type Shape = MouseRecord['specs']['shape']
const SHAPES: [RegExp, Shape][] = [
  [/\/ambidextrous\//, 'symmetrical'],
  [/\/ergonomic-right-handed\//, 'ergonomic'],
  [/harpe|strix impact|pugio/i, 'symmetrical'],
  [/keris|gladius|chakram|spatha|strix carry/i, 'ergonomic'],
]

type Listed = {
  Name?: string
  ProductURL?: string
  isRogFlag?: number
  ImageList?: { ImageURL?: string[] }[]
}

const strip = (html: string) =>
  clean(
    html
      .replace(/<sup>[\s\S]*?<\/sup>/g, '')
      .replace(/<br\s*\/?>/gi, ' / ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))),
  )

/** The spec page's rows, a heading and its values: "Prise en main : Paume ; Griffe ; …". */
export function specRows(html: string): Fact[] {
  const out: Fact[] = []
  const seen = new Set<string>()
  for (const row of html.split(/ProductSpecSingle__productSpecItemRow__/).slice(1)) {
    const label = strip(/productSpecItemTitle__[^"]*"[^>]*>([\s\S]*?)<\/h2>/.exec(row)?.[1] ?? '')
    const value = [...row.matchAll(/descriptionItemValue__[^"]*"[^>]*>([\s\S]*?)<\/span>/g)]
      .map((m) => strip(m[1] ?? ''))
      .filter(Boolean)
      .join(' ; ')
    // The page prints its sheet twice: the first copy is enough.
    if (!label || !value || seen.has(label)) continue
    seen.add(label)
    out.push({ label, value })
  }
  return out
}

/** The sheet worded for the mapper: "Ambidextre : Droitier" is the shape's line. */
function factsOf(rows: Fact[]): Fact[] {
  const box = rows.find((f) => /^(inclus|contenu)/i.test(f.label))?.value ?? ''
  return rows.map((f) => {
    if (/^ambidextre$/i.test(f.label)) return { label: 'Forme', value: f.value }
    // "8000 Hz with ROG Polling Rate Booster": the booster is in some boxes only.
    if (/taux de rapport/i.test(f.label) && /booster/i.test(f.value) && !/booster/i.test(box))
      return { ...f, value: `${f.value} (booster vendu séparément)` }
    return f
  })
}

const nameOf = (p: Listed) =>
  clean((p.Name ?? '').replace(/<[^>]+>/g, ' '))
    .replace(/^ROG\s+/i, '')
    .replace(/\s+Gaming Mouse$/i, '')

async function listed(): Promise<Listed[]> {
  const all: Listed[] = []
  for (let page = 1; page < 10; page++) {
    const data = await getJson<{ Result?: { TotalCount?: number; ProductList?: Listed[] } }>(
      `${API}/SeriesFilterResult?SystemCode=asus&WebsiteCode=fr&ProductLevel1Code=accessories&ProductLevel2Code=mice-and-mouse-pads&PageSize=60&PageIndex=${page}&CategoryName=&SeriesName=&SubSeriesName=&Spec=&SubSpec=&PriceMin=&PriceMax=&Sort=Recommend&siteID=www&sitelang=`,
    )
    const list = data.Result?.ProductList ?? []
    all.push(...list)
    if (!list.length || all.length >= (data.Result?.TotalCount ?? 0)) break
  }
  return all
}

/** One ROG mouse: its /spec/ page, its eStore price on its page. */
export async function readRog(p: Listed): Promise<OfficialMouse> {
  const url = p.ProductURL ?? ''
  const page = await get(url)
  const facts = factsOf(specRows(await get(`${url.replace(/\/$/, '')}/spec/`)))
  const price = estorePrice(page)
  // "Black/Moonlight White", "BLACK", "Gun-metal grey".
  const colors = (facts.find((f) => /^couleur/i.test(f.label))?.value ?? 'Black')
    .split(/\s*\/\s*/)
    .filter(Boolean)
    .map((c) => (c === c.toUpperCase() ? c.charAt(0) + c.slice(1).toLowerCase() : c))
  // One eStore price for all colours, under the page's name: what the weekly refresh reads back.
  const sku = /\/([^/]+)\/?$/.exec(url)?.[1] ?? slugify(nameOf(p))
  const variants: MouseVariant[] = colors.map((color) => ({
    sku,
    color,
    regularPrice: price,
    available: price != null,
  }))
  const images: MousePicture[] = (p.ImageList?.[0]?.ImageURL ?? [])
    .map((src) => src.replace(/\/w\d+$/, ''))
    .slice(0, 8)
    .map((src) => ({ src }))
  // Named as ASUS names it, line included ("ROG Harpe II Ace"), as the monitors are.
  const name = `ROG ${nameOf(p)}`
  return {
    url,
    name,
    facts,
    text: '',
    hints: { segment: 'gaming', shape: SHAPES.find(([re]) => re.test(`${url} ${name}`))?.[1] },
    variants,
    images,
  }
}

async function models(): Promise<MouseModel[]> {
  const out: MouseModel[] = []
  for (const p of await listed()) {
    const url = p.ProductURL ?? ''
    if (p.isRogFlag !== 1 || !/\/mice\//.test(url) || EDITION.test(nameOf(p))) continue
    const mouse = await readRog(p)
    out.push({ brand: BRAND, slug: slugify(`asus ${mouse.name}`), read: async () => mouse })
  }
  return out.slice(0, TOP)
}

export const source = mouseSource({
  host: 'rog.asus.com',
  label: 'rog.asus.com/fr (prix € de l’eStore ASUS)',
  intro: (brand) => [
    `# ${brand.name} ROG : souris importées de rog.asus.com/fr par \`pnpm ingest rog-mice\` (prix de l’eStore ASUS).`,
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
          variants: [{ sku, regularPrice: price, available: true }],
          images: [],
        }
      : undefined
  },
})
