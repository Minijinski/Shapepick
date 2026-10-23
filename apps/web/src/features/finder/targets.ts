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
import type { FinderSearch } from './useFinder'

// What a category's canvas shows for a saved journey, worked out as the visitor heads there,
// before its finder is on screen: the scene arrives already showing the products the answers
// keep (and gathers their short list), instead of showing the whole catalogue and regrouping once
// the finder pushes the same thing. The finder's own derivation (useFinder), for the answers the
// journey holds; nothing is hovered or drafted yet.

export function journeyTargets(
  category: Category,
  items: CatalogItem[],
  search: FinderSearch,
): ItemTargets {
  const base = finderOf(category)
  const def = withBrands(withOrder(base, readOrder(base, search.order)), items)
  const answers = sanitizeAnswers(def, search)
  const filters = def.steps.some((step) => predicateOf(step, answers) != null)
  const ranked = rank(def, items, answers)
  const informed = isInformed(def, answers)
  const order = ranked.map((r) => def.id(r.item))
  return {
    kept: filters ? new Set(order) : null,
    hot: null,
    order: informed ? order : [],
    scores: informed ? ranked.map((r) => r.score) : [],
  }
}
