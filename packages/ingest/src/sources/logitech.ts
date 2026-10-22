import type { Brand } from '@choose/catalog'
import type { Fact } from '../facts'
import { get } from '../http'
import { slugify } from '../text'
import {
  fact,
  jsonLd,
  type OfficialModel,
  type OfficialProduct,
  type OfficialVariant,
  officialSource,
  type Picture,
} from './official'

// Logitech, from its French sites: logitech.com (office keyboards) and logitechg.com (gaming).
// - The category page links every keyboard; "for Mac" pages are the same model.
// - A product page's schema.org Product lists every colour × layout SKU in `model`, with its euro
//   price and stock ("MX Keys S - Graphite - Français (AZERTY)").
// - The spec sheet is serialized in the page (facet:"Poids",value:"810 g"…); what it does not state
//   (size, key technology for office boards) comes from the name and description, and is flagged.

const BRAND: Brand = { slug: 'logitech', name: 'Logitech', website: 'https://www.logitech.com' }

type Site = { origin: string; category: string; gaming: boolean }
const SITES: Record<'logitech' | 'logitechg', Site> = {
  logitech: {
    origin: 'https://www.logitech.com',
    category: '/fr-fr/shop/c/keyboards',
    gaming: false,
  },
  logitechg: {
    origin: 'https://www.logitechg.com',
    category: '/fr-fr/shop/c/gaming-keyboards',
    gaming: true,
  },
}

const NOT_A_KEYBOARD =
  /creative-console|keypad|mx-master|mouse|souris|combo|education|numpad|pave-numerique|desk|stand|case|etui|repose|palm|keycap|switch|bundle|pack/i

/** "/fr-fr/shop/p/mx-keys-s-for-mac.920-011626" → mx-keys-s: one model for its Mac and PC pages. */
const modelKey = (path: string) =>
  (path.split('/').pop() ?? '')
    .replace(/\.\d{3}-\d{6}$/, '')
    .replace(/^buy-/, '')
    .replace(/-(for-)?mac$/, '')

async function productUrls(site: Site) {
  const html = await get(`${site.origin}${site.category}`)
  const byModel = new Map<string, string[]>()
  for (const m of html.matchAll(/href="(\/fr-fr\/shop\/p\/[^"#?]+)"/g)) {
    const path = m[1] ?? ''
    if (NOT_A_KEYBOARD.test(path)) continue
    const key = modelKey(path)
    const urls = byModel.get(key) ?? []
    const url = `${site.origin}${path}`
    if (!urls.includes(url)) urls.push(url)
    byModel.set(key, urls)
  }
  return byModel
}

/** JS string escapes of the serialized state ("/") decoded. */
const decodeJs = (s: string) => {
  try {
    return JSON.parse(`"${s}"`) as string
  } catch {
    return s
  }
}

function facets(html: string) {
  const out: Fact[] = []
  for (const m of html.matchAll(/facet:"([^"]*)",value:"([^"]*)"/g)) {
    out.push({ label: decodeJs(m[1] ?? ''), value: decodeJs(m[2] ?? '') })
  }
  const names = [...html.matchAll(/facet:"([^"]+)"/g)].map((m) => decodeJs(m[1] ?? ''))
  return { pairs: out, names: [...new Set(names)] }
}

const LAYOUT_WORD = /AZERTY|QWERTY|QWERTZ|Français|Allemand|Anglais|Suisse|Belge|Nordique|Danois/i
const SWITCH_WORD = /tactile|lin[ée]aire|linear|clicky|\bGX\b|switch/i

/** "G512 X 75 - Noir - GX Brown Tactile - Français (AZERTY)" → colour, switch, layout. */
function variantOf(name: string, color: string | undefined): Omit<OfficialVariant, 'available'> {
  const [, ...parts] = name.split(' - ')
  const v: Omit<OfficialVariant, 'available'> = { color }
  for (const part of parts) {
    if (LAYOUT_WORD.test(part)) v.layout = part
    else if (SWITCH_WORD.test(part)) v.switchName = part
    else v.color ??= part
  }
  return v
}

const pick = (pairs: Fact[], label: RegExp) => pairs.find((p) => label.test(p.label))?.value

export function read(
  url: string,
  html: string,
  gaming = /logitechg\.com/.test(url),
): OfficialProduct | undefined {
  const product = jsonLd(html).find((x) => x['@type'] === 'Product')
  if (!product) return undefined
  // Some pages name the product like a headline: "Clavier gaming sans fil G915 X LIGHTSPEED".
  let name = String(product.name ?? '')
    .replace(/\s+pour Mac$|\s+for Mac$/i, '')
    .replace(/^clavier\s+(gaming\s+)?((sans fil|filaire|m[ée]canique)\s+)*/i, '')
  // The 2019 "PRO" keyboard is a tenkeyless board the page names in one word.
  const proTkl = name === 'PRO'
  if (proTkl) name = 'PRO Keyboard'
  const models = (product.model as Record<string, unknown>[] | undefined) ?? []
  const variants: OfficialVariant[] = models.map((m) => {
    const offer = (m.offers ?? {}) as {
      price?: number | string
      availability?: string
      priceSpecification?: { priceType?: string; price?: number | string }
    }
    // A promotion shows as the offer price plus a struck-through regular price.
    const strike = offer.priceSpecification
    const image = (m.image as string[] | undefined)?.[0]
    return {
      ...variantOf(String(m.name ?? ''), m.color ? String(m.color) : undefined),
      sku: m.sku ? String(m.sku) : undefined,
      price: Number(offer.price) || undefined,
      regularPrice: /Strikethrough/i.test(strike?.priceType ?? '')
        ? Number(strike?.price) || undefined
        : undefined,
      available: /InStock|LimitedAvailability|PreOrder/i.test(String(offer.availability ?? '')),
      image: image ? { src: image } : undefined,
    }
  })
  // Top views come in every layout: the French one leads.
  const images = ((product.image as string[] | undefined) ?? []).map((src): Picture => ({ src }))
  const french = images.filter((i) => /-fra\b|-fr\b|azerty/i.test(i.src))
  const pictures = [...french, ...images.filter((i) => !french.includes(i))].slice(0, 6)

  const { pairs, names } = facets(html)
  const meta = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? ''
  const about = `${name} ${meta} ${pairs.map((p) => `${p.label} ${p.value}`).join(' ')}`
  const text = `${meta}\n${names.join(' ; ')}`
  const tags: string[] = []

  // Size: Logitech states it in names ("G512 X 75", "PRO X TKL", "MX Keys Mini"), not in the sheet.
  const n = name.toLowerCase()
  if (/\bsplit\b|ergo k860/.test(n)) tags.push('split')
  else if (/\btkl\b|\bg7[01]\d\b/.test(n) || proTkl) tags.push('80%')
  else if (/\b60\b/.test(n)) tags.push('60%')
  else if (/\b9[68]\b/.test(n)) tags.push('98%')
  else if (/\b75\b|\bmini\b|keys-to-go|pebble|k380|\bpop\b/.test(n)) tags.push('75%')
  else tags.push('100%')

  // Key technology: the sheet says it for gaming boards; office boards are told apart by family.
  const mechanical = /m[ée]canique|mechanical|\bGX\b/i.test(
    `${name} ${meta} ${pick(pairs, /switch|type de clavier/i) ?? ''}`,
  )
  // G213 ("Mech-Dome") and the K/MK office ranges are membrane boards, which their pages do not say.
  const membrane =
    /membrane|mech-dome/i.test(about) || /\bg213\b|\bk120\b|\bk270\b|\bmk\d{3}\b/.test(n)
  if (/\bTMR\b|magn[ée]tique|analogique/i.test(about)) tags.push('magnetic', 'rapid trigger')
  else if (membrane) tags.push('membrane')
  else if (!mechanical && !gaming) {
    tags.push(/mx keys|pebble|keys-to-go|slim|pop icon|k380|k780/i.test(n) ? 'scissor' : 'membrane')
  }
  if (/scissor/.test(tags.join(' ')) || /profil bas|low[- ]profile|ultra-?plat/i.test(about)) {
    tags.push('low profile')
  }

  const wireless: string[] = []
  const links = `${text} ${about}`
  if (/logi ?bolt|lightspeed|r[ée]cepteur|2[.,]4\s*ghz/i.test(links))
    wireless.push('2.4 GHz receiver')
  if (/bluetooth/i.test(links)) wireless.push('Bluetooth')
  if (/easy-switch/i.test(links)) wireless.push('up to 3 devices')
  const backlight = /lightsync|rvb|rgb/i.test(about)
    ? 'RGB'
    : /r[ée]tro[ée]clair|backlit/i.test(about)
      ? 'White LED'
      : 'None'
  const width = pick(pairs, /^largeur$/i)
  const depth = pick(pairs, /^hauteur$/i) ?? pick(pairs, /^longueur$/i)
  const thick = pick(pairs, /^[ée]paisseur$/i)
  const num = (s?: string) => Number(/(\d+(?:[.,]\d+)?)/.exec(s ?? '')?.[1]?.replace(',', '.'))
  const facts: Fact[] = [
    ...fact('Connectivity', wireless.length ? wireless.join(', ') : 'Wired'),
    ...fact('Backlighting', backlight),
    ...fact('Weight', pick(pairs, /^poids$/i)),
    ...fact(
      'Dimensions',
      width && depth
        ? `${Math.round(num(width))} x ${Math.round(num(depth))} x ${Math.round(num(thick))} mm`
        : undefined,
    ),
    ...fact('Battery', pick(pairs, /type de batterie/i)),
    ...fact(
      'Compatibility',
      names.filter((x) => /windows|macos|linux|chrome|ipad|android/i.test(x)).join(', '),
    ),
    ...pairs.filter(
      (p) => p.value && !/^(hauteur|largeur|longueur|[ée]paisseur|poids)$/i.test(p.label),
    ),
  ]
  const polling = /(\d+(?:[\s.,]\d{3})?\s*k?hz)/i.exec(about)?.[1]
  if (polling) facts.push(...fact('Polling Rate', polling))

  return { url, name, facts, text, tags, variants, images: pictures }
}

async function models(site: Site): Promise<OfficialModel[]> {
  const out: OfficialModel[] = []
  for (const urls of (await productUrls(site)).values()) {
    const products: OfficialProduct[] = []
    for (const url of urls) {
      const p = read(url, await get(url), site.gaming)
      if (p?.variants.length) products.push(p)
    }
    const [first] = products
    if (!first) continue
    out.push({ brand: BRAND, name: first.name, slug: slugify(`logitech ${first.name}`), products })
  }
  return out
}

const sourceFor = (id: keyof typeof SITES) => {
  const site = SITES[id]
  return officialSource({
    host: new URL(site.origin).host,
    label: `${new URL(site.origin).host}/fr-fr (prix € et dispositions du site français)`,
    intro: (brand) => [
      `# ${brand.name} : importés de logitech.com et logitechg.com (sites français) par \`pnpm ingest logitech\` et \`logitechg\`.`,
      '# Taille et technologie des claviers bureautiques déduites du nom : la fiche Logitech ne les donne pas.',
    ],
    models: () => models(site),
    read: (url, html) => read(url, html, site.gaming),
  })
}

export const sources = { logitech: sourceFor('logitech'), logitechg: sourceFor('logitechg') }
