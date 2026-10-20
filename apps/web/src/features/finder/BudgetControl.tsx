import { ANY, type Locale, type RangeStep, readRange, writeRange } from '@choose/catalog'
import { css } from 'styled-system/css'
import { formatPrice } from '../product/specs'

// Two thumbs on one rail. The top of the rail means "no ceiling", so the answer stays open-ended
// rather than silently capping at the slider's maximum.

type Props = {
  step: RangeStep<unknown>
  draft: string | undefined
  onDraft: (value: string) => void
  locale: Locale
  labels: { min: string; max: string; noLimit: string }
}

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

export function BudgetControl({ step, draft, onDraft, locale, labels }: Props) {
  const [lo, hi] = step.bounds
  const range = readRange(draft)
  const [min, max] = range && range !== ANY ? [range[0], range[1] ?? hi] : [lo, hi]
  const set = (nextMin: number, nextMax: number) => {
    const a = Math.min(nextMin, nextMax - step.snap)
    const b = Math.max(nextMax, nextMin + step.snap)
    onDraft(writeRange([Math.max(lo, a), b >= hi ? null : b]))
  }
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100

  return (
    <div className={css({ display: 'grid', gap: '4', py: '2' })}>
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
