import type { Brand, KeyboardInput, MonitorInput, MouseRecord } from '@choose/catalog'
import type { SwitchResolver } from './switches'

// What the CLI needs from a shop adapter (sources/*.ts): the models it can import, in batch order,
// each mapped on demand, and today's prices by SKU for the weekly refresh. A keyboard source maps
// its models with the switch resolver; a monitor or mouse source (sources/monitors/, sources/mice/)
// needs none.

export type Draft = { input: KeyboardInput; notes: string[] }
export type MonitorDraft = {
  input: MonitorInput
  notes: string[]
  /** Where the price comes from: the brand's shop, the resellers its page lists, its MSRP. */
  priceFrom?: 'shop' | 'resellers' | 'msrp'
}

export type MouseDraft = {
  input: MouseRecord
  notes: string[]
  /** Where the price comes from: the brand's shop, the resellers its page lists, its MSRP. */
  priceFrom?: 'shop' | 'resellers' | 'msrp'
}

/** A model that cannot be imported as it stands (no size, nothing in stock…): reported, not fatal. */
export class Skip extends Error {}

export type Candidate = {
  slug: string
  brand: Brand
  map: (resolver: SwitchResolver) => Promise<Draft>
}

export type MonitorCandidate = {
  slug: string
  brand: Brand
  map: () => Promise<MonitorDraft>
}

export type MouseCandidate = {
  slug: string
  brand: Brand
  map: () => Promise<MouseDraft>
}

export type PriceIndex = Map<string, { eur?: number; usd?: number }>

type SourceBase = {
  /** Host of the product pages listed in `sources`, which ties an entry back to its adapter. */
  host: string
  /** Batch header: where the data comes from. */
  label: string
  /** Header of a brand file this source creates. */
  intro: (brand: Brand) => string[]
  /** Today's prices by SKU; official sites re-read the pages the entries came from (`urls`). */
  priceIndex: (urls: string[]) => Promise<PriceIndex>
}

export type KeyboardSource = SourceBase & {
  category?: 'keyboard'
  candidates: () => Promise<Candidate[]>
}

export type MonitorSource = SourceBase & {
  category: 'monitor'
  candidates: () => Promise<MonitorCandidate[]>
}

export type MouseSource = SourceBase & {
  category: 'mouse'
  candidates: () => Promise<MouseCandidate[]>
}

export type Source = KeyboardSource | MonitorSource | MouseSource
