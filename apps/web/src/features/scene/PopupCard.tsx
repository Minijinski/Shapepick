import type { CatalogItem, Locale } from '@choose/catalog'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { formatPrice, sheetSpecs } from '../product/specs'
import type { ItemDetail } from './controller'

// The card that opens next to a product on the canvas: what it is, how well it fits the answers
// (or which answer rules it out), and its spec sheet, set like a callout on a technical drawing.

const card = css({
  w: { base: '60', md: '72' },
  bg: 'surface.raised/92',
  backdropFilter: 'blur(14px) saturate(1.2)',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderColor: 'line',
  boxShadow: 'panel',
  p: { base: '3.5', md: '4' },
  display: 'grid',
  gap: '3',
  animation: 'cardIn 320ms token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
})

const row = css({
  display: 'grid',
  gridTemplateColumns: '5.5rem 1fr',
  gap: '2',
  alignItems: 'baseline',
  py: '1',
  borderTopWidth: '1px',
  borderColor: 'line',
  animation: 'fadeUp 360ms token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
})

export function PopupCard({
  item,
  detail,
  locale,
}: {
  item: CatalogItem
  detail: ItemDetail | null
  locale: Locale
}) {
  const kept = detail?.rank != null
  const score = detail?.score != null ? Math.round(detail.score * 100) : null
  return (
    <div className={card}>
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '3',
          fontFamily: 'mono',
          fontSize: '2xs',
          color: 'ink.faint',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        })}
      >
        {kept ? (
          <>
            <span className={css({ color: detail?.rank === 0 ? 'signal' : 'ink.muted' })}>
              {String((detail?.rank ?? 0) + 1).padStart(2, '0')}
            </span>
            {score != null && (
              <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '2' })}>
                <span
                  className={css({
                    position: 'relative',
                    w: '10',
                    h: '1',
                    bg: 'line',
                    borderRadius: 'full',
                    overflow: 'hidden',
                  })}
                >
                  <span
                    className={css({
                      position: 'absolute',
                      insetBlock: '0',
                      left: '0',
                      bg: 'ink',
                      borderRadius: 'full',
                    })}
                    style={{ width: `${score}%` }}
                  />
                </span>
                {score}% {m.match[locale]}
              </span>
            )}
          </>
        ) : (
          <span>
            {detail?.excludedBy
              ? `${m.ruledOutBy[locale]} · ${detail.excludedBy}`
              : m.ruledOut[locale]}
          </span>
        )}
      </div>

      <div className={css({ display: 'grid', gap: '1' })}>
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
              letterSpacing: '-0.02em',
              lineHeight: '1.15',
            })}
          >
            <span className={css({ color: 'ink.muted', fontWeight: '500' })}>
              {item.brand.name}
            </span>{' '}
            {item.name}
          </span>
          <span className={css({ fontFamily: 'mono', fontSize: 'sm', flexShrink: '0' })}>
            {formatPrice(item.priceEur, locale)}
          </span>
        </div>
        {item.tagline && (
          <p className={css({ fontSize: 'xs', color: 'ink.muted', lineHeight: '1.4' })}>
            {item.tagline[locale]}
          </p>
        )}
      </div>

      <dl className={css({ display: 'grid' })}>
        {sheetSpecs(item, locale).map((spec, i) => (
          <div key={spec.label} className={row} style={{ animationDelay: `${60 + i * 25}ms` }}>
            <dt
              className={css({
                fontFamily: 'mono',
                fontSize: '2xs',
                color: 'ink.faint',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              })}
            >
              {spec.label}
            </dt>
            <dd className={css({ fontSize: 'xs', lineHeight: '1.35' })}>{spec.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
