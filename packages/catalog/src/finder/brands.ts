import type { CatalogItem } from '../domain/items'
import { text } from '../i18n'
import type { ChoiceStep, FinderDefinition } from './types'

// The brands, as a filter of their own rather than a question: built from the catalogue (its
// brands, A to Z), answered from the brand control beside the counter, never asked in the
// questionnaire. Like any answer it lives in the URL (`brand=keychron,logitech`, every brand when
// absent) and narrows everything the finder shows; a tile it empties says it blocks it.

export const BRAND_STEP = 'brand'

export function brandStep<I extends CatalogItem>(items: I[]): ChoiceStep<I> {
  const names = new Map<string, string>()
  for (const item of items) names.set(item.brand.slug, item.brand.name)
  return {
    key: BRAND_STEP,
    kind: 'multi',
    aside: true,
    label: text('Marques', 'Brands'),
    title: text('Quelles marques ?', 'Which brands?'),
    options: [...names]
      .sort((a, b) => a[1].localeCompare(b[1], 'fr', { sensitivity: 'base' }))
      .map(([slug, name]) => ({
        id: slug,
        label: text(name),
        match: (item: I) => item.brand.slug === slug,
      })),
  }
}

/** The definition with the brand filter of `items`' brands, ahead of every question. */
export const withBrands = <I extends CatalogItem>(
  def: FinderDefinition<I>,
  items: I[],
): FinderDefinition<I> => ({
  ...def,
  steps: [brandStep(items), ...def.steps.filter((s) => s.key !== BRAND_STEP)],
})
