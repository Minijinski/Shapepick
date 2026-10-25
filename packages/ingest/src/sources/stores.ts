import type { Brand, KeyboardInput } from '@choose/catalog'
import { Facts, linesOf, parseHtml } from '../facts'
import { EUR_PER_USD } from '../prices'
import { listPrice, listProducts, productPage, type ShopifyProduct } from '../shopify'
import type { Source } from '../source'
import { slugify } from '../text'
import {
  DESCRIPTOR,
  type GenericModel,
  mapListings,
  nameOf,
  SIZE_LABEL,
  sizeOf,
  titleWords,
} from './generic'

// Brand stores on Shopify (Epomaker, Womier, Yunzii, Ajazz, HyperX, Turtle Beach…): one source per store, all mapped by
// the generic mapper. Their descriptions carry "Label: value" spec lists; their prices are in
// dollars, so euros are estimated like mechanicalkeyboards.com's. Bundles, accessories, numpads and
// co-branded collaborations are left out, except a partner brand the store sells under its name
// ("EPOMAKER x AULA F75" is an Aula F75).

type Specs = KeyboardInput['specs']

type Store = {
  id: string
  origin: string
  brand: string
  partners?: string[]
  /** Size tag for titles that state none, when the brand's naming implies it. */
  sizeHint?: (title: string) => string | undefined
  /** Titles carry no colourway: the model name runs up to the first descriptive word. */
  fullNames?: boolean
}

const STORES: Store[] = [
  {
    id: 'epomaker',
    origin: 'https://epomaker.com',
    brand: 'Epomaker',
    partners: ['Aula', 'Ajazz'],
  },
  { id: 'womier', origin: 'https://womierkeyboard.com', brand: 'Womier', partners: ['Hkfos'] },
  { id: 'yunzii', origin: 'https://yunzii.com', brand: 'Yunzii', partners: ['Ajazz'] },
  // Mainstream brands that sell through Shopify too.
  {
    id: 'hyperx',
    origin: 'https://hyperx.com',
    brand: 'HyperX',
    // HyperX names compact boards by size ("Alloy Rise 75", "Origins 2 65"); the others are
    // full-size, except the tenkeyless Origins Core.
    sizeHint: (title) => (/origins core/i.test(title) ? '80%' : '100%'),
    fullNames: true,
  },
  {
    id: 'turtlebeach',
    origin: 'https://turtlebeach.com',
    brand: 'Turtle Beach',
    partners: ['Roccat'],
  },
  { id: 'ajazz', origin: 'https://ajazzstore.com', brand: 'Ajazz' },
  { id: 'royalkludge', origin: 'https://www.rkgamingstore.com', brand: 'Royal Kludge' },
]

const NOT_A_KEYBOARD =
  /keycaps?\b|wrist rest|palm rest|\bcable\b|\btools?\b|\bmouse\b|bundle|\s\+\s|desk ?mat|mouse ?pad|numpad|calculator|macro ?pad|gift card|tester|(switch|keycap)\s+set|\bswitch(es)?\s*$|\bkit\b|barebone|\bcase\b|\bset\b|sticker|\bstand\b|\bbag\b|\bpouch\b|housing|top plates?|badge|keycaps?\b/i

const isKeyboard = (p: ShopifyProduct) =>
  /keyboard/i.test(`${p.product_type} ${p.title}`) &&
  !/switch|keycap|wrist|tool|cable|mouse|mat\b|bundle/i.test(p.product_type) &&
  !NOT_A_KEYBOARD.test(p.title) &&
  p.variants.some((v) => v.available)

/** The brand a listing is sold under: a partner named in front of the model, else the store. */
function brandOf(store: Store, title: string): Brand {
  const partner = store.partners?.find((b) => new RegExp(`(^|\\bx\\s+)${b}\\b`, 'i').test(title))
  const name = partner ?? store.brand
  return { slug: slugify(name), name }
}

async function loadModels(store: Store): Promise<GenericModel[]> {
  const models = new Map<string, GenericModel>()
  for (const product of await listProducts(store.origin)) {
    if (!isKeyboard(product)) continue
    const brand = brandOf(store, product.title)
    if (store.sizeHint && !/\b(60|65|75|96|98|1800)\b|%/.test(product.title)) {
      const hint = store.sizeHint(product.title)
      if (hint) product.tags = [...product.tags, hint]
    }
    const html = await productPage(store.origin, product.handle)
    const facts = Facts.fromHtml(product.body_html).merge(Facts.fromHtml(html, 'main'))
    // "HyperX Alloy Origins 65 – Mechanical Gaming Keyboard": the model is what precedes the dash.
    const [head, ...rest] = product.title.split(/\s+[–—]\s+/)
    const name =
      rest.length && head
        ? head.replace(new RegExp(`^${brand.name}\\s+`, 'i'), '').trim()
        : store.fullNames
          ? titleWords(product.title, brand.name)
              .slice(
                0,
                Math.max(
                  1,
                  titleWords(product.title, brand.name).findIndex((w) => DESCRIPTOR.test(w)),
                ),
              )
              .join(' ')
          : nameOf(product.title, brand.name).name
    if (!name || /^x$/i.test(name)) continue
    const size = sizeOf(facts, product) ?? 'full'
    const key = `${brand.slug}|${name.toLowerCase()}|${size}`
    const text = linesOf(parseHtml(product.body_html)).join('\n')
    const model = models.get(key) ?? {
      brand: brand.slug,
      brandName: brand.name,
      name,
      slug: '',
      listings: [],
    }
    model.listings.push({ product, facts, text, origin: store.origin })
    models.set(key, model)
  }
  const names = new Map<string, number>()
  for (const key of models.keys()) {
    const base = key.slice(0, key.lastIndexOf('|'))
    names.set(base, (names.get(base) ?? 0) + 1)
  }
  for (const [key, model] of models) {
    const size = key.slice(key.lastIndexOf('|') + 1) as Specs['formFactor']
    const shared = (names.get(key.slice(0, key.lastIndexOf('|'))) ?? 0) > 1
    if (shared && SIZE_LABEL[size]) model.name = `${model.name} ${SIZE_LABEL[size]}`
    model.slug = slugify(`${model.brandName} ${model.name}`)
  }
  return [...models.values()]
}

function storeSource(store: Store): Source {
  return {
    host: new URL(store.origin).host,
    label: `${new URL(store.origin).host} (prix € estimés depuis les prix US)`,
    intro: (brand) => [
      `# ${brand.name} : importés de ${new URL(store.origin).host} par \`pnpm ingest ${store.id}\`.`,
      `# Prix € estimés (prix US × ${EUR_PER_USD}).`,
    ],
    candidates: async () =>
      (await loadModels(store)).map((m) => ({
        slug: m.slug,
        brand: { slug: m.brand, name: m.brandName },
        map: (resolver) =>
          mapListings(m, resolver, {
            colorway: (l) => nameOf(l.product.title, m.brandName).colorway,
            toEur: (usd) => usd * EUR_PER_USD,
          }),
      })),
    priceIndex: async () => {
      const index = new Map<string, { eur?: number; usd?: number }>()
      for (const p of await listProducts(store.origin)) {
        for (const v of p.variants) {
          if (v.sku) index.set(v.sku, { usd: listPrice(v), eur: listPrice(v) * EUR_PER_USD })
        }
      }
      return index
    },
  }
}

export const sources = Object.fromEntries(STORES.map((s) => [s.id, storeSource(s)]))
