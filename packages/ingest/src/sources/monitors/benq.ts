import type { Brand } from '@choose/catalog'
import type { Fact } from '../../facts'
import { get } from '../../http'
import { clean } from '../../monitor-specs'
import { Skip } from '../../source'
import { slugify } from '../../text'
import { type MonitorModel, monitorSource, type OfficialMonitor, TOP } from './official'

// BenQ (MOBIUZ, ZOWIE), from benq.eu/fr-fr and zowie.benq.eu/fr-fr. Each range page lists its
// monitors. The sheet is the /spec.html page (`li.item`: `div.name` + `div.detail`; ZOWIE:
// `th`/`td` rows, printed twice); the version of a port is in its label, the count in its value;
// « Pivotement (gauche/droite) » is the left-right turn. The /buy.html page carries the gallery on
// image.benq.com, each asset named by its angle (…-front-high, -left45, -back…): the front views
// go first. BenQ's shop (shop.benq.eu) is closed to robots and its price API answers 401; for a
// model the shop does not sell (`ecType` disableMagentoEC), the page states BenQ's standard price
// (`disableMagentoECStandardPrice`), taken as its recommended price; otherwise data/msrp.yaml.

const BRAND: Brand = { slug: 'benq', name: 'BenQ', website: 'https://www.benq.eu' }
/** BenQ's ranges, each listing its models: taken in turn for a balanced choice. */
const RANGES = [
  'https://www.benq.eu/fr-fr/monitor/gaming.html',
  'https://www.benq.eu/fr-fr/monitor/home.html',
  'https://www.benq.eu/fr-fr/monitor/creative-pro.html',
  'https://zowie.benq.eu/fr-fr/monitor.html',
  'https://www.benq.eu/fr-fr/monitor/programming.html',
  'https://www.benq.eu/fr-fr/monitor/business.html',
]
/** A model page (ex2710q, gw2490tc, xl2546x-plus), not a guide or a comparison page. */
const MODEL_PAGE =
  /href="((?:https:\/\/(?:www|zowie)\.benq\.eu)?\/fr-fr\/monitor\/(?:[a-z-]+\/)?([a-z]{2,3}\d{3,4}[a-z0-9-]*)\.html)"/g
const RENAMED: Record<string, string> = { 'Pivotement (gauche/droite)': 'Swivel' }

const text = (s: string) =>
  clean(
    s
      .replace(/<br\s*\/?>/gi, ' / ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, ' '),
  )

function sheet(html: string): Fact[] {
  const facts: Fact[] = []
  const add = (label: string, value: string) => {
    const l = text(label)
    const v = text(value)
    if (l && v && !facts.some((f) => f.label === l && f.value === v)) {
      facts.push({ label: RENAMED[l] ?? l, value: v })
    }
  }
  for (const m of html.matchAll(
    /<li class="item[^"]*"[^>]*>\s*<div class="name[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="detail[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
  )) {
    add(m[1] ?? '', m[2] ?? '')
  }
  // ZOWIE's table, printed for desktop and mobile alike.
  const zowie = html.indexOf('game-spec-table')
  if (zowie >= 0) {
    for (const m of html
      .slice(zowie)
      .matchAll(/<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
      add(m[1] ?? '', m[2] ?? '')
    }
  }
  return facts
}

/** The selling points under the product's name ("Propulsé par la 4e génération QD-OLED…"). */
const features = (html: string) =>
  text((/<ul class="feature"[^>]*>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '').replace(/<\/li>/g, '. '))

const hidden = (html: string, name: string) =>
  new RegExp(`name="${name}"\\s+value="([^"]*)"`).exec(html)?.[1]

/**
 * The model's photos, front views first; close-ups, ports, logos and feature banners left out.
 * A "+" model's photos keep the base model's name (xl2566x-plus: 1-xl2566x-front-1).
 */
function gallery(html: string, model: string) {
  const code = model.replace(/-plus$/, '')
  const assets = [
    ...new Set(
      [
        ...html.matchAll(
          /https:\/\/image\.benq\.com\/is\/image\/(benqco|zowie)\/([A-Za-z0-9_-]+)/g,
        ),
      ].map((m) => `${m[1]}/${m[2]}`),
    ),
  ].filter((a) => {
    const name = a.split('/')[1] ?? ''
    return (
      name.toLowerCase().includes(code) &&
      !/back|io$|-io-|angles|icon|logo|kv|bearing|connectivity|nav\d*$|panel|sharpness/i.test(name)
    )
  })
  const rank = (a: string) => (/front-high/.test(a) ? 0 : /front/.test(a) ? 1 : 2)
  return assets
    .sort((a, b) => rank(a) - rank(b))
    .map((a) => ({ src: `https://image.benq.com/is/image/${a}?wid=2000&fmt=png-alpha` }))
}

export function read(url: string, html: string): OfficialMonitor | undefined {
  const model = /\/([a-z0-9-]+)(?:\/(?:spec|buy))?\.html$/.exec(url)?.[1]
  if (!model) return undefined
  const code = model.toUpperCase().replace(/-PLUS$/, '+')
  const standard =
    hidden(html, 'ecType') === 'disableMagentoEC'
      ? Number(hidden(html, 'disableMagentoECStandardPrice'))
      : 0
  return {
    url,
    name: code,
    modelNumber: code,
    facts: sheet(html),
    text: features(html),
    variants: [{ sku: code, available: standard > 0 }],
    images: gallery(html, model),
    standardPrice: standard > 0 ? standard : undefined,
  }
}

/**
 * BenQ's sites give no ranking: its ranges are taken in turn (MOBIUZ, home and office, creative,
 * ZOWIE, programming, business), each in its own listing's order, and the first 50 kept.
 */
async function models(): Promise<MonitorModel[]> {
  const lists: string[][] = []
  for (const range of RANGES) {
    const origin = new URL(range).origin
    const list: string[] = []
    for (const [, href = ''] of (await get(range)).matchAll(MODEL_PAGE)) {
      const url = href.startsWith('http') ? href : `${origin}${href}`
      if (!list.includes(url)) list.push(url)
    }
    lists.push(list)
  }
  const urls: string[] = []
  for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) {
    for (const list of lists) {
      const url = list[i]
      if (url && !urls.includes(url)) urls.push(url)
    }
  }
  return urls.slice(0, TOP).map((url) => {
    const model = /\/([a-z0-9-]+)\.html$/.exec(url)?.[1] ?? ''
    const zowie = url.includes('zowie.')
    const base = url.replace(/\.html$/, '')
    return {
      brand: BRAND,
      slug: slugify(`benq ${model}`),
      read: async () => {
        // ZOWIE keeps sheet and gallery on the product page. On benq.eu, the newest models have
        // no spec page yet (404): they come back once BenQ publishes it.
        const specUrl = zowie ? url : `${base}/spec.html`
        const specPage = await get(specUrl).catch(() => '')
        if (!specPage) throw new Skip('pas encore de page de caractéristiques')
        const spec = read(specUrl, specPage)
        const buy = zowie
          ? spec
          : read(`${base}/buy.html`, await get(`${base}/buy.html`).catch(() => ''))
        if (!spec?.facts.length) throw new Skip('fiche introuvable')
        const code = spec.modelNumber ?? model.toUpperCase()
        const line = zowie ? 'ZOWIE' : /^EX/.test(code) ? 'MOBIUZ' : undefined
        return {
          ...spec,
          url,
          name: [line, code].filter(Boolean).join(' '),
          // The buy page says what the sheet does not: « OLED » there is a QD-OLED.
          text: buy?.text || spec.text,
          images: buy?.images.length ? buy.images : spec.images,
          standardPrice: buy?.standardPrice ?? spec.standardPrice,
          variants: buy?.variants ?? spec.variants,
        }
      },
    }
  })
}

export const source = monitorSource({
  host: 'www.benq.eu',
  label: 'benq.eu/fr-fr et zowie.benq.eu (prix standard affiché par BenQ, sinon prix conseillé)',
  intro: (brand) => [
    `# ${brand.name} (MOBIUZ, ZOWIE) : importés de benq.eu et zowie.benq.eu par \`pnpm ingest benq\`.`,
    '# Prix : prix standard que la page BenQ donne quand sa boutique ne vend pas le modèle',
    '# (disableMagentoECStandardPrice), sinon prix conseillé de data/msrp.yaml.',
  ],
  models,
  read,
})
