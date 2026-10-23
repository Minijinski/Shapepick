import type { Text } from '../i18n'
import type { colorFamilies, keyboardLayouts } from './enums'
import {
  type Brand,
  type KeyboardInput,
  type KeyboardSpecs,
  type MonitorInput,
  type MonitorSpecs,
  type MouseInput,
  type MouseSpecs,
  type ProductImage,
  ppiOf,
  type Switch,
} from './schemas'

// What the finder works on: one record per product, brand and switches resolved, nothing nested
// deeper than the variants. The snapshot route serves exactly this shape, and the engine never sees
// anything else, so the same predicates run on the server (SSR) and in the browser.

/** A product photo, cut out on white. */
export type Photo = Pick<ProductImage, 'url' | 'width' | 'height'>

type ItemBase = {
  slug: string
  brand: Pick<Brand, 'slug' | 'name'>
  name: string
  /** The maker's reference (LS27DG600SUXEN, 27GR95QE-B): what a shop search finds it by. */
  modelNumber?: string
  releaseYear?: number
  priceEur: number
  popularity: number
  editorialScore: number
  /** Amazon.fr product id: the buy link opens it rather than a search. */
  amazonAsin?: string
  tagline?: Text
  /**
   * The product seen the way its silhouette is drawn: a keyboard or a mouse from above, a monitor
   * from the front. Without one, the silhouette stands in for it.
   */
  photo?: Photo
}

export type KeyboardItem = ItemBase & {
  category: 'keyboard'
  specs: KeyboardSpecs
  variants: {
    colorName: string
    colorFamily: (typeof colorFamilies)[number]
    layout: (typeof keyboardLayouts)[number]
    switch: Switch | null
    priceEur: number
  }[]
}

export type MonitorItem = ItemBase & {
  category: 'monitor'
  specs: MonitorSpecs & { ppi: number }
  variants: { colorName: string; colorFamily: (typeof colorFamilies)[number]; priceEur: number }[]
}

export type MouseItem = ItemBase & {
  category: 'mouse'
  specs: MouseSpecs
  variants: { colorName: string; colorFamily: (typeof colorFamilies)[number]; priceEur: number }[]
}

export type CatalogItem = KeyboardItem | MonitorItem | MouseItem

const brandOf = (brands: Map<string, Brand>, slug: string, product: string) => {
  const brand = brands.get(slug)
  if (!brand) throw new Error(`${product}: unknown brand "${slug}"`)
  return { slug: brand.slug, name: brand.name }
}

// A product's price is its cheapest variant, which is what a budget answer should be read against.
const cheapest = (prices: number[]) => Math.min(...prices)

/** The primary photo of a view, else the first one of that view. */
function photoOf(images: ProductImage[] | undefined, kind: ProductImage['kind']) {
  const views = images?.filter((image) => image.kind === kind) ?? []
  const main = views.find((image) => image.primary) ?? views[0]
  return main && { url: main.url, width: main.width, height: main.height }
}

export function toKeyboardItems(
  inputs: KeyboardInput[],
  brandList: Brand[],
  switchList: Switch[],
): KeyboardItem[] {
  const brands = new Map(brandList.map((b) => [b.slug, b]))
  const switches = new Map(switchList.map((s) => [s.slug, s]))
  return inputs.map((k) => {
    const variants = k.variants.map((v) => {
      const sw = v.switch ? switches.get(v.switch) : null
      if (v.switch && !sw) throw new Error(`${k.slug}: unknown switch "${v.switch}"`)
      return {
        colorName: v.colorName,
        colorFamily: v.colorFamily,
        layout: v.layout,
        switch: sw ?? null,
        priceEur: v.msrpEur ?? k.msrpEur,
      }
    })
    return {
      category: 'keyboard',
      slug: k.slug,
      brand: brandOf(brands, k.brand, k.slug),
      name: k.name,
      modelNumber: k.modelNumber,
      releaseYear: k.releaseYear,
      priceEur: cheapest(variants.map((v) => v.priceEur)),
      popularity: k.popularity,
      editorialScore: k.editorialScore,
      amazonAsin: k.amazonAsin,
      tagline: k.tagline,
      photo: photoOf(k.images, 'cutout_top'),
      specs: k.specs,
      variants,
    }
  })
}

export function toMonitorItems(inputs: MonitorInput[], brandList: Brand[]): MonitorItem[] {
  const brands = new Map(brandList.map((b) => [b.slug, b]))
  return inputs.map((m) => {
    const variants = m.variants.map((v) => ({
      colorName: v.colorName,
      colorFamily: v.colorFamily,
      priceEur: v.msrpEur ?? m.msrpEur,
    }))
    return {
      category: 'monitor',
      slug: m.slug,
      brand: brandOf(brands, m.brand, m.slug),
      name: m.name,
      modelNumber: m.modelNumber,
      releaseYear: m.releaseYear,
      priceEur: cheapest(variants.map((v) => v.priceEur)),
      popularity: m.popularity,
      editorialScore: m.editorialScore,
      amazonAsin: m.amazonAsin,
      tagline: m.tagline,
      photo: photoOf(m.images, 'cutout_front'),
      specs: { ...m.specs, ppi: ppiOf(m.specs) },
      variants,
    }
  })
}

export function toMouseItems(inputs: MouseInput[], brandList: Brand[]): MouseItem[] {
  const brands = new Map(brandList.map((b) => [b.slug, b]))
  return inputs.map((m) => {
    const variants = m.variants.map((v) => ({
      colorName: v.colorName,
      colorFamily: v.colorFamily,
      priceEur: v.msrpEur ?? m.msrpEur,
    }))
    return {
      category: 'mouse',
      slug: m.slug,
      brand: brandOf(brands, m.brand, m.slug),
      name: m.name,
      modelNumber: m.modelNumber,
      releaseYear: m.releaseYear,
      priceEur: cheapest(variants.map((v) => v.priceEur)),
      popularity: m.popularity,
      editorialScore: m.editorialScore,
      amazonAsin: m.amazonAsin,
      tagline: m.tagline,
      photo: photoOf(m.images, 'cutout_top'),
      specs: m.specs,
      variants,
    }
  })
}
