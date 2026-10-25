import type { CatalogItem, Locale } from '@choose/catalog'
import { css, cx } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { Match } from '../product/Match'
import { KeySpecs } from '../product/ProductHero'
import { formatPrice } from '../product/specs'
import type { ItemDetail } from './controller'

// The card that opens next to a product on the canvas, set like a callout on a technical drawing:
// where it stands among the answers (or which answer rules it out), what it is and costs, its key
// specs laid out as in the results, and a last line saying that a click opens its full sheet. On a
// screen too short for the whole card beside a product, the compact card leaves the specs to the
// sheet. It comes in whole; gliding on to a neighbour, only its lines (`data-line`, see styles.css)
// fade in again. The frame around it, and the leader line, belong to the scene.

const card = css({
  w: { base: '64', md: '80' },
  // Opaque: the products drifting behind it would only blur what it says.
  bg: 'surface.raised',
  borderRadius: 'card',
  borderWidth: '1px',
  borderColor: 'line',
  boxShadow: 'panel',
  p: { base: '3.5', md: '4' },
  display: 'grid',
  gap: '3',
})

const mono = css({
  fontFamily: 'mono',
  fontSize: '2xs',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
})

const ruled = css({ borderTopWidth: '1px', borderColor: 'line', pt: '3' })

export function PopupCard({
  item,
  detail,
  locale,
  swap = false,
  compact = false,
}: {
  item: CatalogItem
  detail: ItemDetail | null
  locale: Locale
  /** Replacing another product’s card as it glides over: its lines fade in, the card stays. */
  swap?: boolean
  /** No room for the whole card: the specs are left out (the sheet has them). */
  compact?: boolean
}) {
  const ranked = detail?.rank != null
  return (
    <div className={card} data-swap={swap || undefined}>
      {/* Before any answer to rank on, a kept product has no rank or match to print. */}
      {(ranked || detail?.ruledOut) && (
        <div
          data-line
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '3',
            minH: '6',
          })}
        >
          {ranked ? (
            <>
              <span className={cx(mono, css({ color: detail?.rank === 0 ? 'signal' : 'ink' }))}>
                {String((detail?.rank ?? 0) + 1).padStart(2, '0')}
              </span>
              {detail?.score != null && (
                <Match score={detail.score} locale={locale} size="sm" accent={detail.rank === 0} />
              )}
            </>
          ) : (
            <span className={cx(mono, css({ color: 'ink.muted' }))}>
              {detail?.excludedBy
                ? `${m.ruledOutBy[locale]} · ${detail.excludedBy}`
                : m.ruledOut[locale]}
            </span>
          )}
        </div>
      )}

      <div data-line className={css({ display: 'grid', gap: '1' })}>
        <span className={cx(mono, css({ color: 'ink.muted' }))}>{item.brand.name}</span>
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '3',
          })}
        >
          <span
            className={css({
              fontWeight: '600',
              fontSize: 'md',
              letterSpacing: '-0.01em',
              lineHeight: '1.15',
            })}
          >
            {item.name}
          </span>
          <span
            className={css({
              fontFamily: 'mono',
              fontSize: 'sm',
              flexShrink: '0',
              fontVariantNumeric: 'tabular-nums',
            })}
          >
            {formatPrice(item.priceEur, locale)}
          </span>
        </div>
        {item.tagline && (
          <p
            className={css({
              fontSize: 'xs',
              color: 'ink.muted',
              lineHeight: '1.4',
              lineClamp: '2',
            })}
          >
            {item.tagline[locale]}
          </p>
        )}
      </div>

      {!compact && (
        <div data-line className={ruled}>
          <KeySpecs item={item} locale={locale} />
        </div>
      )}

      {/* The card follows the pointer; the product under it opens on a click. */}
      <div
        data-line
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '3',
          borderTopWidth: '1px',
          borderColor: 'line',
          pt: '2.5',
          fontSize: 'xs',
          fontWeight: '550',
          '@media (hover: none)': { display: 'none' },
        })}
      >
        <span>{m.clickForSheet[locale]}</span>
        <span
          aria-hidden
          className={css({
            display: 'inline-block',
            color: 'signal',
            animation: 'nudge 1.8s ease-in-out infinite',
            _motionReduce: { animation: 'none' },
          })}
        >
          →
        </span>
      </div>
    </div>
  )
}
