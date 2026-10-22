import type { Brand, KeyboardInput } from '@choose/catalog'
import type { SwitchResolver } from './switches'

// What the CLI needs from a shop adapter (sources/*.ts): the models it can import, in batch order,
// each mapped on demand, and today's prices by SKU for the weekly refresh.

export type Draft = { input: KeyboardInput; notes: string[] }

/** A model that cannot be imported as it stands (no size, nothing in stock…): reported, not fatal. */
export class Skip extends Error {}

export type Candidate = {
  slug: string
  brand: Brand
  map: (resolver: SwitchResolver) => Promise<Draft>
}

export type PriceIndex = Map<string, { eur?: number; usd?: number }>

export type Source = {
  /** Host of the product pages listed in `sources`, which ties an entry back to its adapter. */
  host: string
  /** Batch header: where the data comes from. */
  label: string
  /** Header of a brand file this source creates. */
  intro: (brand: Brand) => string[]
  candidates: () => Promise<Candidate[]>
  /** Today's prices by SKU; official sites re-read the pages the entries came from (`urls`). */
  priceIndex: (urls: string[]) => Promise<PriceIndex>
}
