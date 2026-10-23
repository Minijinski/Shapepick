import type { Category } from './domain/enums'
import type { CatalogItem, KeyboardItem, MonitorItem, MouseItem } from './domain/items'
import { keyboardFinder } from './finder/keyboards'
import { mouseFinder } from './finder/mice'
import { monitorFinder } from './finder/monitors'
import type { FinderDefinition } from './finder/types'
import type { Locale, Text } from './i18n'

/** Localised path segments: /fr/claviers ↔ /en/keyboards. */
export const categorySlugs: Record<Category, Text> = {
  keyboard: { fr: 'claviers', en: 'keyboards' },
  monitor: { fr: 'ecrans', en: 'monitors' },
  mouse: { fr: 'souris', en: 'mice' },
}

export function categoryFromSlug(slug: string, locale: Locale): Category | null {
  for (const [category, slugs] of Object.entries(categorySlugs) as [Category, Text][]) {
    if (slugs[locale] === slug) return category
  }
  return null
}

type ItemByCategory = { keyboard: KeyboardItem; monitor: MonitorItem; mouse: MouseItem }
export type ItemOf<C extends Category> = ItemByCategory[C]

export const finders: { [C in Category]: FinderDefinition<ItemOf<C>> } = {
  keyboard: keyboardFinder,
  monitor: monitorFinder,
  mouse: mouseFinder,
}

/** The definition for an item list whose category is only known at runtime. */
export const finderOf = (category: Category) => finders[category] as FinderDefinition<CatalogItem>
