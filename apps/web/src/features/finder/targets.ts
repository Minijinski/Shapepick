import {
  type CatalogItem,
  type Category,
  finderOf,
  isInformed,
  predicateOf,
  rank,
  readOrder,
  sanitizeAnswers,
  withBrands,
  withOrder,
} from '@choose/catalog'
import type { ItemTargets } from '../scene/renderer'
import { type FinderSearch, stepAt } from './useFinder'

// What a category's finder shows for a saved journey, worked out as the visitor heads there,
// before its finder is on screen. The canvas: the scene arrives already showing the products the
// answers keep (and gathers their short list), instead of showing the whole catalogue and
// regrouping once the finder pushes the same thing. The chrome: the page on screen keeps what the
// next one shows in the same place (Finder). The finder's own derivation (useFinder), for the
// answers the journey holds; nothing is hovered or drafted yet.

/** What the next category's finder shows around its console. */
export type FinderAhead = {
  category: Category
  /** It opens on its results. */
  results: boolean
  /** How many products its podium ranks; null when it shows none (no answer to rank on yet). */
  ranked: number | null
}

export function journeyAhead(
  category: Category,
  items: CatalogItem[],
  search: FinderSearch,
): { targets: ItemTargets; finder: FinderAhead } {
  const base = finderOf(category)
  const def = withBrands(withOrder(base, readOrder(base, search.order)), items)
  const answers = sanitizeAnswers(def, search)
  const filters = def.steps.some((step) => predicateOf(step, answers) != null)
  const ranked = rank(def, items, answers)
  const informed = isInformed(def, answers)
  const results = stepAt(def, items, answers, search.at) == null
  const order = ranked.map((r) => def.id(r.item))
  return {
    targets: {
      kept: filters ? new Set(order) : null,
      hot: null,
      order: informed ? order : [],
      scores: informed ? ranked.map((r) => r.score) : [],
    },
    finder: { category, results, ranked: informed && !results ? ranked.length : null },
  }
}
