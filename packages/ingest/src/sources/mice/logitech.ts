import type { Brand, MouseRecord } from '@choose/catalog'
import type { Fact } from '../../facts'
import { get } from '../../http'
import { slugify } from '../../text'
import { decodeJs, modelKey } from '../logitech'
import { jsonLd } from '../official'
import {
  type MouseModel,
  type MousePicture,
  type MouseVariant,
  mouseSource,
  type OfficialMouse,
  TOP,
} from './official'

// Logitech mice, from its French sites: logitechg.com (gaming) and logitech.com (office, vertical
// mice, trackballs). The pages are built like the keyboards' (sources/logitech.ts):
// - the category page links every mouse, and a "for Mac" page is the same model;
// - the schema.org Product lists every SKU with its euro price (a promotion shows the regular price
//   struck through);
// - the serialized state gives each SKU its facets: its colour and, on a page that sells a family,
//   its size or type ("Signature M650 L pour main gauche", "Lift Left"): each is a product;
// - the spec sheet is serialized as facets, `facet:"Poids",value:"60 g"` and, on the gaming pages,
//   `facet:"Capteur",values:[{value:"HERO 2"}]`. Office sheets call the length "Hauteur" and the
//   height "Épaisseur", and give the receiver's measurements after the mouse's.
// The shape is on none of the pages: it is the range's, from the table below.

const BRAND: Brand = { slug: 'logitech', name: 'Logitech', website: 'https://www.logitech.com' }

type Shape = MouseRecord['specs']['shape']
type Site = { origin: string; category: string; segment: 'gaming' | 'office' }

const SITES = {
  'logitechg-mice': {
    origin: 'https://www.logitechg.com',
    category: '/fr-fr/shop/c/gaming-mice',
    segment: 'gaming',
  },
  'logitech-mice': {
    origin: 'https://www.logitech.com',
    category: '/fr-fr/shop/c/mice',
    segment: 'office',
  },
} satisfies Record<string, Site>

/** Keyboards and accessories in the lists, and limited editions of a model already listed. */
const NOT_A_MOUSE =
  /keyboard|clavier|combo|tapis|mouse-?pad|skates|patins|dongle|receiver|recepteur|-se$|-cyan$/i

/** The ranges' shapes; the others (PRO, G305, G309, MX Anywhere, Pebble, POP, M240…) are symmetrical. */
const SHAPES: [RegExp, Shape][] = [
  [/vertical|\blift\b/i, 'vertical'],
  [/trackball|\bm575|mx ergo/i, 'trackball'],
  [
    /g502|g402|\bdex\b|mx master|signature|m650|m750|m850|comfort|m720|triathlon|m705|m500/i,
    'ergonomic',
  ],
]
const shapeOf = (name: string, url: string): Shape =>
  SHAPES.find(([re]) => re.test(`${name} ${url}`))?.[1] ?? 'symmetrical'

type Pair = { label: string; value: string }

const same = (a: Pair | undefined, b: Pair | undefined) =>
  !!a && !!b && a.label === b.label && a.value === b.value

/** The spec sheet in page order: `facet:"…",value:"…"` and `facet:"…",values:[{value:"…"}…]`. */
function sheetOf(html: string): Pair[] {
  const out: Pair[] = []
  for (const m of html.matchAll(
    /facet:"((?:[^"\\]|\\.)*)",(?:value:"((?:[^"\\]|\\.)*)"|values:\[(.*?)\])/g,
  )) {
    let label = decodeJs(m[1] ?? '').trim()
    let value = (
      m[2] != null
        ? decodeJs(m[2])
        : [...(m[3] ?? '').matchAll(/value:"((?:[^"\\]|\\.)*)"/g)]
            .map((v) => decodeJs(v[1] ?? ''))
            .join(', ')
    ).trim()
    // Some sheets put the value in the label: "Valeur maximale: Jusqu'à 4000", "Autonomie: 24 mois".
    const glued = value ? null : /^([^:]{2,40}?)\s*:\s*(\S.*)$/.exec(label)
    if (glued) [label, value] = [glued[1] ?? label, glued[2] ?? '']
    out.push({ label, value })
  }
  // The state repeats the sheet: it ends where its first pairs come again (not where a figure
  // does: "M850 L (avec pile)" and "(sans pile)" share their measurements).
  const end = out.findIndex(
    (p, i) => i > 0 && same(p, out[0]) && same(out[i + 1], out[1]) && same(out[i + 2], out[2]),
  )
  return end > 0 ? out.slice(0, end) : out
}

const MEASURE = /^(hauteur|largeur|longueur|[ée]paisseur|profondeur)$/i
const WEIGHT = /^poids$/i
/** Groups whose figures are not the mouse's own ("Récepteur USB"; not "M850 L - récepteur non inclus"). */
const NOT_THE_MOUSE =
  /r[ée]cepteur|receiver|dongle|avec plaque|with plate|c[âa]ble|socle|station|base/i
const notTheMouse = (heading: string) =>
  NOT_THE_MOUSE.test(
    heading.replace(/r[ée]cepteur (usb )?non inclus|sans r[ée]cepteur|receiver not included/gi, ''),
  )

type Group = { heading: string; pairs: Pair[] }

/**
 * The measurement groups after "Dimensions" (a heading: the model, "Souris", "Récepteur USB";
 * then its figures), and where that section of the sheet starts and ends.
 */
function measureGroups(sheet: Pair[]): { groups: Group[]; start: number; end: number } {
  const start = sheet.findIndex((p) => /^dimensions$/i.test(p.label))
  if (start < 0) return { groups: [], start: 0, end: 0 }
  const groups: Group[] = [{ heading: 'Dimensions', pairs: [] }]
  let end = start + 1
  for (; end < sheet.length; end++) {
    const p = sheet[end] as Pair
    const figure = MEASURE.test(p.label) || WEIGHT.test(p.label)
    const group = groups[groups.length - 1]
    if (figure && p.value && group) group.pairs.push(p)
    else if (!p.value) groups.push({ heading: p.label, pairs: [] })
    else break
  }
  return {
    groups: groups.filter((g) => g.pairs.length && !notTheMouse(g.heading)),
    start,
    end,
  }
}

const norm = (s: string) => slugify(s)
/** The words a size adds to a family's name: "Signature M650 L", "M750L". */
const SIZE = /^(l|xl|s|m|large|small|medium|mini)(-|$)/

/**
 * How a group's heading relates to the product: its own ("Signature M650 L" for "Signature M650
 * L pour main gauche"), another size of its family ("Signature Plus M750" for the "M750L"), or
 * neither ("Souris (avec pile)").
 */
function relation(heading: string, label: string): 'own' | 'sibling' | undefined {
  const [h, l] = [norm(heading), norm(label)]
  if (h === l) return 'own'
  const [short, long] = h.length < l.length ? [h, l] : [l, h]
  if (!long.startsWith(short)) return undefined
  const rest = long.slice(short.length)
  if (!rest.startsWith('-')) return 'sibling'
  return SIZE.test(rest.slice(1)) ? 'sibling' : 'own'
}

/**
 * The mouse's measurements and weight, as the mapper reads them: from the group named after the
 * product (a family page), else the first one with measurements, with its battery when a group
 * says so ("M850 L (avec pile)", "(sans pile)"); the weight from that group or from the next one
 * ("Souris (sans plaque métallique)"). Office pages call the length "Hauteur".
 */
function measuresOf(groups: Group[], label: string | undefined): Fact[] {
  const withSize = groups.filter((g) => g.pairs.some((p) => MEASURE.test(p.label)))
  const of = (g: Group) => (label ? relation(g.heading, label) : undefined)
  const named = withSize
    .filter((g) => of(g) === 'own')
    .sort((a, b) => b.heading.length - a.heading.length)[0]
  // A sheet that measures another size of the family only: none of its figures is the product's.
  if (!named && withSize.some((g) => of(g) === 'sibling')) return []
  const chosen =
    named ?? withSize.find((g) => !/sans pile|without batter/i.test(g.heading)) ?? withSize[0]
  if (!chosen) return []
  const at = groups.indexOf(chosen)
  const weight =
    chosen.pairs.find((p) => WEIGHT.test(p.label)) ??
    groups
      .slice(at + 1)
      .find((g) => !g.pairs.some((p) => MEASURE.test(p.label)))
      ?.pairs.find((p) => WEIGHT.test(p.label))
  const office = chosen.pairs.some((p) => /^[ée]paisseur$/i.test(p.label))
  const rename = (l: string) =>
    office ? (/^hauteur$/i.test(l) ? 'Longueur' : /^[ée]paisseur$/i.test(l) ? 'Hauteur' : l) : l
  return [
    ...chosen.pairs
      .filter((p) => MEASURE.test(p.label))
      .map((p) => ({ label: rename(p.label), value: p.value })),
    ...(weight ? [weight] : []),
  ]
}

/** The rest of the sheet (all but its measurements), worded the way the mapper reads it. */
function otherFacts(sheet: Pair[], measures: { start: number; end: number }): Fact[] {
  const out: Fact[] = []
  const rest = [...sheet.slice(0, measures.start), ...sheet.slice(measures.end)]
  for (const p of rest) {
    if (!p.value) continue
    if (/^mouvement constant$/i.test(p.label)) out.push({ label: 'Autonomie', value: p.value })
    else if (/^valeur (nominale|maximale|minimale et maximale)$/i.test(p.label))
      out.push({ label: 'Résolution', value: p.value })
    // "Switchs hybrides LIGHTFORCE : Oui": the label says it all.
    else if (/^oui$/i.test(p.value) && /switch|commutateur|interrupteur/i.test(p.label))
      out.push({ label: 'Type de switch', value: p.label })
    else out.push(p)
  }
  // Office sheets count the buttons in a heading: "4 boutons personnalisables (…)".
  const counts = (f: Fact) =>
    /bouton|commande/i.test(f.label) && /\d/.test(f.value) && !/million|clics/i.test(f.value)
  if (!out.some(counts)) {
    const counted = sheet.find((p) => /^\d+ (boutons|(programmable )?buttons)/i.test(p.label))
    if (counted) out.push({ label: 'Nombre de boutons', value: counted.label })
  }
  return out
}

type SkuRecord = {
  name: string
  subtitle: string
  description: string
  facets: Record<string, string>
}

/** Every SKU's record in the serialized state: its name, subtitle, description and facet labels. */
function skuRecords(html: string) {
  const records = new Map<string, SkuRecord>()
  const starts = [...html.matchAll(/"(\d{3}-\d{6})":\{name:"/g)]
  starts.forEach((m, i) => {
    const sku = m[1] ?? ''
    if (records.has(sku)) return
    const chunk = html.slice(m.index, starts[i + 1]?.index ?? m.index + 20_000)
    const str = (key: string) =>
      decodeJs(new RegExp(`\\b${key}:"((?:[^"\\\\]|\\\\.)*)"`).exec(chunk)?.[1] ?? '')
    const facets: Record<string, string> = {}
    const block = /facets:\{((?:\w+:\{[^{}]*\},?)*)\}/.exec(chunk)?.[1] ?? ''
    for (const f of block.matchAll(/(\w+):\{label:"((?:[^"\\]|\\.)*)"/g)) {
      facets[f[1] ?? ''] = decodeJs(f[2] ?? '')
    }
    records.set(sku, {
      name: str('name'),
      subtitle: str('subtitle'),
      description: str('description'),
      facets,
    })
  })
  return records
}

/** "Souris Bluetooth M240 Silent" → "M240 Silent"; "MX Master 4 pour Mac" → "MX Master 4". */
const cleanName = (name: string) =>
  name
    .replace(/\s+(pour|for) Mac$/i, '')
    .replace(
      /^souris\s+((gaming|sans fil|filaire|bluetooth|ergonomique|verticale|silencieuse|avanc[ée]e)\s+)*/i,
      '',
    )
    .trim()

/** The bracketed block that opens at `open` ("[…]" or "{…}"), strings skipped. */
function blockAt(html: string, open: number): string {
  let depth = 0
  for (let i = open; i < html.length; i++) {
    const c = html[i]
    if (c === '"') {
      // A string, escaped quotes included, holds no brackets that count.
      for (i++; i < html.length && html[i] !== '"'; i++) if (html[i] === '\\') i++
    } else if (c === '[' || c === '{') depth++
    else if ((c === ']' || c === '}') && --depth === 0) return html.slice(open, i + 1)
  }
  return html.slice(open)
}

/** What the box holds ("Souris, Récepteur USB-C Bolt, Documentation"): a receiver is proof of a 2.4 GHz link. */
function boxContents(html: string): string | undefined {
  const at = html.indexOf('packageContents:{')
  if (at < 0) return undefined
  const items = [...blockAt(html, html.indexOf('{', at)).matchAll(/\bitem:"((?:[^"\\]|\\.)*)"/g)]
    .map((m) => decodeJs(m[1] ?? '').trim())
    .filter(Boolean)
  return items.length ? `Contenu du coffret : ${items.join(', ')}` : undefined
}

/** The key features' titles and copy: the battery life or the silent clicks are sometimes only there. */
function keyFeatures(html: string): string[] {
  const at = html.indexOf('keyFeatures:{items:[')
  if (at < 0) return []
  const block = blockAt(html, html.indexOf('[', at))
  return [...block.matchAll(/\b(?:title|description):"((?:[^"\\]|\\.)*)"/g)].map((m) =>
    decodeJs(m[1] ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

/** Gallery photos of the page, the views from above first; banners and lifestyle shots left out. */
function picturesOf(html: string, product: Record<string, unknown>): MousePicture[] {
  const listed = (product.image as string[] | undefined) ?? []
  const gallery = [
    ...html.matchAll(
      /(https:\/\/resource\.logitechg?\.com\/[^"\s)\\]+?-gallery-[^"\s)\\]+?\.png)/g,
    ),
  ].map((m) => m[1] ?? '')
  // The same file comes under several URLs (resizing options, layout suffix): one each.
  const seen = new Set<string>()
  const all = [...listed, ...gallery].filter((src) => {
    const file = src.replace(/^.*\/content\/dam\//, '')
    if (seen.has(file) || /banner|lifestyle|videocard|award|thumbnail|in-the-box/i.test(src))
      return false
    seen.add(file)
    return true
  })
  const rank = (src: string) => (/\btop\b|-top-/i.test(src) ? 0 : /profile|side/i.test(src) ? 1 : 2)
  return all
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 8)
    .map((src) => ({ src }))
}

/** One page read into its products: one, or one per size or type of a family page. */
export function readAll(url: string, html: string, site: Site): OfficialMouse[] {
  const product = jsonLd(html).find((x) => x['@type'] === 'Product')
  if (!product) return []
  const pageName = cleanName(String(product.name ?? ''))
  const sheet = sheetOf(html)
  const measures = measureGroups(sheet)
  const groups = measures.groups
  const others = otherFacts(sheet, measures)
  const records = skuRecords(html)
  const meta = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? ''
  const headings = sheet.filter((p) => !p.value || /^oui$/i.test(p.value)).map((p) => p.label)
  const pictures = picturesOf(html, product)
  const features = keyFeatures(html)
  const box = boxContents(html)

  type Offer = {
    price?: number | string
    availability?: string
    priceSpecification?: { priceType?: string; price?: number | string }
  }
  const skus = ((product.model as Record<string, unknown>[] | undefined) ?? []).map((m) => {
    const sku = String(m.sku ?? '')
    const offer = (m.offers ?? {}) as Offer
    const record = records.get(sku)
    const variant: MouseVariant = {
      sku,
      color: record?.facets.color ?? (m.color ? String(m.color) : undefined),
      price: Number(offer.price) || undefined,
      regularPrice: /Strikethrough/i.test(offer.priceSpecification?.priceType ?? '')
        ? Number(offer.priceSpecification?.price) || undefined
        : undefined,
      available: /InStock|LimitedAvailability|PreOrder/i.test(String(offer.availability ?? '')),
    }
    // A family page tells its products apart by a size or a type facet.
    return { variant, record, family: record?.facets.size ?? record?.facets.type }
  })
  const families = [...new Set(skus.map((s) => s.family).filter((f): f is string => !!f))]
  const parts = families.length > 1 ? families : [undefined]

  return parts.map((family) => {
    const mine = skus.filter((s) => !family || s.family === family)
    const name = family ? cleanName(family) : pageName
    const own = [
      ...new Set(mine.flatMap((s) => [s.record?.subtitle ?? '', s.record?.description ?? ''])),
    ].filter(Boolean)
    return {
      url,
      name,
      modelNumber: mine[0]?.variant.sku,
      facts: [...measuresOf(groups, family ?? pageName), ...others],
      text: [meta, ...own, ...features, box, headings.join(' ; ')].filter(Boolean).join('\n'),
      hints: { segment: site.segment, shape: shapeOf(name, url) },
      variants: mine.map((s) => s.variant),
      images: pictures,
    }
  })
}

async function models(site: Site): Promise<MouseModel[]> {
  const list = await get(`${site.origin}${site.category}`)
  // One page per model: a "for Mac" page sells the same mouse.
  const pages = new Map<string, string>()
  for (const m of list.matchAll(/href="(\/fr-fr\/shop\/p\/[^"#?]+)"/g)) {
    const path = m[1] ?? ''
    if (NOT_A_MOUSE.test(path.replace(/\.\d{3}-\d{6}$/, ''))) continue
    const key = modelKey(path)
    if (!pages.has(key)) pages.set(key, `${site.origin}${path}`)
  }
  const out: MouseModel[] = []
  for (const url of pages.values()) {
    for (const mouse of readAll(url, await get(url), site)) {
      if (!mouse.variants.length) continue
      out.push({
        brand: BRAND,
        slug: slugify(`logitech ${mouse.name}`),
        read: async () => mouse,
      })
    }
  }
  return out.slice(0, TOP)
}

const sourceFor = (id: keyof typeof SITES) => {
  const site: Site = SITES[id]
  return mouseSource({
    host: new URL(site.origin).host,
    label: `${new URL(site.origin).host}/fr-fr (prix € du site français)`,
    intro: (brand) => [
      `# ${brand.name} : souris importées de logitechg.com et logitech.com (sites français) par \`pnpm ingest logitechg-mice\` et \`logitech-mice\`.`,
      '# La forme (symétrique, ergonomique, verticale, trackball) est celle de la gamme : les pages ne la disent pas.',
    ],
    models: () => models(site),
    // The weekly refresh prices every SKU of the page, whichever product of a family it belongs to.
    read: (url, html) => {
      const all = readAll(url, html, site)
      const [first] = all
      return first && { ...first, variants: all.flatMap((m) => m.variants) }
    },
  })
}

export const sources = {
  'logitechg-mice': sourceFor('logitechg-mice'),
  'logitech-mice': sourceFor('logitech-mice'),
}
