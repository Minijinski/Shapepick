import type { Locale } from '@choose/catalog'
import type { CSSProperties } from 'react'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'

// How well a product fits the answers: a ring that fills to the score with the number inside,
// and the word "match" beside it unless a column header already says it. The ring draws itself in
// when it appears and eases to the new score when the answers change.

const sizes = {
  sm: { box: 34, stroke: 3, font: 10.5 },
  md: { box: 40, stroke: 3, font: 12 },
  lg: { box: 52, stroke: 3.5, font: 15 },
} as const

const arc = css({
  fill: 'none',
  stroke: 'ink',
  strokeLinecap: 'round',
  transition: 'stroke-dashoffset 900ms token(easings.signal), stroke 300ms',
  animation: 'ringDraw 1.1s token(easings.signal) backwards',
  '&[data-accent]': { stroke: 'signal' },
  _motionReduce: { transition: 'none', animation: 'none' },
})

export function Match({
  score,
  locale,
  size = 'md',
  accent = false,
  label = true,
}: {
  score: number
  locale: Locale
  size?: keyof typeof sizes
  /** The best match draws its ring in the signal colour. */
  accent?: boolean
  /** The word beside the ring; off where a column header says it already. */
  label?: boolean
}) {
  const { box, stroke, font } = sizes[size]
  const r = (box - stroke) / 2
  const length = 2 * Math.PI * r
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100)
  return (
    <span
      title={m.matchHelp[locale]}
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2',
        flexShrink: '0',
        fontFamily: 'mono',
        fontSize: '2xs',
        color: 'ink.muted',
        whiteSpace: 'nowrap',
      })}
    >
      <svg
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
        role="img"
        aria-label={`${pct} % ${m.match[locale]}`}
      >
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          strokeWidth={stroke}
          className={css({ fill: 'none', stroke: 'line' })}
        />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - pct / 100)}
          transform={`rotate(-90 ${box / 2} ${box / 2})`}
          data-accent={accent || undefined}
          className={arc}
          style={{ '--ring': length } as CSSProperties}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={font}
          className={css({ fill: 'ink', fontFamily: 'mono', fontVariantNumeric: 'tabular-nums' })}
        >
          {pct}
          <tspan fontSize={font * 0.62} dx={0.5}>
            %
          </tspan>
        </text>
      </svg>
      {label && <span>{m.match[locale]}</span>}
    </span>
  )
}
