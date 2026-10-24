import type { CatalogItem } from '../domain/items'

/**
 * Between two products the ranking cannot tell apart (same match, same price): the newer model
 * first, then the one whose buy link opens its page rather than a search. Whatever is still level
 * goes by slug, never by brand name, so that no maker leads a podium for its place in the alphabet.
 */
export const settleTies = (a: CatalogItem, b: CatalogItem) =>
  (b.releaseYear ?? 0) - (a.releaseYear ?? 0) ||
  Number(b.amazonAsin != null) - Number(a.amazonAsin != null)
