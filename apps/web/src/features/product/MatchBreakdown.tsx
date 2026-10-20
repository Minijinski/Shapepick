import type { Locale } from '@choose/catalog'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'

// What the match is made of, so that the last product standing at 79 % makes sense: the answers it
// meets (every one of them, or it would not be listed) and how well it suits the visitor's use,
// the part that keeps a product that ticks every box short of 100 %.

type Props = {
  /** 0 … 1, the fit to the use. */
  fit: number
  /** Answers that narrow the catalogue, all met. */
  met: number
  /** The use the visitor picked; null when they have not said. */
  use: string | null
  locale: Locale
}

const row = css({
  display: 'grid',
  gridTemplateColumns: '1rem minmax(0, 1fr) auto',
  alignItems: 'baseline',
  columnGap: '2',
  rowGap: '1.5',
  py: '1.5',
  borderTopWidth: '1px',
  borderColor: 'line',
  fontSize: 'sm',
})

const value = css({ fontFamily: 'mono', fontSize: 'xs', fontVariantNumeric: 'tabular-nums' })

export function MatchBreakdown({ fit, met, use, locale }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, fit)) * 100)
  return (
    <div className={css({ display: 'grid', gap: '2' })}>
      <dl className={css({ display: 'grid' })}>
        {met > 0 && (
          <div className={row}>
            <span
              aria-hidden
              className={css({
                alignSelf: 'center',
                display: 'grid',
                placeItems: 'center',
                w: '3.5',
                h: '3.5',
                borderRadius: 'full',
                bg: 'ink',
                color: 'paper',
              })}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                width="9"
                height="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <dt>{m.yourAnswers[locale]}</dt>
            <dd className={value}>{m.allMet(met, locale)}</dd>
          </div>
        )}
        <div className={row}>
          <span
            aria-hidden
            className={css({
              alignSelf: 'center',
              w: '3.5',
              h: '3.5',
              borderRadius: 'full',
              borderWidth: '2px',
              borderColor: 'ink',
            })}
            // The share of the ring filled is the fit.
            style={{
              background: `conic-gradient(var(--colors-ink) ${pct}%, transparent 0)`,
            }}
          />
          <dt className={css({ minW: '0' })}>
            {use ? m.forYourUse[locale] : m.overallQuality[locale]}
            {use && <span className={css({ color: 'ink.muted' })}> · {use}</span>}
          </dt>
          <dd className={value}>{pct} %</dd>
          <span
            aria-hidden
            className={css({
              gridColumn: '2 / -1',
              h: '1',
              borderRadius: 'full',
              bg: 'line',
              overflow: 'hidden',
            })}
          >
            <span
              className={css({
                display: 'block',
                h: '100%',
                bg: 'ink',
                borderRadius: 'full',
                transformOrigin: 'left center',
                animation: 'lineDraw 0.9s token(easings.signal) backwards',
                _motionReduce: { animation: 'none' },
              })}
              style={{ width: `${pct}%` }}
            />
          </span>
        </div>
      </dl>
      <p className={css({ fontSize: 'xs', lineHeight: '1.5', color: 'ink.muted' })}>
        {m.matchNote[locale]}
      </p>
    </div>
  )
}
