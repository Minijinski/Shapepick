import type { Category, Locale } from '@choose/catalog'
import { track } from '~/audience'
import type { Store } from './shops'

// A click on a buy link, counted as it happens: which shop, which product, where the link sat,
// whether it opened the product's page at the shop or a search. It goes to our own /api/out, which
// writes it to the database, and to the audience tool when its script runs (audience.ts). Neither
// keeps anything about the visitor.

/** Where a buy link sits: the sheet, its bar, the best match, a runner-up, a row of the results. */
export const PLACEMENTS = ['sheet', 'sheet-bar', 'best-match', 'runner-up', 'results-row'] as const
export type Placement = (typeof PLACEMENTS)[number]

export type OutboundClick = {
  shop: Store
  slug: string
  category: Category
  placement: Placement
  link: 'page' | 'search'
  locale: Locale
  /** The path the click came from. */
  page: string
}

/** Counts a click without holding the link up: a beacon leaves even as the shop's tab opens. */
export function countClick(click: OutboundClick) {
  try {
    const body = new Blob([JSON.stringify(click)], { type: 'application/json' })
    navigator.sendBeacon?.('/api/out', body)
  } catch {
    // A browser that refuses the beacon still follows the link.
  }
  track('amazon', { product: click.slug, shop: click.shop, placement: click.placement })
}
