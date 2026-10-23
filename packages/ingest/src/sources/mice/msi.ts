import type { Brand } from '@choose/catalog'
import { get } from '../../http'
import { clean } from '../../monitor-specs'
import { slugify } from '../../text'
import { read as readPage } from '../monitors/msi'
import { type MouseModel, mouseSource, type OfficialMouse, TOP } from './official'

// MSI mice, from its official French store (fr-store.msi.com, Shopify), read like its monitors
// (sources/monitors/msi.ts): the product sitemap lists one page per colour of a mouse
// (forge-gm340-w-black-gaming-gear, …-navy-…), each embedding Shopify's product object with its
// sheet as a table. A colour's page makes a variant; the mouse is its model's name without it.
// The sheet names the link « Interface USB 2.0 » and the report rate « Temps de réponse ».

const ORIGIN = 'https://fr-store.msi.com'
const BRAND: Brand = { slug: 'msi', name: 'MSI', website: 'https://www.msi.com' }
/** The ranges of mice in the store's "gaming gear" (headsets, keyboards and pads aside). */
const MOUSE = /\/products\/(clutch-gm|forge-gm|versa-|interceptor)/
const COLOR = /\b(black|white|navy|sky|violet|pink|red)\b/i

/** One store page as a mouse: the sheet's lines worded for the mapper. */
function readMouse(url: string, html: string): OfficialMouse | undefined {
  const page = readPage(url, html)
  if (!page) return undefined
  const color = COLOR.exec(page.name)?.[1]
  // "FORGE GM340 WIRELESS BLACK" → "Forge GM340 Wireless": the colour goes, codes stay capitals.
  const name = clean(page.name.replace(COLOR, '')).replace(
    /\b[A-Z]{4,}\b/g,
    (w) => w.charAt(0) + w.slice(1).toLowerCase(),
  )
  const facts = page.facts.map((f) =>
    /^interface/i.test(f.label)
      ? { label: 'Connectivité', value: f.value }
      : /^temps de r[ée]ponse$/i.test(f.label) && /hz/i.test(f.value)
        ? { label: 'Taux de rapport', value: f.value }
        : f,
  )
  return {
    ...page,
    name,
    facts,
    hints: { segment: 'gaming' },
    variants: page.variants.map((v) => ({
      ...v,
      color:
        v.color ?? (color ? color.charAt(0).toUpperCase() + color.slice(1).toLowerCase() : 'Black'),
    })),
  }
}

async function models(): Promise<MouseModel[]> {
  const index = await get(`${ORIGIN}/sitemap.xml`)
  const sitemaps = [...index.matchAll(/<loc>([^<]*sitemap_products[^<]*)<\/loc>/g)].map((m) =>
    (m[1] ?? '').replace(/&amp;/g, '&'),
  )
  // A mouse's colours are pages of their own: gathered under the model's name.
  const byModel = new Map<string, OfficialMouse>()
  for (const sitemap of sitemaps) {
    for (const [, url = ''] of (await get(sitemap)).matchAll(
      /<loc>([^<]+\/products\/[^<]+)<\/loc>/g,
    )) {
      if (!MOUSE.test(url) || /dock|combo|bundle/i.test(url)) continue
      const mouse = readMouse(url, await get(url))
      if (!mouse) continue
      const key = slugify(mouse.name)
      const known = byModel.get(key)
      if (known) known.variants.push(...mouse.variants)
      else byModel.set(key, mouse)
    }
  }
  return [...byModel.values()]
    .map((mouse) => ({ brand: BRAND, slug: slugify(`msi ${mouse.name}`), read: async () => mouse }))
    .slice(0, TOP)
}

export const source = mouseSource({
  host: new URL(ORIGIN).host,
  label: 'fr-store.msi.com (prix € de la boutique officielle)',
  intro: (brand) => [
    `# ${brand.name} : souris importées de fr-store.msi.com par \`pnpm ingest msi-mice\`.`,
  ],
  models,
  read: readMouse,
})
