import type { Locale } from '@choose/catalog'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import type { JourneyStop } from './JourneyBar'
import { Sheet } from './Sheet'

// The whole questionnaire on a phone, in a sheet rather than in a bar too narrow for it: every
// question in its usual place down one thread, answered ones ticked with their answer under their
// name, the one on screen inked, those still ahead dashed, those the answers leave nothing to
// decide greyed out with the reason, and the results at the end. Any stop but a greyed one can be
// picked: the sheet folds away as the console moves there.

type Props = {
  /** Every question, in the questionnaire's own order. */
  stops: JourneyStop[]
  /** The results are on screen: their stop, at the end of the thread, is the one inked. */
  done: boolean
  /** Where the visitor is among the questions asked, and how many there are. */
  position: number
  total: number
  locale: Locale
  /** How many products the answers keep: with none, the results stop waits greyed out. */
  results: number
  onPick: (key: string) => void
  onResults: () => void
  onClose: () => void
}

/** Every stop's mark sits on one thread, from the stop above to the one below. */
const item = css({
  position: 'relative',
  '&::before, &::after': {
    content: '""',
    position: 'absolute',
    left: 'calc(0.75rem + 0.625rem - 0.5px)',
    w: '1px',
    bg: 'line.strong',
  },
  _before: { top: '0', bottom: '50%' },
  _after: { top: '50%', bottom: '0' },
  '&:first-child::before, &:last-child::after': { display: 'none' },
})

const stop = css({
  position: 'relative',
  // Over the thread: the stop on screen hides it under its ink.
  zIndex: '1',
  display: 'grid',
  gridTemplateColumns: '1.25rem minmax(0, 1fr) auto',
  alignItems: 'center',
  columnGap: '3',
  w: '100%',
  minH: '12',
  px: '3',
  py: '2',
  borderRadius: 'card',
  textAlign: 'left',
  fontSize: 'sm',
  lineHeight: '1.3',
  color: 'ink.muted',
  cursor: 'pointer',
  transition: 'background 200ms, color 200ms',
  _hover: { color: 'ink', bg: 'ink/6' },
  _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '-2px' },
  '&:is([data-state=done], [data-state=end])': { color: 'ink' },
  // Nothing left to decide, or no product to show: in its place, out of reach.
  '&:is([data-state=skipped], :disabled)': {
    color: 'ink.faint',
    cursor: 'default',
    _hover: { color: 'ink.faint', bg: 'transparent' },
  },
  '&[data-state=current]': {
    bg: 'ink',
    color: 'paper',
    fontWeight: '550',
    cursor: 'default',
    boxShadow: '0 6px 16px -8px rgba(20,20,20,0.45)',
    _hover: { bg: 'ink', color: 'paper' },
  },
})

/** Where a stop is on the thread: ticked when answered, dashed ahead, the signal dot on the ink. */
const mark = css({
  position: 'relative',
  zIndex: '1',
  display: 'grid',
  placeItems: 'center',
  w: '5',
  h: '5',
  borderRadius: 'full',
  bg: 'surface.raised',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'line.strong',
  color: 'ink.muted',
  fontSize: '2xs',
  lineHeight: '1',
  '[data-state=done] > &': { bg: 'ink', borderStyle: 'solid', borderColor: 'ink', color: 'paper' },
  '[data-state=current] > &': { bg: 'transparent', borderColor: 'transparent' },
  '[data-state=end] > &': { borderStyle: 'solid', borderColor: 'ink', color: 'ink' },
  '[data-state=skipped] > &, :disabled > &': { borderColor: 'line' },
})

const dot = css({ w: '1.5', h: '1.5', borderRadius: 'full', bg: 'signal' })

/** Under the name: the answer, or why there is nothing to decide. */
const under = css({
  display: 'block',
  fontSize: 'xs',
  fontWeight: '400',
  color: 'ink.muted',
  '[data-state=current] &': { color: 'paper/70' },
  '[data-state=skipped] &': { color: 'ink.faint' },
})

const Tick = () => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    width="10"
    height="10"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12l5 5 9-10" />
  </svg>
)

export function JourneySheet({
  stops,
  done,
  position,
  total,
  locale,
  results,
  onPick,
  onResults,
  onClose,
}: Props) {
  return (
    <Sheet
      label={m.journey[locale]}
      onClose={onClose}
      title={
        <span className={css({ display: 'flex', alignItems: 'baseline', gap: '2.5' })}>
          <span className={css({ fontSize: 'lg', fontWeight: '600', letterSpacing: '-0.02em' })}>
            {m.journey[locale]}
          </span>
          {!done && (
            <span
              className={css({
                fontFamily: 'mono',
                fontSize: 'xs',
                color: 'ink.faint',
                fontVariantNumeric: 'tabular-nums',
              })}
            >
              {String(position).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          )}
        </span>
      }
    >
      {(fold) => (
        <ol className={css({ display: 'grid', gap: '0.5', px: '2', pb: '3' })}>
          {stops.map((s) => {
            const answered = (s.state === 'done' || s.state === 'current') && !!s.value
            return (
              <li key={s.key} className={item}>
                <button
                  type="button"
                  className={stop}
                  data-state={s.state}
                  disabled={s.state === 'skipped'}
                  aria-current={s.state === 'current' ? 'step' : undefined}
                  onClick={() => {
                    if (s.state === 'current') return fold()
                    onPick(s.key)
                    fold()
                  }}
                >
                  <span aria-hidden className={mark}>
                    {s.state === 'done' && <Tick />}
                    {s.state === 'current' && <span className={dot} />}
                  </span>
                  <span className={css({ minW: '0' })}>
                    {s.label}
                    {answered && <span className={under}>{s.value}</span>}
                    {s.state === 'skipped' && (
                      <span className={under}>{m.nothingToDecide[locale]}</span>
                    )}
                  </span>
                  <span />
                </button>
              </li>
            )
          })}
          <li className={item}>
            <button
              type="button"
              className={stop}
              data-state={done ? 'current' : 'end'}
              disabled={!done && results === 0}
              aria-current={done ? 'page' : undefined}
              onClick={() => {
                if (!done) onResults()
                fold()
              }}
            >
              <span aria-hidden className={mark}>
                {done ? <span className={dot} /> : '→'}
              </span>
              <span>{m.results[locale]}</span>
              <span
                className={css({
                  fontFamily: 'mono',
                  fontSize: 'xs',
                  fontVariantNumeric: 'tabular-nums',
                })}
              >
                {String(results).padStart(3, '0')}
              </span>
            </button>
          </li>
        </ol>
      )}
    </Sheet>
  )
}
