import type { Brand } from '@choose/catalog'
import { type Fact, Facts } from '../../facts'
import { get } from '../../http'
import { clean, monitorSpecsOf } from '../../monitor-specs'
import { slugify } from '../../text'
import { jsonLd } from '../official'
import { type MonitorModel, monitorSource, type OfficialMonitor } from './official'

// Samsung, from its French site. The product sitemap (vd-sitemap.xml) lists every monitor page,
// one per model code (LS27FG602SUXEN), often under several categories, old ones included. A page
// carries the whole sheet (`pdd32-product-spec` rows), the shop's price (`newHybrisShopInfo`:
// regular and promotion; `shopServiceYN: N` once Samsung no longer sells it) and its gallery on
// images.samsung.com, the straight front view first. Codes of one model that only differ by their
// colour become its variants. The search APIs behind the listing pages are not used: their
// robots.txt does not answer.

const ORIGIN = 'https://www.samsung.com'
const BRAND: Brand = { slug: 'samsung', name: 'Samsung', website: 'https://www.samsung.com' }
const PAGE = /\/fr\/monitors\/([^/]+)\/[^/]+-(l[a-z0-9]+xen)\/$/

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))

/** Year letter of a model code: LS27**D**G600 is a 2024 model. */
const YEARS: Record<string, number> = { a: 2021, b: 2022, c: 2023, d: 2024, f: 2025 }

/** Words of a title that describe rather than name: resolutions, rates, colours. */
const DESCRIPTIVE =
  /\b(?:Dual\s+)?(?:U?W?D?QHD|DWQHD|W?UHD|5K2K|[3-8]K|W?FHD|DFHD|Full HD)\b|\b\d{2,3}\s*Hz\b|\b(?:Noir|Blanc|Argent|Black|White|Silver|Monitor)\s*$/gi

/**
 * "Écran PC Gaming 27" Odyssey OLED G6 G60SF QHD 500Hz" → Odyssey OLED G6 G60SF 27"; the size from
 * the sheet when the title gives none.
 */
export function samsungName(title: string, sheetSize?: string) {
  // A title can carry a stray attribute before its <br>: its last line is the name.
  const last = decode(title.split(/<br\s*\/?>/i).pop() ?? title)
  const t = clean(last).replace(/''/g, '"')
  const size =
    /(\d{2}(?:[.,]\d)?)\s*"/.exec(t)?.[1]?.replace(',', '.') ??
    /^(\d{2})\s+(?=[A-Z])/.exec(t)?.[1] ??
    sheetSize
  let name = t
    .replace(/(\d{2}(?:[.,]\d)?)\s*"/, ' ')
    .replace(/^(\d{2})\s+(?=[A-Z])/, ' ')
    .replace(
      /^\s*(?:[ÉE]crans?|Moniteurs?)\b\s*(?:PC\b\s*)?(?:(?:Gaming|Gamer|Professionnel(?:le)?|Plat)\b\s*)*/i,
      '',
    )
    .replace(/^\s*(?:Samsung|Smart(?=\s+Odyssey))\s+/i, '')
    .replace(/\sIncurvée?(?=\s|$)/gi, ' ')
    .replace(/\bViewfinity\b/g, 'ViewFinity')
  for (let i = 0; i < 3; i++) name = name.replace(DESCRIPTIVE, ' ')
  name = name
    .replace(/\s[-–|/](?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return size ? `${name} ${size}"` : name
}

export function read(url: string, html: string): OfficialMonitor | undefined {
  const product = jsonLd(html).find((d) => d['@type'] === 'Product' && d.sku) as
    | { name?: string; sku?: string; description?: string }
    | undefined
  const shop = /newHybrisShopInfo\s*=\s*(\{[\s\S]*?\});/.exec(html)?.[1]
  const info = shop
    ? (JSON.parse(shop) as { price?: string; promotionPrice?: string; shopServiceYN?: string })
    : undefined
  const title = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]
  const code = PAGE.exec(url)?.[2]
  if (!product?.sku || !title || !code) return undefined

  const facts: Fact[] = []
  for (const m of html.matchAll(
    /pdd32-product-spec__content-item-title[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*pdd32-product-spec__content-item-desc[^>]*>([\s\S]*?)<\/p>/g,
  )) {
    const label = clean(decode(m[1] ?? ''))
    const value = clean(decode(m[2] ?? ''))
    // Samsung's "Rotation" is the left-right turn of the stand; "Pivot" the portrait one.
    if (label && value) facts.push({ label: label === 'Rotation' ? 'Swivel' : label, value })
  }
  const factOf = (label: string) => facts.find((f) => f.label === label)?.value
  // Samsung's OLED monitors are QD-OLED, but some pages leave out the Quantum Dot row their
  // colour twin has.
  const notes: string[] = []
  if (
    /oled/i.test(factOf('Type de dalle') ?? '') &&
    !facts.some((f) => /quantum/i.test(f.label)) &&
    !/woled/i.test(title)
  ) {
    facts.push({ label: 'Quantum Dot Color', value: 'Oui' })
    notes.push('OLED Samsung sans ligne Quantum Dot : QD-OLED supposé')
  }
  const gallery: string[] = []
  for (const m of html.matchAll(
    new RegExp(
      `//images\\.samsung\\.com/is/image/samsung/p6pim/fr/${code}/gallery/[^"'?\\s)]+`,
      'g',
    ),
  )) {
    const src = `https:${m[0]}`
    if (!/-thumb-/.test(src) && !gallery.includes(src)) gallery.push(src)
  }
  const sold = info?.shopServiceYN === 'Y'
  const regular = Number(info?.price) || undefined
  const today = Number(info?.promotionPrice) || regular
  const year = /^l[a-z](\d{2})([a-z])/.exec(code)?.[2]
  return {
    url,
    name: samsungName(title, factOf("Taille de l'écran")),
    modelNumber: product.sku,
    releaseYear: year ? YEARS[year] : undefined,
    facts,
    text: clean(product.description ?? ''),
    variants: [
      {
        sku: product.sku,
        color: factOf('Couleur arrière') ?? factOf('Couleur des bords'),
        price: sold ? today : undefined,
        regularPrice: sold ? regular : undefined,
        available: sold,
      },
    ],
    // The original PNG, cut out on transparency (the bare URL serves a small JPEG).
    images: gallery.slice(0, 8).map((src) => ({ src: `${src}?$ORIGIN_PNG$` })),
    notes,
  }
}

/** One page per model code, the shop's own categories first (business pages repeat them). */
async function pages() {
  const xml = await get(`${ORIGIN}/fr/vd-sitemap.xml`)
  const byCode = new Map<string, string>()
  for (const [, url = ''] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const m = PAGE.exec(url)
    if (!m?.[2]) continue
    const known = byCode.get(m[2])
    if (!known || (/\/business\//.test(known) && m[1] !== 'business')) byCode.set(m[2], url)
  }
  return [...byCode.values()]
}

/** What tells two codes of one name apart, read the mapper's way (sheets word "Oui" or "Yes"). */
function signature(m: OfficialMonitor) {
  try {
    const { specs: s } = monitorSpecsOf(new Facts(m.facts), { name: m.name, text: m.text })
    return [
      s.diagonalIn,
      s.resW,
      s.resH,
      s.panel,
      s.refreshHzMax,
      s.usbcPdW,
      s.heightAdjustable,
    ].join('|')
  } catch {
    return 'unreadable'
  }
}

async function models(): Promise<MonitorModel[]> {
  const byName = new Map<string, OfficialMonitor[]>()
  for (const url of await pages()) {
    const m = read(url, await get(url))
    // Pages of models Samsung no longer sells stay online, without a shop.
    if (!m?.variants.some((v) => v.available)) continue
    const group = byName.get(m.name) ?? []
    group.push(m)
    byName.set(m.name, group)
  }
  const out: MonitorModel[] = []
  for (const [name, group] of byName) {
    // Codes with the same specs are colours of one model; other ones keep their own reference.
    const bySpecs = new Map<string, OfficialMonitor[]>()
    for (const m of group) bySpecs.set(signature(m), [...(bySpecs.get(signature(m)) ?? []), m])
    const sets = [...bySpecs.values()]
    sets.forEach((set, i) => {
      const [first] = set
      if (!first) return
      const merged: OfficialMonitor = {
        ...first,
        name: i === 0 ? name : `${name} (${first.modelNumber})`,
        variants: set.flatMap((m) => m.variants),
      }
      out.push({ brand: BRAND, slug: slugify(`samsung ${merged.name}`), read: async () => merged })
    })
  }
  return out
}

export const source = monitorSource({
  host: new URL(ORIGIN).host,
  label: 'samsung.com/fr (prix € de la boutique Samsung)',
  intro: (brand) => [
    `# ${brand.name} : importés de samsung.com (site français) par \`pnpm ingest samsung\`.`,
  ],
  models,
  read,
})
