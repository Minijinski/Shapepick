import type { Brand } from '@choose/catalog'
import type { Fact } from '../../facts'
import { get } from '../../http'
import { clean } from '../../monitor-specs'
import { Skip } from '../../source'
import { slugify } from '../../text'
import { jsonLd } from '../official'
import {
  jsonAfter,
  type MonitorModel,
  type MonitorVariant,
  monitorSource,
  nextFlight,
  type OfficialMonitor,
} from './official'

// LG, from its French site. The site's sitemap lists every monitor page, hundreds of old ones
// included, under several categories; a model code tells its year (27GS95QE: S = 2024, R = 2023;
// 27GX790A: A = 2025, B = 2026), so only pages from 2023 on are read. A page streams its product
// in Next.js flight data: status (ACTIVE), year, EAN, the sheet (`techSpecs` groups; the
// « Accessoire » group lists cables, not ports) and the front view (`largeImageAddr`, « vue
// avant »); JSON-LD gives today's price and the regular one (StrikethroughPrice). The colour is
// the code's suffix (-B black, -W white). The sheets of models just announced are nearly empty:
// they are skipped and come back once LG fills them. Medical, TV and cloud monitors, bundles and
// business pages are left out. Images are on www.lg.com, at fixed sizes.

const ORIGIN = 'https://www.lg.com'
const BRAND: Brand = { slug: 'lg', name: 'LG', website: 'https://www.lg.com' }
const PAGE =
  /\/fr\/moniteurs\/([^/]+)\/(?:lg-)?(\d{2}[a-z]{1,3}\d{2,3}[a-z0-9]*(?:-[a-z]{1,2})?)(?:-[^/]*)?\/$/
const LEFT_OUT = new Set(['medicaux', 'tv', 'solutions-cloud', 'moniteurs-business'])
const COLORS: Record<string, string> = { B: 'Noir', W: 'Blanc', S: 'Argent', G: 'Gris' }

/** The sections of the site that name a range, for a page whose product name does not. */
const RANGES: [string, string][] = [
  ['ultragear', 'UltraGear'],
  ['ultrawide', 'UltraWide'],
  ['ultrafine', 'UltraFine'],
  ['smart-monitor', 'Smart Monitor'],
]

/**
 * The name of an LG monitor: its range and its code. The page's « Nom du produit » is a range
 * ("UltraGear OLED"), a word that is no name ("Moniteur PC", "UHD") or a code with its colour
 * ("32U990A-S"); without a range there, the site's section gives it
 * ("…/moniteurs-gaming-ultragear/"). An OLED UltraGear is an "UltraGear OLED", as LG sells it.
 */
export function lgName(line: string | undefined, base: string, url: string, oled: boolean) {
  let range = clean(line ?? '')
    .replace(/\b\d{2}[A-Z]{1,4}\d{2,3}[A-Z]{0,3}(?:-[A-Z]{1,2})?\b/g, '')
    .replace(
      /\b(?:Moniteur|Monitor)\s+PC\b|\bPC\s+(?:Monitor|Moniteur)\b|\b(?:UHD|QHD|FHD|4K)\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim()
  if (!/ultra|smart/i.test(range)) {
    const section = RANGES.find(([key]) => url.includes(key))?.[1]
    if (section) range = `${section} ${range}`.trim()
  }
  if (oled && range === 'UltraGear') range = 'UltraGear OLED'
  return [range, base].filter(Boolean).join(' ')
}

/** The year a code names: 27GS95QE → 2024, 27GX790A → 2025, 27GX790B → 2026. */
export function lgYear(code: string): number | undefined {
  const base = code.toUpperCase().split('-')[0] ?? ''
  if (/^\d{2}[A-Z]{1,2}\d{2,3}S?A$/.test(base)) return 2025
  if (/^\d{2}[A-Z]{1,2}\d{2,3}S?B$/.test(base)) return 2026
  const letter = /^\d{2}[A-Z]([A-Z])\d/.exec(base)?.[1]
  return letter
    ? { S: 2024, R: 2023, Q: 2022, P: 2021, N: 2020, L: 2019, K: 2018 }[letter]
    : undefined
}

type Spec = { title?: string; spec?: { name?: string; value?: string }[] }
type Offer = {
  price?: string
  availability?: string
  priceSpecification?: { priceType?: string; price?: string }
}

/** LG names the stand's moves in one row: « Inclinaison/Hauteur/Rotation/Pivotement ». */
function standFacts(value: string): Fact[] {
  const moves = value.toLowerCase()
  return [
    { label: 'Tilt', value: /inclinaison/.test(moves) ? 'Oui' : 'Non' },
    { label: 'Height adjustment', value: /hauteur/.test(moves) ? 'Oui' : 'Non' },
    { label: 'Swivel', value: /rotation/.test(moves) ? 'Oui' : 'Non' },
    { label: 'Pivot', value: /pivot/.test(moves) ? 'Oui' : 'Non' },
  ]
}

export function read(url: string, html: string): OfficialMonitor | undefined {
  const flight = nextFlight(html)
  const field = (key: string) => new RegExp(`"${key}":"([^"]*)"`).exec(flight)?.[1]
  const code = field('salesModelCode')
  const groups = jsonAfter<Spec[]>(flight, 'techSpecs') ?? []
  if (!code) return undefined
  if (field('modelStatusCode') !== 'ACTIVE') throw new Skip('plus vendu par LG')

  const facts: Fact[] = []
  for (const group of groups) {
    if (/accessoire/i.test(group.title ?? '')) continue
    for (const { name = '', value = '' } of group.spec ?? []) {
      const label = clean(name)
      const v = clean(value)
      if (!label || !v || v === '-') continue
      if (/position de l'écran/i.test(label)) facts.push(...standFacts(v))
      // LG's OLED monitors use LG Display's WOLED panels.
      else if (label === 'Dalle' && /^oled$/i.test(v)) facts.push({ label, value: 'WOLED' })
      else facts.push({ label, value: v })
    }
  }
  const factOf = (label: string) => facts.find((f) => f.label === label)?.value
  const product = jsonLd(html).find((d) => d['@type'] === 'Product') as
    | { offers?: Offer | Offer[] }
    | undefined
  const offer = [product?.offers ?? []].flat()[0]
  const today = Number(offer?.price) || undefined
  const regular =
    /Strikethrough/i.test(offer?.priceSpecification?.priceType ?? '') &&
    Number(offer?.priceSpecification?.price)
  const base = code.split('-')[0] ?? code
  const variant: MonitorVariant = {
    sku: code,
    color: COLORS[code.split('-')[1] ?? ''],
    price: today,
    regularPrice: regular || undefined,
    available: /InStock/i.test(offer?.availability ?? ''),
  }
  const front = field('largeImageAddr')
  const images: string[] = front ? [`${ORIGIN}/content/dam/channel/wcms${front}`] : []
  const folder = front?.split('/').slice(0, -1).join('/')
  if (folder) {
    for (const m of html.matchAll(
      new RegExp(
        `/content/dam/channel/wcms${folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^"'\\s\\\\]+?-gallery-\\d+-2010\\.jpg`,
        'g',
      ),
    )) {
      const src = `${ORIGIN}${m[0]}`
      if (!images.includes(src)) images.push(src)
    }
  }
  const bullets = jsonAfter<{ bulletFeatureDesc?: string }[]>(flight, 'bulletFeaturesList') ?? []
  const year = Number(field('modelYear')) || lgYear(code)
  const oled = facts.some((f) => /dalle|panel/i.test(f.label) && /oled/i.test(f.value))
  // The code starts with the size (27U421A is a 27"): a page may carry a sibling's sheet.
  const notes: string[] = []
  const sheetSize = Number.parseFloat(factOf('Taille [pouce]') ?? '')
  if (sheetSize && Math.abs(sheetSize - Number(code.slice(0, 2))) > 2) {
    notes.push(`taille de la fiche (${sheetSize}") différente de la référence ${code}`)
  }
  return {
    url,
    name: lgName(factOf('Nom du produit'), base, url, oled),
    modelNumber: code,
    gtins: [field('modelEanCode') ?? ''].filter((g) => /^\d{8,14}$/.test(g)),
    releaseYear: year,
    facts,
    text: bullets.map((b) => clean(b.bulletFeatureDesc ?? '')).join('\n'),
    variants: [variant],
    images: images.slice(0, 8).map((src) => ({ src })),
    notes,
  }
}

/** One page per model code from 2023 on, colours of one model grouped. */
async function models(): Promise<MonitorModel[]> {
  const xml = await get(`${ORIGIN}/fr/sitemap.xml`)
  const byCode = new Map<string, string>()
  for (const [, url = ''] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const m = PAGE.exec(url)
    if (!m?.[1] || !m[2] || LEFT_OUT.has(m[1]) || /bundle/.test(url)) continue
    const code = m[2].toUpperCase()
    if ((lgYear(code) ?? 0) >= 2023 && !byCode.has(code)) byCode.set(code, url)
  }
  // 27GS95QE-B and 27GS95QE-W: one model, two colours.
  const byModel = new Map<string, string[]>()
  for (const [code, url] of byCode) {
    const base = code.split('-')[0] ?? code
    byModel.set(base, [...(byModel.get(base) ?? []), url])
  }
  return [...byModel].map(([base, urls]) => ({
    brand: BRAND,
    slug: slugify(`lg ${base}`),
    read: async () => {
      const pages: OfficialMonitor[] = []
      for (const url of urls) {
        try {
          const m = read(url, await get(url))
          if (m) pages.push(m)
        } catch (e) {
          if (!(e instanceof Skip)) throw e
        }
      }
      const [first] = pages
      if (!first) throw new Skip('plus vendu par LG')
      return { ...first, variants: pages.flatMap((p) => p.variants) }
    },
  }))
}

export const source = monitorSource({
  host: new URL(ORIGIN).host,
  label: 'lg.com/fr (prix € de la boutique LG)',
  intro: (brand) => [
    `# ${brand.name} : importés de lg.com (site français) par \`pnpm ingest lg\`.`,
  ],
  models,
  read: (url, html) => {
    try {
      return read(url, html)
    } catch {
      return undefined
    }
  },
})
