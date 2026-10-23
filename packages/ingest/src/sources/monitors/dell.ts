import type { Brand } from '@choose/catalog'
import { type Fact, parseHtml } from '../../facts'
import { get } from '../../http'
import { clean } from '../../monitor-specs'
import { Skip } from '../../source'
import { slugify } from '../../text'
import { jsonLd } from '../official'
import { type MonitorModel, monitorSource, type OfficialMonitor } from './official'

// Dell (Alienware included), from its French shop. No sitemap lists the monitors: the listing
// (12 a page, 8 pages) does. A product page carries its sheet (`.spec__item` rows under
// #accessoriesTechSpecs, verbose and repetitive), the reference, MPN and UPC in JSON-LD, its price
// in doubly escaped JSON (`dellPrice`, `marketPrice` when on sale) and a gallery on i.dell.com
// (`…-gallery-1.psd`, under media-gallery/ or mg/) whose first photo is a three-quarter view:
// the photo picker judges them all. A model also sold
// without its stand (`_wost`) is the same monitor.

const ORIGIN = 'https://www.dell.com'
const LISTING = `${ORIGIN}/fr-fr/shop/moniteurs/sac/monitors`
const BRAND: Brand = { slug: 'dell', name: 'Dell', website: 'https://www.dell.com' }

/** The page's escaped JSON made readable: \\u0022 → ", \\u20AC → €. */
const unescaped = (s: string) =>
  s
    .replace(/\\+u0022/g, '"')
    .replace(/\\+u20AC/gi, '€')
    .replace(/\\+u0026/g, '&')
    .replace(/&quot;/g, '"')

const euros = (s: string | undefined) => {
  if (!s) return undefined
  const v = Number(s.replace(/[^\d,]/g, '').replace(',', '.'))
  return v > 0 ? v : undefined
}

/** Dell's own words for the stand, renamed: "Pivotant" turns left-right, "Pivot" goes portrait. */
function standFacts(facts: Fact[]): Fact[] {
  const out: Fact[] = []
  for (const f of facts) {
    if (/^angle d'oscillation$/i.test(f.label)) {
      // The same label serves both turns: ±90° is the portrait pivot.
      const widest = Math.max(...[...f.value.matchAll(/(\d+)\s*°/g)].map((m) => Number(m[1])), 0)
      out.push({ label: widest >= 80 ? 'Pivot' : 'Swivel', value: f.value })
    } else if (/^réglage du pied$/i.test(f.label)) {
      if (/hauteur/i.test(f.value)) out.push({ label: 'Height adjustment', value: 'Oui' })
      if (/\bpivot\b/i.test(f.value)) out.push({ label: 'Pivot', value: 'Oui' })
      if (/pivotant/i.test(f.value)) out.push({ label: 'Swivel', value: 'Oui' })
    } else {
      out.push(f)
    }
  }
  return out
}

/**
 * "Alienware" + AW3225QF + 32 → Alienware AW3225QF 32"; "Dell Pro" + P2725DE → Pro P2725DE 27".
 * Dell's entry range, « Base », is not in its product names, and the letter of « Pro P » is the
 * model's first: "Pro P" + P2726H → Pro P2726H 27".
 */
function dellName(line: string | undefined, model: string, size: string | undefined) {
  const range = (line ?? '')
    .replace(/^Dell\s*/i, '')
    .replace(/^Base$/i, '')
    .replace(/\s+([A-Z])$/, (letter, first) => (model.startsWith(first) ? '' : letter))
    .trim()
  return [range, model, size && `${size}"`].filter(Boolean).join(' ')
}

export function read(url: string, html: string): OfficialMonitor | undefined {
  const product = jsonLd(html).find((d) => d['@type'] === 'Product' && d.sku) as
    | { name?: string; sku?: string; gtin?: string; mpn?: string }
    | undefined
  // Some pages have no JSON-LD at all: the product id is in the URL, the rest in the sheet.
  const sku = product?.sku ?? /\/apd\/[^/]+\/([^/]+)\/-$/.exec(url)?.[1]
  const at = html.indexOf('accessoriesTechSpecs')
  if (!sku || at < 0) return undefined
  const root = parseHtml(html.slice(at, at + 400_000))
  const raw: Fact[] = []
  for (const item of root.querySelectorAll('.spec__item')) {
    const title = item.querySelector('.spec__item__title')
    if (!title) continue
    const label = clean(title.text)
    const value = clean(item.text.slice(item.text.indexOf(title.text) + title.text.length))
    if (label && value) raw.push({ label, value })
  }
  const facts = standFacts(raw)
  const factOf = (label: string) => raw.find((f) => f.label === label)?.value
  const model = factOf('Modèle de produit') ?? sku.split('_')[0]?.toUpperCase()
  if (!model) return undefined
  const size = /(\d{2})\s*"/.exec(factOf("Classe de taille d'écran") ?? '')?.[1]

  const json = unescaped(html)
  const today = euros(/"dellPrice":"([^"]+)"/.exec(json)?.[1])
  const regular = euros(/"marketPrice":"([^"]+)"/.exec(json)?.[1])
  const available = /"stockstatus":"available"/i.test(json)
  const gallery: string[] = []
  for (const m of html.matchAll(
    /\/\/i\.dell\.com\/is\/image\/DellContent\/+content\/dam\/ss2\/product-images\/[^"'\s\\?]+?-gallery-\d+\.psd/g,
  )) {
    // Some pages write "DellContent//content".
    const src = `https:${m[0].replace('DellContent//', 'DellContent/')}?fmt=png-alpha&wid=2000`
    // The page also shows related models: only this one's folder.
    if (src.includes(`/${model.toLowerCase()}/`) && !gallery.includes(src)) gallery.push(src)
  }
  // What the sheet leaves to the marketing text: the DisplayHDR level, KVM, calibration.
  const text = [
    ...json.matchAll(/[^".<>]{0,160}(?:DisplayHDR|KVM|calibr|Delta\s*E)[^".<>]{0,160}/gi),
  ]
    .map((m) => clean(m[0]))
    .slice(0, 12)
    .join('\n')
  return {
    url,
    name: dellName(factOf('Gamme'), model, size),
    modelNumber: model,
    gtins: product?.gtin ? [product.gtin] : undefined,
    facts,
    text,
    variants: [
      {
        sku,
        color: factOf('Couleur'),
        price: today,
        regularPrice: regular,
        available,
      },
    ],
    images: gallery.slice(0, 8).map((src) => ({ src })),
  }
}

const entities = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&amp;/g, '&')

/** The product pages of the listing, one per product id; the stand-less twins left out. */
async function pages() {
  const urls = new Map<string, string>()
  const first = entities(await get(LISTING))
  // "Résultats 1 à 12 sur 87": past the last page the shop answers 500.
  const total = Number(/sultats\s*\d+\s*à\s*(\d+)\s*sur\s*(\d+)/.exec(first)?.[2] ?? 12)
  const perPage = Number(/sultats\s*\d+\s*à\s*(\d+)/.exec(first)?.[1] ?? 12)
  for (let page = 1; page <= Math.ceil(total / perPage); page++) {
    const html = page === 1 ? first : entities(await get(`${LISTING}?page=${page}`))
    for (const [, href = ''] of html.matchAll(
      /href="(https:\/\/www\.dell\.com\/fr-fr\/shop\/[^"]*?\/apd\/[^"]+?)"/g,
    )) {
      const link = href.split('#')[0] ?? ''
      const id = /\/apd\/[^/]+\/([^/]+)\/-$/.exec(link)?.[1]
      if (id && !/_wost$/.test(id) && !urls.has(id)) urls.set(id, link)
    }
  }
  return [...urls.values()]
}

async function models(): Promise<MonitorModel[]> {
  return (await pages()).map((url) => {
    const id = /\/apd\/[^/]+\/([^/]+)\/-$/.exec(url)?.[1] ?? url
    return {
      brand: BRAND,
      // The reference is the product id's first part (u2724de_withstnd_mon → u2724de).
      slug: slugify(`dell ${id.split('_')[0]}`),
      read: async () => {
        const m = read(url, await get(url))
        if (!m) throw new Skip('page illisible')
        return m
      },
    }
  })
}

export const source = monitorSource({
  host: new URL(ORIGIN).host,
  label: 'dell.com/fr-fr (prix € de la boutique Dell)',
  intro: (brand) => [
    `# ${brand.name} (et Alienware) : importés de dell.com (boutique française) par \`pnpm ingest dell\`.`,
  ],
  models,
  read,
})
