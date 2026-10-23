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

// Razer, from its French site (razer.com/fr-fr). The French product sitemap (linked from
// razer.com/sitemap.xml) lists one URL per SKU, grouped by model in the path
// (/fr-fr/gaming-keyboards/<model>/<SKU>). A product page carries its SAP Commerce state
// (<script id="ng-state">): the product's classifications (switch type, size, lighting,
// connectivity, keycaps, wrist rest…) and, in baseOptions, every variant of the model (switch,
// layout, colour) with its SKU, euro price and stock. One page per model is enough.

const ORIGIN = 'https://www.razer.com'
const BRAND: Brand = { slug: 'razer', name: 'Razer', website: 'https://www.razer.com' }
const NOT_A_KEYBOARD = /wrist|repose|keycap|switch|cable|case|etui|stand|pouch|kit\b|bundle/i

type Category = { parentCategoryName?: string; name?: string }
type Option = {
  code?: string
  name?: string
  priceData?: { value?: number }
  stock?: { stockLevel?: number; stockLevelStatus?: string }
  categories?: Category[]
  images?: { format?: string; url?: string }[]
}
type Feature = { name?: string; featureValues?: { value?: string }[] }
type Product = Option & {
  baseProductName?: string
  summary?: string
  description?: string
  price?: { value?: number }
  classifications?: { features?: Feature[] }[]
  baseOptions?: { options?: Option[] }[]
}

const strip = (html: string) => linesOf(parseHtml(html)).join(' ')

function variantOf(o: Option): OfficialVariant {
  const cat = (re: RegExp) => o.categories?.find((c) => re.test(c.parentCategoryName ?? ''))?.name
  const image =
    o.images?.find((i) => i.format === 'product')?.url ?? o.images?.find((i) => i.url)?.url
  const level = o.stock?.stockLevel
  return {
    sku: o.code,
    color: cat(/couleur/i),
    layout: cat(/disposition/i) ?? /\s-\s([A-Z]{2})\s-\s/.exec(o.name ?? '')?.[1],
    switchName: cat(/touche|switch/i),
    price: o.priceData?.value,
    available:
      (level !== undefined && level > 0) ||
      /inStock|lowStock/i.test(o.stock?.stockLevelStatus ?? ''),
    image: image
      ? { src: image.startsWith('http') ? image : `https://assets2.razerzone.com${image}` }
      : undefined,
  }
}

export function read(url: string, html: string): OfficialProduct | undefined {
  const state = scriptJson(html, 'ng-state') as
    | {
        'cx-state'?: {
          product?: { details?: { entities?: Record<string, Record<string, { value?: Product }>> } }
        }
      }
    | undefined
  const entities = state?.['cx-state']?.product?.details?.entities ?? {}
  const scopes = Object.values(entities)[0] ?? {}
  const p = scopes.default?.value ?? scopes.variants?.value
  if (!p?.name) return undefined

  const options = p.baseOptions?.flatMap((b) => b.options ?? []) ?? []
  const variants = options.length ? options.map(variantOf) : [variantOf(p)]
  const features = p.classifications?.flatMap((c) => c.features ?? []) ?? []
  const value = (f: Feature) =>
    (f.featureValues ?? [])
      .map((v) => strip(v.value ?? ''))
      .filter(Boolean)
      .join(', ')
  const facts: Fact[] = features.flatMap((f) => fact(f.name ?? '', value(f)))
  const feature = (re: RegExp) => features.find((f) => re.test(f.name ?? ''))
  // "Chroma RGB - Non" is no RGB: the lighting fact is worded for the mapper.
  const chroma = feature(/chroma/i)
  const light = feature(/[ée]clairage/i)
  facts.unshift(
    ...fact(
      'Backlighting',
      chroma && /oui/i.test(value(chroma)) ? 'RGB' : light ? value(light) : undefined,
    ),
  )
  const text = [p.summary, strip(p.description ?? ''), value(feature(/autres/i) ?? {})]
    .filter(Boolean)
    .join('\n')
  const polling = /(\d[\d\s.,]*\s*k?hz)/i.exec(
    `${facts.map((f) => f.value).join(' ')} ${text}`,
  )?.[1]
  if (polling) facts.push(...fact('Polling Rate', polling))

  const tags: string[] = []
  if (/profil bas|low[- ]profile/i.test(value(feature(/hauteur/i) ?? {}))) tags.push('low profile')
  if (/analogique|analog/i.test(`${value(feature(/type de switch/i) ?? {})} ${text}`))
    tags.push('analog')

  // One photo per colour.
  const images: Picture[] = []
  const colors = new Set<string>()
  for (const v of variants) {
    if (!v.image || colors.has(v.color ?? '')) continue
    colors.add(v.color ?? '')
    images.push(v.image)
  }
  const name = (p.baseProductName ?? p.name.split(' - ')[0] ?? p.name).replace(/^Razer\s+/i, '')
  return { url, name, facts, text, tags, variants, images: images.slice(0, 6) }
}

/** The French product sitemap's pages of a section (/fr-fr/<section>/<model>/<SKU>), by model. */
export async function productUrls(section: string, skip: RegExp) {
  const index = await get(`${ORIGIN}/sitemap.xml`)
  const french = [...index.matchAll(/<loc>([^<]*Product-fr-FR[^<]*)<\/loc>/g)][0]?.[1]
  if (!french) return new Map<string, string[]>()
  const xml = await get(french.replace(/&amp;/g, '&'))
  const byModel = new Map<string, string[]>()
  for (const m of xml.matchAll(
    new RegExp(`<loc>(https://www\\.razer\\.com/fr-fr/${section}/([^/<]+)/[^<]+)</loc>`, 'g'),
  )) {
    const [, url = '', model = ''] = m
    if (skip.test(model)) continue
    byModel.set(model, [...(byModel.get(model) ?? []), url])
  }
  return byModel
}

async function models(): Promise<OfficialModel[]> {
  const out: OfficialModel[] = []
  for (const urls of (await productUrls('gaming-keyboards', NOT_A_KEYBOARD)).values()) {
    // Every page of a model lists all its variants: the first readable one is enough.
    for (const url of [...new Set(urls)]) {
      const p = read(url, await get(url))
      if (!p?.variants.length) continue
      out.push({ brand: BRAND, name: p.name, slug: slugify(`razer ${p.name}`), products: [p] })
      break
    }
  }
  return out
}

export const source = officialSource({
  host: new URL(ORIGIN).host,
  label: 'razer.com/fr-fr (prix € et dispositions du site français)',
  intro: (brand) => [
    `# ${brand.name} : importés de razer.com (site français) par \`pnpm ingest razer\`.`,
  ],
  models,
  read,
})
