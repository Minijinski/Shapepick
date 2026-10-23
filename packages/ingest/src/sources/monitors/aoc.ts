import type { Brand } from '@choose/catalog'
import type { Fact } from '../../facts'
import { get } from '../../http'
import { clean } from '../../monitor-specs'
import { Skip } from '../../source'
import { slugify } from '../../text'
import { jsonLd } from '../official'
import {
  jsonAfter,
  jsonAt,
  type MonitorModel,
  monitorSource,
  nextFlight,
  type OfficialMonitor,
} from './official'

// AOC (AGON included), from its French site. AOC sells nothing itself: its pages show the
// resellers' prices (« Où acheter », served by Hatch and rendered with the page), whose median is
// the indicative price; their links carry AOC's own affiliate codes and are not kept. What is on
// sale is what the two listings (gaming, others) list in JSON-LD: the sitemap keeps hundreds of
// old models. A product page streams its sheet in Next.js flight data (`specificationCategories`;
// « Basculement » is the left-right turn, « Pivotement » the portrait one; a value may be a list)
// and its photos on cdn.sanity.io, each typed: `infoscreenvisual` is the front view.

const ORIGIN = 'https://www.aoc.com'
const BRAND: Brand = { slug: 'aoc', name: 'AOC', website: 'https://www.aoc.com' }
const LISTINGS = [`${ORIGIN}/fr/gaming/monitors`, `${ORIGIN}/fr/monitors`]

type Spec = { label?: string; value?: string | { value?: string }[] }
type Category = { id?: string; title?: string; specifications?: Spec[] }
type Picture = { url?: string; type?: string }
type Store = { inStock?: boolean; name?: string; price?: { price?: string } }

const RENAMED: Record<string, string> = { Basculement: 'Swivel', Pivotement: 'Pivot' }
/** Photo types in the order the canvas wants them; lifestyle shots and close-ups left out. */
const ORDER = ['infoscreenvisual', 'productshot', 'ftl', 'ftr']

export function read(url: string, html: string): OfficialMonitor | undefined {
  const flight = nextFlight(html)
  const categories = jsonAfter<Category[]>(flight, 'specificationCategories') ?? []
  const at = flight.indexOf('"productId":"products-monitor-')
  const product =
    at < 0
      ? undefined
      : jsonAt<{ sku?: string; productLine?: string; images?: Picture[] }>(
          flight,
          flight.lastIndexOf('{', at),
        )
  if (!product?.sku || !categories.length) return undefined

  const facts: Fact[] = []
  for (const category of categories) {
    for (const spec of category.specifications ?? []) {
      const label = clean(spec.label ?? '')
      const value = clean(
        Array.isArray(spec.value)
          ? spec.value.map((v) => v.value ?? '').join(', ')
          : (spec.value ?? ''),
      )
      if (label && value && !value.startsWith('$'))
        facts.push({ label: RENAMED[label] ?? label, value })
    }
  }
  const factOf = (label: string) => facts.find((f) => f.label === label)?.value
  const stores = jsonAfter<Store[]>(flight, 'stores') ?? []
  const prices = stores
    .filter((s) => s.inStock)
    .map((s) => Number(s.price?.price))
    .filter((p) => p > 0)
  const pictures = (product.images ?? [])
    .filter((p) => p.url && ORDER.includes(p.type ?? ''))
    .sort((a, b) => ORDER.indexOf(a.type ?? '') - ORDER.indexOf(b.type ?? ''))
  // The original, cut out on transparency (the default `auto=format` may serve an opaque JPEG).
  const images = pictures.map((p) => ({ src: `${p.url?.split('?')[0]}?w=2000&fit=max&fm=png` }))
  const sku = product.sku.toUpperCase()
  const base = sku.split('/')[0] ?? sku
  const line = /^AGON/i.test(product.productLine ?? '') ? product.productLine : undefined
  const name = jsonLd(html).find((d) => d['@type'] === 'Product')?.name as string | undefined
  return {
    url,
    name: [line, base].filter(Boolean).join(' ') || clean(name ?? sku),
    modelNumber: sku,
    gtins: [factOf('EAN') ?? ''].filter((g) => /^\d{8,14}$/.test(g)),
    facts,
    text: '',
    variants: [
      {
        sku,
        color: factOf('Couleur du cadre (avant)')?.split(',')[0],
        available: prices.length > 0,
      },
    ],
    images,
    resellerPrices: prices,
  }
}

/**
 * The two listings in AOC's own order, taken in turn (gaming, other, gaming…) so that the most
 * relevant models of both come first; a model no reseller lists is skipped for want of a price.
 */
async function models(): Promise<MonitorModel[]> {
  const lists: string[][] = []
  for (const listing of LISTINGS) {
    const list: string[] = []
    for (const item of jsonLd(await get(listing))) {
      if (item['@type'] !== 'ItemList') continue
      for (const el of (item.itemListElement ?? []) as { url?: string }[]) {
        if (el.url) list.push(el.url)
      }
    }
    lists.push(list)
  }
  const urls = new Map<string, string>()
  for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) {
    for (const list of lists) {
      const url = list[i]
      // cu34v5c_bk: the colour is the code's suffix.
      const slug = /\/monitors\/([^/?#]+)/.exec(url ?? '')?.[1]?.replace(/_(bk|wh|bl|si)$/, '')
      if (url && slug && !urls.has(slug)) urls.set(slug, url)
    }
  }
  return [...urls].map(([slug, url]) => ({
    brand: BRAND,
    slug: slugify(`aoc ${slug}`),
    read: async () => {
      const m = read(url, await get(url))
      if (!m) throw new Skip('page illisible')
      return m
    },
  }))
}

export const source = monitorSource({
  host: new URL(ORIGIN).host,
  label: 'aoc.com/fr (prix € des revendeurs listés par AOC)',
  intro: (brand) => [
    `# ${brand.name} (et AGON) : importés de aoc.com (site français) par \`pnpm ingest aoc\`.`,
    '# Prix : médiane des revendeurs que la page AOC affiche (AOC ne vend pas en direct).',
  ],
  models,
  read,
})
