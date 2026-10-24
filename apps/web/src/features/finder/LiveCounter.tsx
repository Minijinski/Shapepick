import type { ReactNode } from 'react'
import { css, cx } from 'styled-system/css'
import { Rolling, rollSlot } from '../motion/Rolling'

// The signature readout: how many products are left, ticking down with every answer. What it says
// the products are can be followed by a control of what is counted (the brands). Switching
// categories it stays on screen: its digits roll on from the last category's count to the new
// one, and only the words under them give way to the new category's. The controls beside them
// stay put: the words keep the room of the longest the counter may say.

/** The zeros that keep the count as wide as the total (045 of 523): they only hold the place. */
const placeZeros = css({ color: 'ink.faint' })

/** What the last category's counter showed as its page went. */
const slots = { value: rollSlot(), total: rollSlot() }

/** Carried over, what it counts comes in once the last category's words have gone. */
const arrive = css({
  '&[data-arrive]': { animation: 'fadeIn 0.45s ease 0.05s backwards' },
  _motionReduce: { '&[data-arrive]': { animation: 'none' } },
})

/** The words and, unseen in the same place, the longer ones it may say: the widest sets the room. */
const stacked = css({ display: 'inline-grid', '& > *': { gridArea: '1 / 1' } })
const unseen = css({ visibility: 'hidden' })

type Props = {
  value: number
  total: number
  label: string
  /** Everything it may say in place of `label` (the other categories'): the room it keeps. */
  labels?: readonly string[]
  preview: number | null
  previewLabel: string
  ofLabel: string
  /** The page replaces another category's: the digits roll on from that one's count. */
  carryOver?: boolean
  /** Beside the label: what narrows the count without being a question (the brand filter). */
  children?: ReactNode
}

export function LiveCounter({
  value,
  total,
  label,
  labels = [],
  preview,
  previewLabel,
  ofLabel,
  carryOver = false,
  children,
}: Props) {
  const arriving = carryOver ? '' : undefined
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
      <div className={css({ display: 'flex', alignItems: 'baseline', gap: '3' })}>
        <Rolling
          value={value}
          pad={String(total).length}
          padClassName={placeZeros}
          slot={slots.value}
          carryOver={carryOver}
          aria-live="polite"
          className={css({
            fontFamily: 'mono',
            fontSize: { base: '4xl', md: '6xl' },
            lineHeight: '0.9',
            letterSpacing: '-0.04em',
            fontVariantNumeric: 'tabular-nums',
            color: value === 0 ? 'ink.faint' : 'ink',
            transition: 'color 300ms',
          })}
        />
        <span className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'ink.faint' })}>
          {ofLabel} <Rolling value={total} slot={slots.total} carryOver={carryOver} />
        </span>
      </div>
      <div
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: '3',
          rowGap: '1.5',
          fontSize: 'sm',
          color: 'ink.muted',
          minH: '5',
        })}
      >
        <span data-swap-part data-arrive={arriving} className={cx(arrive, stacked)}>
          <span>{label}</span>
          {labels
            .filter((other) => other !== label)
            .map((other) => (
              <span key={other} aria-hidden className={unseen}>
                {other}
              </span>
            ))}
        </span>
        {children}
        {preview != null && preview !== value && (
          <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'signal' })}>
            → {preview} {previewLabel}
          </span>
        )}
      </div>
    </div>
  )
}
