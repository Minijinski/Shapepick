import type { Brand, MouseRecord } from '@choose/catalog'
import { type Fact, linesOf, parseHtml } from '../../facts'
import { get } from '../../http'
import { hzOf } from '../../mapping'
import { slugify } from '../../text'
import { scriptJson } from '../official'
import { productUrls } from '../razer'
import {
  type MouseModel,
  type MousePicture,
  type MouseVariant,
  mouseSource,
  type OfficialMouse,
  TOP,
} from './official'

// Razer mice, from its French site (razer.com/fr-fr), read like its keyboards (sources/razer.ts):
// the French product sitemap lists one URL per SKU under /fr-fr/gaming-mice/<model>/<SKU>, and a
// product page carries its SAP Commerce state (<script id="ng-state">):
// - the spec sheet, classification "mice-mice-specifications": size, weight without cable, battery
//   life at each report rate, shape, sensor, buttons, tilt wheel, lighting, dock, box contents (the
//   "mice-facets" one only buckets it for the shop's filters: "Poids : < 80g");
// - in baseOptions, every SKU of the model with its euro price: colours, special and licensed
//   editions, bundles with a dock, a mat or a dongle, and on some pages a "Polling rate maximum"
//   (DeathAdder V3 Pro at 1000 or 8000 Hz): each rate is a product.
// A bundle's page (RZHB-…) may lack the sheet: the model's own SKU pages are read first.

const BRAND: Brand = { slug: 'razer', name: 'Razer', website: 'https://www.razer.com' }
/** Collector editions, not a mouse one chooses among others (Boomslang 20th Anniversary, 1 337 €). */
const NOT_A_MOUSE = /anniversary|collector/i

type Shape = MouseRecord['specs']['shape']
/** The ranges' shapes: the sheet's "Forme" often only says "Droitier". */
const SHAPES: [RegExp, Shape][] = [
  [/vertical/i, 'vertical'],
  [/deathadder|basilisk|naga|pro click/i, 'ergonomic'],
  [/viper|cobra|orochi|boomslang/i, 'symmetrical'],
]

type Category = { parentCategoryName?: string; name?: string }
type Image = { url?: string; altText?: string; format?: string }
type Option = {
  code?: string
  name?: string
  priceData?: { value?: number }
  stock?: { stockLevel?: number; stockLevelStatus?: string }
  categories?: Category[]
  images?: Image[]
}
type Feature = { code?: string; name?: string; featureValues?: { value?: string }[] }
type Product = Option & {
  baseProductName?: string
  summary?: string
  description?: string
  classifications?: { code?: string; features?: Feature[] }[]
  baseOptions?: { options?: Option[] }[]
  images?: Record<string, (Record<string, Image> | null)[]>
}

const lines = (html: string) => linesOf(parseHtml(html))
const cat = (o: Option, re: RegExp) =>
  o.categories?.find((c) => re.test(c.parentCategoryName ?? ''))?.name
const absolute = (url: string) =>
  url.startsWith('http') ? url : `https://assets2.razerzone.com${url}`

function productOf(html: string): Product | undefined {
  const state = scriptJson(html, 'ng-state') as
    | {
        'cx-state'?: {
          product?: { details?: { entities?: Record<string, Record<string, { value?: Product }>> } }
        }
      }
    | undefined
  const scopes = Object.values(state?.['cx-state']?.product?.details?.entities ?? {})[0] ?? {}
  return scopes.default?.value ?? scopes.variants?.value
}

/** "Jusqu'à 17 heures à 8 000 Hz" → 8000. */
const ratesIn = (s: string) =>
  [...s.replace(/(\d)[\s ](\d{3})\b/g, '$1$2').matchAll(/(\d{3,4})\s*hz/gi)].map((m) =>
    Number(m[1]),
  )
/** A rate that needs what the box lacks: "(HyperPolling Wireless Dongle) vendus séparément", "8 000 Hz*". */
const CONDITIONAL = /s[ée]par[ée]ment|separately|compatible|\*/i

/**
 * The report rate the mouse reaches as sold: its SKUs' "Polling rate maximum" when the page sells
 * several, else the highest its battery lines (then its copy) give without a condition: any
 * wireless mouse does 1 000 Hz, more needs no dongle or dock sold apart.
 */
function pollingOf(family: string | undefined, battery: string[], copy: string[]) {
  if (family) return hzOf(family)
  for (const said of [battery, copy]) {
    const rates = said.flatMap((l) => ratesIn(l).filter((hz) => hz <= 1000 || !CONDITIONAL.test(l)))
    if (rates.length) return Math.max(...rates)
  }
  return undefined
}

/** The colour of a SKU, its finish when it is not the usual one ("Noir, Toucher lisse"). */
function colorOf(o: Option, picture: string | undefined): string | undefined {
  const texture = cat(o, /texture/i)
  const color =
    cat(o, /couleur/i) ??
    // A model sold in one colour names none: its packshot's file does ("…-black-500x500.png").
    { black: 'Noir', white: 'Blanc' }[/-(black|white)-/.exec(picture ?? '')?.[1] ?? '']
  return [color, texture && !/classi/i.test(texture) ? texture : undefined]
    .filter(Boolean)
    .join(', ')
}

/** One page read into its products: one, or one per report rate the page sells. */
export function readAll(url: string, html: string): OfficialMouse[] {
  const p = productOf(html)
  const sheet = (p?.classifications ?? [])
    .filter((c) => !/facets/i.test(c.code ?? ''))
    .flatMap((c) => c.features ?? [])
    .filter((f) => !/safety|ressources/i.test(`${f.code} ${f.name}`))
  if (!p?.name || !sheet.length) return []

  const value = (f: Feature) =>
    (f.featureValues ?? []).flatMap((v) => lines(v.value ?? '')).join(' ; ')
  const facts: Fact[] = sheet
    .map((f) => ({ label: f.name ?? '', value: value(f) }))
    .filter((f) => f.label && f.value)
  const battery = facts
    .filter((f) => /autonomie/i.test(f.label))
    .flatMap((f) => f.value.split(' ; '))
  const copy = [p.summary ?? '', ...lines(p.description ?? '')].filter(Boolean)
  const base = (p.baseProductName ?? p.name.split(' - ')[0] ?? p.name).replace(/^Razer\s+/i, '')

  // Bundles (a dock, a mat, a dongle beside the mouse) are not the mouse; nor, where the model
  // comes in plain colours, its special and licensed editions ("Faker Edition", "Pokémon Edition").
  const options = (p.baseOptions ?? []).flatMap((b) => b.options ?? [])
  const own = (options.length ? options : [p]).filter((o) => !/bundle|\s\+\s/i.test(o.name ?? ''))
  const plain = own.filter((o) => !/edition/i.test(cat(o, /couleur/i) ?? ''))
  const sold = plain.length ? plain : own
  const packshot = (o: Option) => o.images?.find((i) => i.format === 'product')?.url

  // Photos: the gallery's view from above, each colour's packshot, then the rest of the gallery.
  const gallery = (p.images?.GALLERY ?? [])
    .map((g) => g?.zoom ?? g?.product)
    .filter((i): i is Image => !!i?.url)
  const top = gallery.filter((i) => /top view|vue de dessus/i.test(i.altText ?? ''))
  const pictures: MousePicture[] = [
    ...new Set(
      [
        ...top.map((i) => i.url),
        ...sold.map(packshot),
        ...gallery.filter((i) => !top.includes(i)).map((i) => i.url),
      ].filter((u): u is string => !!u),
    ),
  ]
    .slice(0, 8)
    .map((src) => ({ src: absolute(src) }))

  const rate = (o: Option) => cat(o, /polling/i)
  const rates = [...new Set(sold.map(rate).filter((r): r is string => !!r))].sort(
    (a, b) => (hzOf(a) ?? 0) - (hzOf(b) ?? 0),
  )
  const families = rates.length > 1 ? rates : [undefined]
  return families.map((family, i) => {
    const mine = sold.filter((o) => !family || rate(o) === family)
    const name = i === 0 ? base : `${base} ${hzOf(family ?? '')} Hz`
    const polling = pollingOf(family, battery, copy)
    const variants: MouseVariant[] = mine.map((o) => ({
      sku: o.code,
      color: colorOf(o, packshot(o)),
      price: o.priceData?.value,
      available:
        (o.stock?.stockLevel ?? 0) > 0 || /inStock|lowStock/i.test(o.stock?.stockLevelStatus ?? ''),
    }))
    return {
      url,
      name,
      modelNumber: mine[0]?.code,
      facts: [
        ...facts,
        ...(polling ? [{ label: 'Taux d’interrogation', value: `${polling} Hz` }] : []),
      ],
      text: copy.join('\n'),
      hints: {
        segment: /pro click/i.test(base) ? 'office' : 'gaming',
        shape: SHAPES.find(([re]) => re.test(base))?.[1],
      },
      variants,
      images: pictures,
    }
  })
}

async function models(): Promise<MouseModel[]> {
  const out: MouseModel[] = []
  for (const urls of (await productUrls('gaming-mice', NOT_A_MOUSE)).values()) {
    // The model's own SKU pages first: a bundle's page may lack the sheet.
    const pages = [...new Set(urls)].sort(
      (a, b) => Number(/\/RZHB-/i.test(a)) - Number(/\/RZHB-/i.test(b)),
    )
    for (const url of pages) {
      const mice = readAll(url, await get(url))
      if (!mice.some((m) => m.variants.length)) continue
      for (const mouse of mice) {
        out.push({ brand: BRAND, slug: slugify(`razer ${mouse.name}`), read: async () => mouse })
      }
      break
    }
  }
  return out.slice(0, TOP)
}

export const source = mouseSource({
  host: 'www.razer.com',
  label: 'razer.com/fr-fr (prix € du site français)',
  intro: (brand) => [
    `# ${brand.name} : souris importées de razer.com (site français) par \`pnpm ingest razer-mice\`.`,
    '# Packs et éditions spéciales écartés ; une fréquence vendue à part (DeathAdder V3 Pro 8000 Hz) est un produit.',
  ],
  models,
  // The weekly refresh prices every SKU of the page, whichever product of the page it belongs to.
  read: (url, html) => {
    const all = readAll(url, html)
    const [first] = all
    return first && { ...first, variants: all.flatMap((m) => m.variants) }
  },
})
