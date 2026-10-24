import type { CatalogItem, Locale } from '@choose/catalog'
import { useMemo } from 'react'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { collectionPaths } from '~/seo'
import { highlightOf, inSentence, standingsOf } from './collections'

// On a product's sheet: where it stands in the catalogue's collections, whatever the visitor
// answered. The line worth saying first when there is one (the cheapest of a collection, or its
// first), then its best places, each a link to the collection's page. The same for every visit,
// so the product's page says it to search engines too.

/** The places a sheet lists, at most. */
const SHOWN = 4

const sectionLabel = css({
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

export function Standings({
  item,
  items,
  locale,
  className,
}: {
  item: CatalogItem
  /** Its category's catalogue, which the collections are drawn from. */
  items: CatalogItem[]
  locale: Locale
  className?: string
}) {
  const { places, highlight } = useMemo(
    () => ({
      places: standingsOf(item, items).slice(0, SHOWN),
      highlight: highlightOf(item, items),
    }),
    [item, items],
  )
  if (!places.length) return null
  const said = highlight && inSentence(highlight.collection.name[locale])
  return (
    <section className={className}>
      <div className={css({ display: 'grid', gap: '2' })}>
        <h2 className={sectionLabel}>{m.standings[locale]}</h2>
        {highlight && said && (
          <p className={css({ fontSize: 'sm', fontWeight: '550', lineHeight: '1.4' })}>
            {highlight.kind === 'cheapest'
              ? m.cheapestOf(said, item.category, locale)
              : m.firstIn(said, locale)}
          </p>
        )}
        <ul className={css({ display: 'grid' })}>
          {places.map(({ collection, rank, size }) => (
            <li key={collection.id}>
              <a
                href={collectionPaths(collection)[locale]}
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                  alignItems: 'baseline',
                  gap: '3',
                  py: '2',
                  borderTopWidth: '1px',
                  borderColor: 'line',
                  fontSize: 'sm',
                  transition: 'color 160ms',
                  _hover: { color: 'ink', '& [data-arrow]': { transform: 'translateX(2px)' } },
                  _focusVisible: {
                    outline: '2px solid',
                    outlineColor: 'signal',
                    outlineOffset: '2px',
                  },
                })}
              >
                <span className={css({ truncate: true })}>{collection.short[locale]}</span>
                <span
                  className={css({
                    fontFamily: 'mono',
                    fontSize: 'xs',
                    color: rank === 1 ? 'signal' : 'ink.muted',
                    fontVariantNumeric: 'tabular-nums',
                  })}
                >
                  {String(rank).padStart(2, '0')} / {size}
                </span>
                <span
                  aria-hidden
                  data-arrow
                  className={css({
                    color: 'ink.faint',
                    transition: 'transform 200ms token(easings.signal)',
                  })}
                >
                  →
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
