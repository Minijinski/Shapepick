import type { Locale } from '@choose/catalog'
import type { ReactNode } from 'react'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { MatchRing } from './Match'
import { formatPrice } from './specs'

// The two figures a buyer weighs first, side by side like the cells of a title block: the
// indicative price and, once there is something to rank on, the match. The labels share a line
// and the values the next, so the two read as a pair. An action (the results' "View details") ends
// the line of values when the block is wide enough, and goes under it when it is not.

type Props = {
  price: number
  /** 0 … 1; null before anything ranks the product (no answer to go on, or ruled out). */
  score: number | null
  /** The best match draws its ring in the signal colour. */
  accent?: boolean
  locale: Locale
  action?: ReactNode
}

const label = css({
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
})

const value = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  fontFamily: 'mono',
  fontSize: '2xl',
  lineHeight: '1',
  letterSpacing: '-0.02em',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
})

export function KeyFigures({ price, score, accent = false, locale, action }: Props) {
  const pct = score == null ? null : Math.round(Math.min(1, Math.max(0, score)) * 100)
  return (
    <div className={css({ containerType: 'inline-size' })}>
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'auto auto minmax(0, 1fr)',
          columnGap: '8',
          rowGap: '1.5',
          alignItems: 'center',
        })}
      >
        <dl className={css({ display: 'contents' })}>
          <div className={css({ display: 'contents' })}>
            <dt className={label} style={{ gridArea: '1 / 1' }}>
              {m.listPrice[locale]}
            </dt>
            <dd className={value} style={{ gridArea: '2 / 1' }}>
              {formatPrice(price, locale)}
            </dd>
          </div>
          {pct != null && (
            <div className={css({ display: 'contents' })}>
              <dt className={label} style={{ gridArea: '1 / 2' }}>
                {m.match[locale]}
              </dt>
              <dd className={value} style={{ gridArea: '2 / 2' }} title={m.matchHelp[locale]}>
                <MatchRing score={pct / 100} accent={accent} />
                {pct}&nbsp;%
              </dd>
            </div>
          )}
        </dl>
        {action && (
          <div
            className={css({
              gridColumn: '1 / -1',
              gridRow: '3',
              justifySelf: 'start',
              mt: '3',
              '@container (min-width: 27rem)': {
                gridColumn: '3',
                gridRow: '2',
                justifySelf: 'end',
                mt: '0',
              },
            })}
          >
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
