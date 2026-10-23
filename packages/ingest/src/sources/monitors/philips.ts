import type { Brand } from '@choose/catalog'
import type { Fact } from '../../facts'
import { get, getJson } from '../../http'
import { clean } from '../../monitor-specs'
import { msrps } from '../../msrp'
import { Skip } from '../../source'
import { slugify } from '../../text'
import {
  jsonAfter,
  type MonitorModel,
  monitorSource,
  nextFlight,
  type OfficialMonitor,
  TOP,
} from './official'

// Philips (Evnia included), from philips.fr. Philips sells its monitors through resellers only
// and its pages show no price: a model is imported only once data/msrp.yaml gives its
// recommended price (until then the batch lists it as « sans prix », without reading its page).
// The current range is the « latest » listing (12 a page, `?page=N`); the product API's summary
// says whether a model is still produced and its range (Evnia…); the page streams the sheet in
// Next.js flight data (`csChapter`; « Pivotant » is the left-right turn). Revisions of one
// model (_00, _01) are one product. Photos are on images.philips.com, the front view first.

const ORIGIN = 'https://www.philips.fr'
const LISTING = `${ORIGIN}/c-m-so/moniteurs/latest`
const BRAND: Brand = { slug: 'philips', name: 'Philips', website: 'https://www.philips.fr' }

type Summary = {
  data?: {
    alphanumeric?: string
    productStatus?: string
    eop?: string
    sop?: string
    versions?: string[]
    imageURL?: string
    subcategoryName?: string
  }
}
type Chapter = { csItem?: { csItemName?: string; csValue?: { csValueName?: string }[] }[] }

const RENAMED: Record<string, string> = { Pivotant: 'Swivel' }

export function read(url: string, html: string): OfficialMonitor | undefined {
  const chapters = jsonAfter<Chapter[]>(nextFlight(html), 'csChapter') ?? []
  const facts: Fact[] = []
  for (const chapter of chapters) {
    for (const item of chapter.csItem ?? []) {
      const label = clean(item.csItemName ?? '')
      const value = clean((item.csValue ?? []).map((v) => v.csValueName ?? '').join(' ; '))
      if (label && value) facts.push({ label: RENAMED[label] ?? label, value })
    }
  }
  const ctn = /\/c-p\/([A-Z0-9]+)_\d{2}\//.exec(url)?.[1]
  if (!ctn || !facts.length) return undefined
  return {
    url,
    name: ctn,
    modelNumber: ctn,
    facts,
    text: '',
    variants: [
      { sku: ctn, color: facts.find((f) => f.label === 'Couleur')?.value, available: true },
    ],
    images: [],
  }
}

async function models(): Promise<MonitorModel[]> {
  const pages: string[] = [await get(LISTING)]
  const total = Number(/totalPages\\?":(\d+)/.exec(pages[0] ?? '')?.[1] ?? 1)
  for (let page = 2; page <= total; page++) pages.push(await get(`${LISTING}?page=${page}`))
  const byModel = new Map<string, string>()
  for (const html of pages) {
    for (const [, path = ''] of html.matchAll(/href="(\/c-p\/[A-Z0-9]+_\d{2}\/[^"]+)"/g)) {
      const base = /\/c-p\/([A-Z0-9]+)_/.exec(path)?.[1]
      if (base && !byModel.has(base)) byModel.set(base, `${ORIGIN}${path}`)
    }
  }
  // The listing is sorted by Philips' own relevance: its 50 first.
  return [...byModel].slice(0, TOP).map(([base, url]) => {
    const slug = slugify(`philips ${base}`)
    return {
      brand: BRAND,
      slug,
      read: async () => {
        // No price anywhere on philips.fr: nothing to read until a recommended price is known.
        if (!(await msrps()).has(slug)) throw new Skip('sans prix')
        const ctn = /\/c-p\/([A-Z0-9]+_\d{2})\//.exec(url)?.[1]
        const summary = await getJson<Summary>(
          `${ORIGIN}/prx/product/B2C/fr_FR/CONSUMER/products/${ctn}.summary`,
        )
        const info = summary.data
        // NORMAL, or NEW for a model launched this season (34B2U5900C, September 2026).
        const onSale = info?.productStatus === 'NORMAL' || info?.productStatus === 'NEW'
        if (!onSale || (info?.eop && new Date(info.eop) < new Date())) {
          throw new Skip('plus produit par Philips')
        }
        const m = read(url, await get(url))
        if (!m) throw new Skip('page illisible')
        const range = /^(Evnia|Brilliance|Moda|Momentum)\b/.exec(info.versions?.[0] ?? '')?.[1]
        return {
          ...m,
          name: [range, base].filter(Boolean).join(' '),
          releaseYear: Number(info.sop?.slice(0, 4)) || undefined,
          images: info.imageURL
            ? [{ src: `${info.imageURL}?wid=2000&hei=2000&fmt=png-alpha&fit=constrain` }]
            : [],
        }
      },
    }
  })
}

export const source = monitorSource({
  host: new URL(ORIGIN).host,
  label: 'philips.fr (prix conseillé de data/msrp.yaml : Philips ne vend pas en direct)',
  intro: (brand) => [
    `# ${brand.name} (et Evnia) : importés de philips.fr par \`pnpm ingest philips\`.`,
    '# Prix : prix conseillé de data/msrp.yaml (Philips ne vend pas en direct et n’affiche aucun prix).',
  ],
  models,
  read,
})
