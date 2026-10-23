import type { Brand } from '@choose/catalog'
import type { Fact } from '../../facts'
import { get } from '../../http'
import { clean } from '../../monitor-specs'
import { Skip } from '../../source'
import { slugify } from '../../text'
import { type MonitorModel, monitorSource, type OfficialMonitor } from './official'

// MSI, from its official French store (fr-store.msi.com, Shopify): msi.com itself turns robots
// away (Akamai), the store does not. Its product sitemap lists the monitors it sells; a product
// page embeds Shopify's product object, with the sheet as an HTML table (« Rotation » is the
// portrait pivot there, « Réglage de l'angle de rotation » the left-right turn), the prices in
// cents (`compare_at_price` when on sale), the EAN and the gallery, cut-out PNGs. The store's
// `.json` endpoints answered 429: pages only, 4 s apart. Bundles (« Pack de 2 ») are left out.
// Relevance: the store's best sellers (tag rank:best_seller) first, then the most reviewed, then
// the newest.

const ORIGIN = 'https://fr-store.msi.com'
const BRAND: Brand = { slug: 'msi', name: 'MSI', website: 'https://www.msi.com' }

type ShopifyObject = {
  title?: string
  handle?: string
  description?: string
  created_at?: string
  variants?: {
    sku?: string | null
    title?: string
    option1?: string | null
    price?: number
    compare_at_price?: number | null
    available?: boolean
    barcode?: string | null
  }[]
  images?: string[]
}

/** The product object a Shopify page embeds, found by its handle, braces balanced. */
function productObject(html: string, handle: string): ShopifyObject | undefined {
  const at = html.indexOf(`"handle":"${handle}"`)
  const start = at < 0 ? -1 : html.lastIndexOf('{"id":', at)
  if (start < 0) return undefined
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1)) as ShopifyObject
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

const RENAMED: Record<string, string> = {
  Rotation: 'Pivot',
  "Réglage de l'angle de rotation": 'Swivel',
}

/** The sheet's table rows, line breaks within a cell kept as " / ". */
function sheetOf(description: string): Fact[] {
  const facts: Fact[] = []
  for (const m of description.matchAll(/<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
    const text = (s: string) =>
      clean(
        s
          .replace(/<br\s*\/?>/gi, ' / ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'"),
      ).replace(/(\s\/\s)+$/, '')
    const label = text(m[1] ?? '')
    const value = text(m[2] ?? '')
    if (label && value) facts.push({ label: RENAMED[label] ?? label, value })
  }
  return facts
}

export function read(url: string, html: string): OfficialMonitor | undefined {
  const handle = /\/products\/([^/?#]+)/.exec(url)?.[1]
  const product = handle ? productObject(html, handle) : undefined
  if (!product?.title) return undefined
  const name = clean(product.title).replace(/^MSI\s+/i, '')
  const variants = (product.variants ?? []).map((v) => ({
    sku: v.sku ?? undefined,
    color: v.option1 && v.option1 !== 'Default Title' ? v.option1 : undefined,
    price: v.price ? v.price / 100 : undefined,
    regularPrice: v.compare_at_price ? v.compare_at_price / 100 : undefined,
    available: v.available ?? false,
  }))
  const gtins = (product.variants ?? [])
    .map((v) => v.barcode ?? '')
    .filter((b) => /^\d{8,14}$/.test(b))
  const description = product.description ?? ''
  return {
    url,
    name,
    modelNumber: name,
    gtins,
    releaseYear: Number(product.created_at?.slice(0, 4)) || undefined,
    facts: sheetOf(description),
    // The feature bullets above the sheet: KVM, Delta E, the HDR level.
    text: clean(description.split(/Fiche technique/i)[0]?.replace(/<[^>]+>/g, ' ') ?? ''),
    variants,
    images: (product.images ?? []).slice(0, 8).map((src) => ({
      src: `https:${src.replace(/^https?:/, '')}`,
    })),
  }
}

async function models(): Promise<MonitorModel[]> {
  const index = await get(`${ORIGIN}/sitemap.xml`)
  const products = [...index.matchAll(/<loc>([^<]*sitemap_products[^<]*)<\/loc>/g)].map((m) =>
    (m[1] ?? '').replace(/&amp;/g, '&'),
  )
  const urls: string[] = []
  for (const sitemap of products) {
    for (const [, url = ''] of (await get(sitemap)).matchAll(
      /<loc>([^<]+\/products\/[^<]+)<\/loc>/g,
    )) {
      if (/monitor/.test(url) && !/pack/.test(url)) urls.push(url)
    }
  }
  const ranked: { url: string; html: string; score: [number, number, string] }[] = []
  for (const url of urls) {
    const html = await get(url)
    const handle = /\/products\/([^/?#]+)/.exec(url)?.[1] ?? ''
    const product = productObject(html, handle) as (ShopifyObject & { tags?: string[] }) | undefined
    const reviews = Number(/"reviewCount"\s*:\s*"?(\d+)/.exec(html)?.[1] ?? 0)
    const best = product?.tags?.includes('rank:best_seller') ? 1 : 0
    ranked.push({ url, html, score: [best, reviews, product?.created_at ?? ''] })
  }
  ranked.sort(
    (a, b) =>
      b.score[0] - a.score[0] || b.score[1] - a.score[1] || b.score[2].localeCompare(a.score[2]),
  )
  return ranked.map(({ url, html }) => ({
    brand: BRAND,
    // "mpg-271qrx-qd-oled-gaming-monitor" → msi-mpg-271qrx-qd-oled.
    slug: slugify(
      `msi ${(/\/products\/([^/?#]+)/.exec(url)?.[1] ?? url).replace(/-(gaming-|pro-)?monitor$/, '')}`,
    ),
    read: async () => {
      const m = read(url, html)
      if (!m) throw new Skip('page illisible')
      return m
    },
  }))
}

export const source = monitorSource({
  host: new URL(ORIGIN).host,
  label: 'fr-store.msi.com (boutique officielle MSI France, prix €)',
  intro: (brand) => [
    `# ${brand.name} : importés de la boutique officielle MSI France par \`pnpm ingest msi\`.`,
  ],
  models,
  read,
})
