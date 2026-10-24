import type { Brand } from '@choose/catalog'
import type { Fact } from '../facts'
import { linesOf, parseHtml } from '../facts'
import { get } from '../http'
import { slugify } from '../text'
import {
  fact,
  type OfficialModel,
  type OfficialProduct,
  type OfficialVariant,
  officialSource,
  type Picture,
  scriptJson,
} from './official'

// Corsair, from its French site (corsair.com/fr/fr). The product sitemap lists one URL per SKU; a
// product page's __NEXT_DATA__ holds the whole configurable product: name, tech specs ("Keyboard
// Report Rate", "Size Full TKL", "Key Switches"…), every variant (layout, colour, switch) with its
// SKU, stock and regular and final euro prices, and the photos. One page per model is enough: the
// SKUs it lists are skipped in the sitemap. Licensed and bundle editions are left out.

const ORIGIN = 'https://www.corsair.com'
const BRAND: Brand = { slug: 'corsair', name: 'Corsair', website: 'https://www.corsair.com' }
const NOT_A_KEYBOARD =
  /bundle|keycap|wrist|palm|switch|cable|deskmat|mousepad|stand|edition|nuka|witcher|call-of-duty|fallout|starfield|halo|batman|ferrari|lamborghini|\bkit\b|replacement|doom|drop-|diy/i

type Money = { value?: number }
type Price = { minimum_price?: { regular_price?: Money; final_price?: Money } }
type Spec = { code: string; value: string }
type Attribute = { code: string; label: string }
export type VariantProduct = {
  sku?: string
  name?: string
  stock_status?: string
  price_range?: Price
  image?: { url?: string }
  tech_specs?: Spec[]
}
export type Item = VariantProduct & {
  categories?: { name?: string }[]
  description?: { html?: string }
  short_description?: { html?: string }
  media_gallery?: { url?: string }[]
  variants?: { attributes?: Attribute[]; product?: VariantProduct }[]
}

/** Cloudinary renditions: the page carries thumbnails ("w_96"), the photo exists at any width. */
export const large = (url?: string) => url?.replace(/([,/])w_\d+/, '$1w_1600')

/** "K70 CORE SE RGB Mechanical Gaming Keyboard – Cherry Blossom" → K70 CORE SE RGB. */
const modelName = (name: string) =>
  name
    .split(/\s+[–—-]\s+/)[0]
    ?.split(
      /\b(?:High-Performance|Hall Effect|Programmable|Ultra-Thin|Optical-Mechanical|Mechanical|Low-Profile|Gaming|Keyboard)\b/i,
    )[0]
    ?.replace(/\s+/g, ' ')
    .trim() ?? name

export function variantOf(p: VariantProduct, attributes: Attribute[] = []): OfficialVariant {
  const attr = (re: RegExp) => attributes.find((a) => re.test(a.code))?.label
  const spec = (re: RegExp) => p.tech_specs?.find((s) => re.test(s.code))?.value
  const prices = p.price_range?.minimum_price
  const image = large(p.image?.url)
  return {
    sku: p.sku,
    color: attr(/colou?r/i) ?? spec(/^colou?r$/i),
    layout: attr(/layout/i) ?? spec(/keyboard layout/i),
    switchName: attr(/switch/i) ?? spec(/key switches/i),
    price: prices?.final_price?.value,
    regularPrice: prices?.regular_price?.value,
    available: /in_stock/i.test(p.stock_status ?? ''),
    image: image ? { src: image } : undefined,
  }
}

/** The configurable product a page's __NEXT_DATA__ holds (the mice read it too, sources/mice/corsair.ts). */
export function itemOf(html: string): Item | undefined {
  const data = scriptJson(html, '__NEXT_DATA__') as
    | { props?: { pageProps?: { productData?: { productDetail?: { items?: Item[] } } } } }
    | undefined
  return data?.props?.pageProps?.productData?.productDetail?.items?.[0]
}

export function read(url: string, html: string): OfficialProduct | undefined {
  const item = itemOf(html)
  if (!item?.name) return undefined
  const variants = item.variants?.length
    ? item.variants.map((v) => variantOf(v.product ?? {}, v.attributes))
    : [variantOf(item)]

  const specs = item.tech_specs ?? []
  const facts: Fact[] = specs.flatMap((s) => {
    // Weight is in kilograms without a unit ("0.934").
    if (/^weight$/i.test(s.code) && /^\d+(\.\d+)?$/.test(s.value)) {
      return fact('Weight', `${Math.round(Number(s.value) * (Number(s.value) < 20 ? 1000 : 1))} g`)
    }
    return fact(s.code, s.value.replace(/\|/g, ', '))
  })
  const switches = specs.find((s) => /key switches/i.test(s.code))?.value ?? ''
  const tags = (item.categories ?? []).map((c) => c.name ?? '').filter(Boolean)
  if (/\bOPX\b|optical/i.test(`${switches} ${item.name}`)) tags.push('optical')
  if (/\bMGX\b|hall effect|magnetic/i.test(`${switches} ${item.name}`)) tags.push('magnetic')
  if (/low[- ]profile/i.test(`${switches} ${item.name}`)) tags.push('low profile')
  if (/rubber dome|membrane/i.test(switches)) tags.push('membrane')
  const description = item.description?.html ?? item.short_description?.html ?? ''
  const text = linesOf(parseHtml(description)).join('\n').slice(0, 4000)

  const gallery = (item.media_gallery ?? [])
    .map((m) => large(m.url))
    .filter((u): u is string => !!u)
    .map((src): Picture => ({ src }))
  return {
    url,
    name: modelName(item.name),
    facts,
    text,
    tags,
    variants,
    images: gallery.slice(0, 6),
  }
}

async function productUrls() {
  const xml = await get(`${ORIGIN}/fr-sitemap-products-1.xml`)
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1] ?? '')
    .filter((u) => /\/fr\/fr\/p\/keyboards\//.test(u) && !NOT_A_KEYBOARD.test(u))
}

async function models(): Promise<OfficialModel[]> {
  const seen = new Set<string>()
  const byName = new Map<string, OfficialModel>()
  for (const url of await productUrls()) {
    const sku = /\/p\/keyboards\/([^/]+)\//.exec(url)?.[1]?.toUpperCase()
    if (sku && seen.has(sku)) continue
    const p = read(url, await get(url))
    if (!p?.variants.length) continue
    for (const v of p.variants) if (v.sku) seen.add(v.sku.toUpperCase())
    const slug = slugify(`corsair ${p.name}`)
    const model = byName.get(slug) ?? { brand: BRAND, name: p.name, slug, products: [] }
    model.products.push(p)
    byName.set(slug, model)
  }
  return [...byName.values()]
}

export const source = officialSource({
  host: new URL(ORIGIN).host,
  label: 'corsair.com/fr/fr (prix € et dispositions du site français)',
  intro: (brand) => [
    `# ${brand.name} : importés de corsair.com (site français) par \`pnpm ingest corsair\`.`,
  ],
  models,
  read,
})
