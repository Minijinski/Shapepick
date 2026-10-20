import { ANY, type Bin, type Locale, type RangeStep, readRange, writeRange } from '@choose/catalog'
import { css } from 'styled-system/css'
import { formatPrice } from '../product/specs'

// Two thumbs on one rail, under the price histogram of what the other answers leave: the bars in
// the range turn ink as the thumbs move. The top of the rail means "no ceiling", so the answer
// stays open-ended rather than silently capping at the slider's maximum.

type Props = {
  step: RangeStep<unknown>
  draft: string | undefined
  onDraft: (value: string) => void
  bins: Bin[]
  locale: Locale
  labels: { min: string; max: string; noLimit: string }
}

const bar = css({
  flex: '1',
  minW: '0',
  borderTopRadius: '2px',
  transition: 'height 400ms token(easings.signal), background-color 200ms',
})
const barIn = css({ bg: 'ink' })
const barOut = css({ bg: 'line' })

const thumb = css({
  position: 'absolute',
  inset: '0',
  w: '100%',
  appearance: 'none',
  bg: 'transparent',
  pointerEvents: 'none',
  '&::-webkit-slider-thumb': {
    appearance: 'none',
    pointerEvents: 'auto',
    w: '6',
    h: '6',
    borderRadius: 'full',
    bg: 'surface.raised',
    border: '2px solid token(colors.ink)',
    cursor: 'grab',
    boxShadow: '0 2px 8px rgba(20,20,20,0.18)',
  },
  '&::-moz-range-thumb': {
    pointerEvents: 'auto',
    w: '5',
    h: '5',
    borderRadius: 'full',
    bg: 'surface.raised',
    border: '2px solid token(colors.ink)',
    cursor: 'grab',
  },
  _focusVisible: { outline: 'none', '&::-webkit-slider-thumb': { borderColor: 'signal' } },
})

export function BudgetControl({ step, draft, onDraft, bins, locale, labels }: Props) {
  const [lo, hi] = step.bounds
  const range = readRange(draft)
  const [min, max] = range && range !== ANY ? [range[0], range[1] ?? hi] : [lo, hi]
  const set = (nextMin: number, nextMax: number) => {
    const a = Math.min(nextMin, nextMax - step.snap)
    const b = Math.max(nextMax, nextMin + step.snap)
    onDraft(writeRange([Math.max(lo, a), b >= hi ? null : b]))
  }
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100
  const peak = Math.max(1, ...bins.map((b) => b.count))

  return (
    <div
      className={css({
        h: '100%',
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr) auto auto',
        gap: '3',
        pt: '1',
      })}
    >
      <div
        aria-hidden
        className={css({ minH: '0', display: 'flex', alignItems: 'flex-end', gap: '2px' })}
      >
        {bins.map((bin) => (
          <span
            key={bin.from}
            className={`${bar} ${bin.to > min && (max >= hi || bin.from < max) ? barIn : barOut}`}
            style={{ height: `${Math.max(3, (bin.count / peak) * 100)}%` }}
          />
        ))}
      </div>
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'mono',
          fontSize: 'sm',
        })}
      >
        <span>
          <span className={css({ color: 'ink.faint', mr: '2' })}>{labels.min}</span>
          {formatPrice(min, locale)}
        </span>
        <span>
          <span className={css({ color: 'ink.faint', mr: '2' })}>{labels.max}</span>
          {max >= hi ? labels.noLimit : formatPrice(max, locale)}
        </span>
      </div>
      <div className={css({ position: 'relative', h: '6' })}>
        <div
          className={css({
            position: 'absolute',
            insetInline: '0',
            top: '50%',
            h: '1',
            mt: '-0.5',
            bg: 'line',
            borderRadius: 'full',
          })}
        />
        <div
          className={css({
            position: 'absolute',
            top: '50%',
            h: '1',
            mt: '-0.5',
            bg: 'ink',
            borderRadius: 'full',
          })}
          style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }}
        />
        <input
          type="range"
          aria-label={labels.min}
          className={thumb}
          min={lo}
          max={hi}
          step={step.snap}
          value={min}
          onChange={(e) => set(Number(e.target.value), max)}
        />
        <input
          type="range"
          aria-label={labels.max}
          className={thumb}
          min={lo}
          max={hi}
          step={step.snap}
          value={max}
          onChange={(e) => set(min, Number(e.target.value))}
        />
      </div>
    </div>
  )
}
