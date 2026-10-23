import type { Brand } from '@choose/catalog'
import type { Fact } from '../facts'
import { linesOf, parseHtml } from '../facts'
import { get } from '../http'
import { slugify } from '../text'
import {
  fact,
  jsonLd,
  type OfficialModel,
  type OfficialProduct,
  type OfficialVariant,
  officialSource,
  type Picture,
} from './official'

// SteelSeries, from its French site (steelseries.com/fr-fr). The product sitemap lists one page per
// family (apex-pro, apex-7…). A family page carries its Salesforce product in the Next.js flight
// payload (self.__next_f.push): the variation groups (size × connectivity: "apex-pro-mini-wired"…),
// the keyboard languages on offer (Français, Allemand…) and the sheet of the selected variant
// (c_specificationAttribute*: "Conception|||Poids|||610 g"). Each size × connectivity group is one
// model, read from its own page (?keyboardSize=…&connectivityType=…&keyboardLanguage=french);
// its languages are the layouts.

const ORIGIN = 'https://steelseries.com'
const BRAND: Brand = {
  slug: 'steelseries',
  name: 'SteelSeries',
  website: 'https://steelseries.com',
}

type Group = { productId?: string; variationValues?: Record<string, string> }
type Attribute = { id?: string; values?: { name?: string; value?: string; orderable?: boolean }[] }
type Product = {
  id?: string
  name?: string
  longDescription?: string
  shortDescription?: string
  imageGroups?: { images?: { link?: string }[] }[]
  variationGroups?: Group[]
  variationAttributes?: Attribute[]
  c_color?: string
  c_connectivity?: string[]
  c_connectivityType?: string
  c_keyboardSize?: string
  c_switchType?: string
  c_discountedProductPrice?: number
  [key: `c_specificationAttribute${number}`]: string[] | undefined
}

/** The page's Next.js flight payload, as one string. */
export function flightOf(html: string) {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)]
    .map((m) => {
      try {
        return JSON.parse(`"${m[1]}"`) as string
      } catch {
        return ''
      }
    })
    .join('')
}

/** The JSON object starting at the first occurrence of `marker` (braces balanced, strings skipped). */
export function objectAt<T>(flight: string, marker: string): T | undefined {
  const at = flight.indexOf(marker)
  if (at < 0) return undefined
  let depth = 0
  let inString = false
  for (let i = at; i < flight.length; i++) {
    const c = flight[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(flight.slice(at, i + 1)) as T
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

const productOf = (html: string) =>
  objectAt<{ product: Product }>(flightOf(html), '{"product":{')?.product

const SIZE_TAG: Record<string, string> = {
  fullSize: '100%',
  tkl: '80%',
  mini: '60%',
  compact: '65%',
  '75': '75%',
}

export function read(url: string, html: string): OfficialProduct | undefined {
  const p = productOf(html)
  if (!p?.name) return undefined
  const offer = jsonLd(html).find((x) => x['@type'] === 'Product')?.offers as
    | { price?: number | string }
    | undefined
  const price = Number(offer?.price) || p.c_discountedProductPrice
  // The languages on offer sit next to the product in the payload, not inside it.
  const languages =
    p.variationAttributes?.find((a) => a.id === 'keyboardLanguage')?.values ??
    objectAt<Attribute>(flightOf(html), '{"id":"keyboardLanguage"')?.values ??
    []
  const variants: OfficialVariant[] = languages.map((l) => ({
    sku: `${p.id ?? ''}:${l.value ?? ''}`,
    color: p.c_color ? p.c_color[0]?.toUpperCase() + p.c_color.slice(1) : undefined,
    layout: l.name,
    price,
    available: !!l.orderable,
  }))

  const specs = Object.entries(p)
    .filter(([k]) => k.startsWith('c_specificationAttribute'))
    .flatMap(([, v]) => (Array.isArray(v) ? (v as string[]) : []))
    .map((line) => line.split('|||'))
    .filter(([, label, value]) => label && value)
  const spec = (re: RegExp) => specs.find(([, label]) => re.test(label ?? ''))?.[2]
  const mm = (s?: string) =>
    Math.round(Number(/(\d+(?:[.,]\d+)?)\s*mm/.exec(s ?? '')?.[1]?.replace(',', '.')))
  const width = mm(spec(/^largeur$/i))
  const depth = mm(spec(/^profondeur$/i))
  const height = mm(spec(/^hauteur$/i))
  // SteelSeries wireless boards link over Quantum 2.0 (2.4 GHz), Bluetooth on top for some.
  const connectivity = [
    ...(p.c_connectivity ?? []),
    ...(p.c_connectivityType === 'wireless' ? ['2.4 GHz Quantum 2.0'] : []),
  ].join(', ')
  const facts: Fact[] = [
    ...fact(
      'Connectivity',
      connectivity || (p.c_connectivityType === 'wireless' ? 'Wireless' : 'Wired'),
    ),
    ...fact('Weight', spec(/^poids$/i)),
    ...fact('Dimensions', width && depth ? `${width} x ${depth} x ${height || 0} mm` : undefined),
    ...fact('Backlighting', spec(/[ée]clairage/i)),
    ...fact('Switch Type', spec(/commutateurs|switch/i) ?? p.c_switchType),
    ...specs.map(([, label = '', value = '']) => ({ label, value })),
  ]
  const tags: string[] = []
  const size = SIZE_TAG[p.c_keyboardSize ?? '']
  if (size) tags.push(size)
  if (
    /omnipoint|hypermagnetic|magn[ée]tique|hall/i.test(`${p.c_switchType} ${spec(/commutateurs/i)}`)
  ) {
    tags.push('magnetic', 'rapid trigger')
  }
  if (/membrane|whisper/i.test(`${p.c_switchType} ${spec(/commutateurs/i)}`)) tags.push('membrane')
  const text = [p.shortDescription, p.longDescription]
    .map((h) => linesOf(parseHtml(h ?? '')).join(' '))
    .join('\n')
    .slice(0, 4000)
  const images: Picture[] = (p.imageGroups?.[0]?.images ?? [])
    .map((i) => i.link)
    .filter((l): l is string => !!l)
    .slice(0, 6)
    .map((src) => ({ src }))
  // "Apex Pro Mini - US", "Apex 3 FR", "Apex 3 TKL Aqua", "Apex 7 Red Switch FR" → the model
  // (Apex Pro Mini, Apex 3, Apex 3 TKL, Apex 7); a colourway in the name is the variants' colour.
  let name = (p.name.split(' - ')[0] ?? p.name)
    .replace(/\s+(FR|US|UK|DE|ND|NORDIC|INT)$/i, '')
    .replace(/\s+(red|brown|blue)\s+switch$/i, '')
    .trim()
  const colorway = /\s+(White|Black|Aqua|Lavender|Amethyst|Stealth|Pink|Ghost)$/i.exec(name)?.[1]
  if (colorway) {
    name = name.slice(0, -colorway.length).trim()
    for (const v of variants) v.color = colorway
  }
  if (p.c_connectivityType === 'wireless' && !/wireless|sans fil/i.test(name)) name += ' Wireless'
  return { url, name, facts, text, tags, variants, images }
}

async function familyUrls() {
  const xml = await get(`${ORIGIN}/fr-fr-sitemap-products.xml`)
  return [
    ...new Set(
      [...xml.matchAll(/<loc>(https:\/\/steelseries\.com\/fr-fr\/gaming-keyboards\/[^<?]+)/g)].map(
        (m) => m[1] ?? '',
      ),
    ),
  ]
}

async function models(): Promise<OfficialModel[]> {
  const out = new Map<string, OfficialModel>()
  for (const family of await familyUrls()) {
    const groups = productOf(await get(family))?.variationGroups ?? []
    for (const g of groups) {
      const v = g.variationValues ?? {}
      const query = new URLSearchParams({ ...v, keyboardLanguage: 'french' }).toString()
      const url = `${family}?${query}`
      const p = read(url, await get(url))
      if (!p?.variants.length) continue
      const slug = slugify(`steelseries ${p.name}`)
      // Colourways of a model are one model with several colours.
      const model = out.get(slug) ?? { brand: BRAND, name: p.name, slug, products: [] }
      model.products.push(p)
      out.set(slug, model)
    }
  }
  return [...out.values()]
}

export const source = officialSource({
  host: new URL(ORIGIN).host,
  label: 'steelseries.com/fr-fr (prix € et langues du site français)',
  intro: (brand) => [
    `# ${brand.name} : importés de steelseries.com (site français) par \`pnpm ingest steelseries\`.`,
  ],
  models,
  read,
})
