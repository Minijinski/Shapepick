import { get, getJson } from './http'

// Most keyboard makers sell through Shopify, which serves every storefront's catalogue as public
// JSON (/products.json, /collections/<handle>/products.json): titles, tags, options, variants with
// SKUs and prices, images with their dimensions. One reader covers them all; what differs per
// brand is how its tags and spec sheets map onto our schema (see sources/).

export type ShopifyImage = {
  id: number
  src: string
  width: number
  height: number
  alt?: string | null
  position: number
  variant_ids: number[]
}

export type ShopifyVariant = {
  id: number
  title: string
  option1: string | null
  option2: string | null
  option3: string | null
  sku: string | null
  price: string
  compare_at_price: string | null
  available: boolean
  featured_image: ShopifyImage | null
}

export type ShopifyProduct = {
  id: number
  title: string
  handle: string
  body_html: string
  created_at: string
  vendor: string
  product_type: string
  tags: string[]
  options: { name: string; position: number; values: string[] }[]
  variants: ShopifyVariant[]
  images: ShopifyImage[]
}

/** Every product of a storefront, or of one of its collections, 250 per page. */
export async function listProducts(origin: string, collection?: string) {
  const base = collection
    ? `${origin}/collections/${collection}/products.json`
    : `${origin}/products.json`
  const all: ShopifyProduct[] = []
  for (let page = 1; ; page++) {
    const { products } = await getJson<{ products: ShopifyProduct[] }>(
      `${base}?limit=250&page=${page}`,
    )
    all.push(...products)
    if (products.length < 250) return all
  }
}

export const productUrl = (origin: string, handle: string) => `${origin}/products/${handle}`
export const productPage = (origin: string, handle: string) => get(productUrl(origin, handle))

/** A variant's option values keyed by option name ("Color" → "Carbon Black"). */
export function optionsOf(product: ShopifyProduct, variant: ShopifyVariant) {
  const values = [variant.option1, variant.option2, variant.option3]
  return Object.fromEntries(
    product.options.map((o, i) => [o.name, values[i] ?? ''] as const).filter(([, v]) => v),
  )
}

/** List price: the struck-through price when the variant is on sale. */
export function listPrice(variant: ShopifyVariant) {
  return Math.max(Number(variant.price), Number(variant.compare_at_price ?? 0))
}
