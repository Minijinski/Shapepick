import type { Brand, MouseRecord } from '@choose/catalog'
import { type Fact, linesOf, parseHtml } from '../../facts'
import { listPrice, listProducts, optionsOf, productPage, type ShopifyProduct } from '../../shopify'
import type { MouseSource, PriceIndex } from '../../source'
import { slugify } from '../../text'
import { type MouseModel, type MouseVariant, mapMouse, type OfficialMouse, TOP } from './official'

// Pulsar, from its European store (eu.pulsar.gg, Shopify, prices in euros). The store's public
// JSON lists the mice with their tags (Connectivity/Wireless, Shape/Ergonomic, Size/Mini), colours
// and photos; a product page sets its sheet out in accordions: "Dimension" (Length: 4.74in
// (120.4mm)…, Weight), "Sensor" (sensor, DPI, "1000Hz/1ms Polling Rate", "Up to 8K Polling
// Rate"), "Benefits". Up to 8K needs Pulsar's 8K dongle, sold apart, unless the box holds an 8K
// receiver or dock. Each size is a product of its own. Collaborations and signature editions
// (Pro Series, TenZ, Blue Archive, Bruce Lee…) and tournament colourways are left out.

const ORIGIN = 'https://eu.pulsar.gg'
const BRAND: Brand = { slug: 'pulsar', name: 'Pulsar', website: 'https://www.pulsar.gg' }
const EDITION = /\[|edition|signature|tenz|tournament|noctua|grip tape|supergrip|skates/i

type Shape = MouseRecord['specs']['shape']

const isMouse = (p: ShopifyProduct) =>
  /gaming mouse\s*(-\s*(mini|medium|large))?$/i.test(p.title) &&
  !p.tags.includes('collaboration') &&
  !EDITION.test(p.title) &&
  p.variants.some((v) => v.available)

/** "ZywOo The Chosen Mouse Gen.2 - Mini" → "ZywOo The Chosen Mouse Gen.2 Mini". */
const nameOf = (title: string) =>
  title
    .replace(/^Pulsar\s+/i, '')
    .replace(/\s+Gaming Mouse/i, '')
    .replace(/\s+-\s+/, ' ')
    .trim()

/** The page's accordions, title → lines: "Dimension", "Sensor", "Benefits", "Feature". */
function accordions(html: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const acc of parseHtml(html).querySelectorAll('.accordion-wrapper .accordion')) {
    const title = acc.querySelector('.accordion-menu-title')?.text.trim() ?? ''
    if (title && !out.has(title))
      out.set(title, linesOf(acc.querySelector('.accordion-content') ?? acc))
  }
  return out
}

/** The sheet worded for the mapper; the report rate as sold. */
function factsOf(sections: Map<string, string[]>, tags: string[]): Fact[] {
  const lines = (title: RegExp) =>
    [...sections].filter(([t]) => title.test(t)).flatMap(([, l]) => l)
  const dimension = lines(/dimension/i)
  // The mouse's own lines come first; a dock's measurements follow its own heading.
  const dock = dimension.findIndex((l, i) => i > 0 && /dock/i.test(l))
  const own = dock < 0 ? dimension : dimension.slice(0, dock)
  const facts: Fact[] = own.flatMap((l) => {
    const m = /^([A-Za-z ]{3,20}):\s*(.+)$/.exec(l)
    return m?.[1] && m[2] ? [{ label: m[1].trim(), value: m[2].trim() }] : []
  })
  const sensor = lines(/sensor/i)
  const all = [...sections.values()].flat().join('\n')
  if (sensor[0]) facts.push({ label: 'Capteur', value: sensor[0] })
  const dpi = sensor.find((l) => /dpi/i.test(l))
  if (dpi) facts.push({ label: 'DPI', value: dpi })
  const stated = sensor.find((l) => /\d+\s*hz.*polling/i.test(l))
  const in8kBox = /8k[^\n]{0,40}(receiver|dock)/i.test(all)
  const rate = /8000\s*hz/i.test(stated ?? '') || in8kBox ? '8000 Hz' : stated
  if (rate) facts.push({ label: 'Taux de rapport', value: rate })
  // Not every wireless mouse is tagged so (Feinmann F01): its dock or battery tells.
  if (tags.includes('Connectivity/Wireless') || /wireless|dongle|charging dock|batter/i.test(all))
    facts.push({ label: 'Connectivité', value: 'Sans fil 2,4 GHz ; filaire' })
  else facts.push({ label: 'Connectivité', value: 'Filaire' })
  return facts
}

function officialOf(p: ShopifyProduct, page: string): OfficialMouse {
  const sections = accordions(page)
  const name = nameOf(p.title)
  const shape: Shape | undefined = p.tags.includes('Shape/Ergonomic')
    ? 'ergonomic'
    : p.tags.includes('Shape/Symmetrical')
      ? 'symmetrical'
      : undefined
  const variants: MouseVariant[] = p.variants
    .filter((v) => v.available)
    .map((v) => {
      const options = optionsOf(p, v)
      return {
        sku: v.sku ?? undefined,
        color: options.Color ?? options.Colour ?? (/default/i.test(v.title) ? undefined : v.title),
        price: Number(v.price) || undefined,
        regularPrice: Number(v.compare_at_price) || undefined,
        available: true,
      }
    })
  return {
    url: `${ORIGIN}/products/${p.handle}`,
    name,
    modelNumber: variants[0]?.sku,
    facts: factsOf(sections, p.tags),
    text: [...(sections.get('Benefits') ?? []), ...(sections.get('Feature') ?? [])].join('\n'),
    // "X3 LHD": the left-hand design.
    hints: { segment: 'gaming', shape, hand: /\bLHD\b/.test(name) ? 'left' : undefined },
    variants,
    images: p.images
      .slice(0, 8)
      .map((i) => ({ src: i.src.split('?')[0] ?? i.src, width: i.width, height: i.height })),
  }
}

async function models(): Promise<MouseModel[]> {
  const out = new Map<string, MouseModel>()
  for (const p of await listProducts(ORIGIN)) {
    if (!isMouse(p)) continue
    const slug = slugify(`pulsar ${nameOf(p.title)}`)
    // The store lists some mice twice (a sold-out page and a new one): the first one in stock.
    if (out.has(slug)) continue
    out.set(slug, {
      brand: BRAND,
      slug,
      read: async () => officialOf(p, await productPage(ORIGIN, p.handle)),
    })
  }
  return [...out.values()].slice(0, TOP)
}

export const source: MouseSource = {
  category: 'mouse',
  host: new URL(ORIGIN).host,
  label: 'eu.pulsar.gg (prix € de la boutique européenne)',
  intro: (brand) => [
    `# ${brand.name} : souris importées de eu.pulsar.gg par \`pnpm ingest pulsar-mice\`.`,
    '# Collaborations, éditions signées et coloris de tournoi écartés ; chaque taille est un produit.',
  ],
  candidates: async () =>
    (await models()).map((model) => ({
      slug: model.slug,
      brand: model.brand,
      map: async () => mapMouse(model, await model.read()),
    })),
  priceIndex: async () => {
    const index: PriceIndex = new Map()
    for (const p of await listProducts(ORIGIN)) {
      for (const v of p.variants) if (v.sku) index.set(v.sku, { eur: listPrice(v) })
    }
    return index
  },
}
