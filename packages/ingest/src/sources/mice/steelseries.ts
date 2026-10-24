import type { Brand, MouseRecord } from '@choose/catalog'
import { type Fact, linesOf, parseHtml } from '../../facts'
import { get } from '../../http'
import { slugify } from '../../text'
import { flightOf, objectAt } from '../steelseries'
import {
  type MouseModel,
  type MousePicture,
  type MouseVariant,
  mouseSource,
  type OfficialMouse,
  TOP,
} from './official'

// SteelSeries mice, from its French site (steelseries.com/fr-fr), read like its keyboards
// (sources/steelseries.ts). The product sitemap lists a page per variation of a family:
// /gaming-mice/prime?mouseSize=mini&connectivityType=wireless&model=Regular. What changes the
// mouse (size, shape, wired or wireless, Prime or Prime+) makes a product, read from its own page;
// its colours are its variants. A page carries its Salesforce product in the Next.js flight payload:
// the sheet as "Design|||Longueur|||125.3 mm" lines, the euro price, the photos.

const ORIGIN = 'https://steelseries.com'
const BRAND: Brand = {
  slug: 'steelseries',
  name: 'SteelSeries',
  website: 'https://steelseries.com',
}
/** A licensed edition of a mouse already listed (CS2 Dragon Lore). */
const NOT_A_MOUSE = /dragon-lore|cs2/i
/** The query parameters that make another mouse; `color` only makes a variant. */
const MODEL_PARAMS = ['mouseSize', 'mouse-shape', 'connectivityType', 'model']

type Shape = MouseRecord['specs']['shape']
type Product = {
  id?: string
  name?: string
  longDescription?: string
  shortDescription?: string
  imageGroups?: { viewType?: string; images?: { link?: string }[] }[]
  variationAttributes?: { id?: string; values?: { name?: string; value?: string }[] }[]
  c_color?: string
  c_connectivityType?: string
  c_mouseSize?: string
  c_discountedProductPrice?: number
  [key: `c_specificationAttribute${number}`]: string[] | undefined
}

const productOf = (html: string) =>
  objectAt<{ product: Product }>(flightOf(html), '{"product":{')?.product

/**
 * The sheet's "Group|||Label|||Value" lines as facts; a line with no value is its group's
 * ("Capteur|||SteelSeries TrueMove Pro+", "Contenu de la boîte|||Souris de jeu Prime+|||").
 */
function sheetOf(p: Product): Fact[] {
  return Object.entries(p)
    .filter(([k]) => k.startsWith('c_specificationAttribute'))
    .flatMap(([, v]) => (Array.isArray(v) ? (v as string[]) : []))
    .map((line) => line.split('|||').map((s) => s.trim()))
    .map(([group = '', label = '', value = '']) =>
      value ? { label, value } : { label: group, value: label },
    )
    .filter((f) => f.label && f.value)
}

/** Photos: the main view, then the half-width gallery, then the banners. */
function picturesOf(p: Product): MousePicture[] {
  const rank = (type = '') => (/primary/i.test(type) ? 0 : /half/i.test(type) ? 1 : 2)
  return [...(p.imageGroups ?? [])]
    .sort((a, b) => rank(a.viewType) - rank(b.viewType))
    .flatMap((g) => g.images ?? [])
    .map((i) => i.link)
    .filter((l): l is string => !!l)
    .slice(0, 8)
    .map((src) => ({ src }))
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** One variation's page read into a mouse; `colors` are the family's colours for this variation. */
export function read(url: string, html: string, colors: string[] = []): OfficialMouse | undefined {
  const p = productOf(html)
  if (!p?.name) return undefined
  const params = new URL(url).searchParams
  const facts = sheetOf(p)
  // A family sold only wireless (Rival 650, Aerox 3 Gen 2) names no connectivity: its name or its
  // box does. Its link is Quantum 2.0 (2.4 GHz) unless the sheet names another one.
  const wireless =
    (params.get('connectivityType') ?? p.c_connectivityType) === 'wireless' ||
    (!params.get('connectivityType') &&
      (/wireless|sans fil/i.test(p.name) ||
        facts.some((f) => /contenu/i.test(f.label) && /sans fil|wireless/i.test(f.value))))
  if (wireless && !facts.some((f) => /uwb|quantum|2[.,]4/i.test(`${f.label} ${f.value}`)))
    facts.push({ label: 'Connectivité', value: 'Sans fil Quantum 2.0 (2,4 GHz)' })
  if (!wireless && !facts.some((f) => /^connectivit/i.test(f.label)))
    facts.push({ label: 'Connectivité', value: 'Filaire' })

  // Licensed colourways (Fortnite) are left out, as the editions are; the plain colours remain.
  const colorOf = (c: string) =>
    p.variationAttributes?.find((a) => a.id === 'color')?.values?.find((v) => v.value === c)
      ?.name ?? capital(c)
  const colorNames = (
    colors.length ? colors : [p.c_color ?? params.get('color') ?? 'black']
  ).filter((c) => !/fortnite|edition|cs2/i.test(c))

  // "Aerox 3 Wireless Onyx": the page's colour is not part of the model's name.
  let name = (p.name.split(' - ')[0] ?? p.name).replace(/^SteelSeries\s+/i, '').trim()
  for (const c of [...colors, p.c_color ?? '']) {
    if (c) name = name.replace(new RegExp(`\\s+${colorOf(c)}$`, 'i'), '')
  }
  const size = params.get('mouseSize') ?? p.c_mouseSize
  if (size === 'mini' && !/mini/i.test(name)) name += ' Mini'
  if (wireless && !/wireless|sans fil/i.test(name)) name += ' Wireless'

  const price = p.c_discountedProductPrice
  const variants: MouseVariant[] = colorNames.map((c) => ({
    sku: `${p.id ?? ''}:${c}`,
    color: colorOf(c),
    price,
    available: true,
  }))
  const shape = params.get('mouse-shape') as Shape | null
  const text = [p.shortDescription, p.longDescription]
    .map((h) => linesOf(parseHtml(h ?? '')).join('\n'))
    .join('\n')
  return {
    url,
    name,
    modelNumber: p.id,
    facts,
    text,
    // The Sensei Ten's side buttons sit on both sides: a true ambidextrous mouse. The Sensei Pro's
    // sit on the left only: the mapper reads it as a right-hand mouse with an ambidextrous shell.
    hints: {
      segment: 'gaming',
      shape: shape ?? undefined,
      hand: /sensei(?! pro)/i.test(name) ? 'ambidextrous' : undefined,
    },
    variants,
    images: picturesOf(p),
  }
}

/** The sitemap's mouse pages, grouped by variation: the page to read and its colours. */
async function variations() {
  const xml = await get(`${ORIGIN}/fr-fr-sitemap-products.xml`)
  const groups = new Map<string, { url: string; colors: string[] }>()
  for (const m of xml.matchAll(
    /<loc>(https:\/\/steelseries\.com\/fr-fr\/gaming-mice\/[^<]+)<\/loc>/g,
  )) {
    const url = new URL((m[1] ?? '').replace(/&amp;/g, '&'))
    if (NOT_A_MOUSE.test(url.pathname)) continue
    const key = [
      url.pathname,
      ...MODEL_PARAMS.map((k) => `${k}=${url.searchParams.get(k) ?? ''}`),
    ].join('|')
    const group = groups.get(key) ?? { url: url.toString(), colors: [] }
    const color = url.searchParams.get('color')
    if (color && !group.colors.includes(color)) group.colors.push(color)
    groups.set(key, group)
  }
  return [...groups.values()]
}

async function models(): Promise<MouseModel[]> {
  const out: MouseModel[] = []
  for (const { url, colors } of await variations()) {
    const mouse = read(url, await get(url), colors)
    if (!mouse) continue
    // "Prime+" is not the Prime: its slug says plus.
    const slug = slugify(`steelseries ${mouse.name.replace(/\+/g, ' plus')}`)
    out.push({ brand: BRAND, slug, read: async () => mouse })
  }
  return out.slice(0, TOP)
}

export const source = mouseSource({
  host: new URL(ORIGIN).host,
  label: 'steelseries.com/fr-fr (prix € du site français)',
  intro: (brand) => [
    `# ${brand.name} : souris importées de steelseries.com (site français) par \`pnpm ingest steelseries-mice\`.`,
  ],
  models,
  read: (url, html) => read(url, html),
})
