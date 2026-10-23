import type { Locale } from '@choose/catalog'
import { useEffect, useRef } from 'react'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { prefersReducedMotion } from '../motion/gsap'
import type { JourneyStop } from './JourneyBar'

// The journey as a column at the left of the console (the layout under test, layout.ts): every
// question down one thread in the questionnaire's order, answered ones ticked with their answer
// under their name, the one on screen inked in place, those still ahead dashed, those the answers
// leave nothing to decide greyed out, and the results at the end. Any stop but a greyed one can be
// picked, so the questions are taken in any order. A column taller than the room left scrolls,
// and keeps the stop on screen in view.

type Props = {
  /** Every question, in the questionnaire's own order. */
  stops: JourneyStop[]
  /** The results are on screen: their stop, at the end of the thread, is the one inked. */
  done: boolean
  locale: Locale
  onPick: (key: string) => void
  /** How many products the answers keep: with none, the results stop waits greyed out. */
  results: number
  onResults: () => void
}

const panel = css({
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  // Never as high as the counter in the top-left corner.
  maxH: 'calc(100dvh - 13rem)',
  bg: 'surface.raised/80',
  backdropFilter: 'blur(10px)',
  borderWidth: '1px',
  borderColor: 'line',
  borderRadius: 'panel',
  boxShadow: '0 14px 32px -24px rgba(20,20,20,0.4)',
  overflow: 'hidden',
})

const caption = css({
  px: '4',
  pt: '3.5',
  pb: '1.5',
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
})

const list = css({
  position: 'relative',
  minH: '0',
  px: '2',
  pb: '2',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
})

/** The thread through the stops' marks: from the one above to this one, and on to the next. */
const item = css({
  position: 'relative',
  '&::before, &::after': {
    content: '""',
    position: 'absolute',
    left: 'calc(0.625rem + 0.625rem - 0.5px)',
    w: '1px',
    bg: 'line.strong',
  },
  _before: { top: '0', bottom: '50%' },
  _after: { top: '50%', bottom: '0' },
  '&:first-child::before, &:last-child::after': { display: 'none' },
})

const stop = css({
  position: 'relative',
  zIndex: '1',
  display: 'grid',
  gridTemplateColumns: '1.25rem minmax(0, 1fr)',
  alignItems: 'center',
  columnGap: '2.5',
  w: '100%',
  minH: '9',
  px: '2.5',
  py: '1.5',
  borderRadius: 'card',
  textAlign: 'left',
  fontSize: 'xs',
  color: 'ink.muted',
  cursor: 'pointer',
  transition: 'background 220ms, color 220ms, box-shadow 220ms',
  _hover: { color: 'ink', bg: 'ink/6' },
  _focusVisible: {
    outline: '2px solid',
    outlineColor: 'signal',
    outlineOffset: '2px',
  },
  '&:is([data-state=done], [data-state=end])': { color: 'ink' },
  // Nothing left to decide, or no product to show: in its place, faded out of reach.
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

/** Where a stop is on the thread: ticked when answered, dashed ahead, the signal dot on screen. */
const mark = css({
  display: 'grid',
  placeItems: 'center',
  w: '5',
  h: '5',
  borderRadius: 'full',
  bg: 'surface.raised',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'line.strong',
  fontSize: '2xs',
  lineHeight: '1',
  '[data-state=done] > &': { bg: 'ink', borderStyle: 'solid', borderColor: 'ink', color: 'paper' },
  '[data-state=current] > &': { bg: 'transparent', borderColor: 'transparent' },
  '[data-state=skipped] > &, :disabled > &': { borderColor: 'line' },
})

const dot = css({ w: '1.5', h: '1.5', borderRadius: 'full', bg: 'signal' })

const words = css({ display: 'grid', minW: '0', lineHeight: '1.25' })

const named = css({ truncate: true })

/** An answered question's answer, under its name, cut short when it is long. */
const answer = css({
  mt: '0.5',
  fontSize: '2xs',
  color: 'ink.muted',
  truncate: true,
  animation: 'fadeIn 0.4s ease backwards',
  _motionReduce: { animation: 'none' },
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

export function JourneyRail({ stops, done, locale, onPick, results, onResults }: Props) {
  const box = useRef<HTMLOListElement>(null)
  const current = done ? '·results' : (stops.find((s) => s.state === 'current')?.key ?? null)

  // The stop on screen stays in view when the column scrolls (at once the first time).
  const shown = useRef(false)
  useEffect(() => {
    const el = box.current
    const on = el?.querySelector('[aria-current]')?.closest('li')
    if (!el || !on || current == null) return
    const top = on.offsetTop - (el.clientHeight - on.offsetHeight) / 2
    const first = !shown.current
    shown.current = true
    el.scrollTo({
      top: Math.max(0, top),
      behavior: first || prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [current])

  return (
    <nav aria-label={m.journey[locale]} className={panel}>
      <p aria-hidden className={caption}>
        {m.journey[locale]}
      </p>
      <ol ref={box} data-console-part className={list}>
        {stops.map((s) => (
          <li key={s.key} className={item}>
            {s.state === 'current' ? (
              <span className={stop} data-state="current" aria-current="step">
                <span aria-hidden className={mark}>
                  <span className={dot} />
                </span>
                <span className={named}>{s.label}</span>
              </span>
            ) : (
              <button
                type="button"
                className={stop}
                data-state={s.state}
                disabled={s.state === 'skipped'}
                title={
                  s.state === 'ahead'
                    ? m.answerNow[locale]
                    : s.state === 'skipped'
                      ? m.nothingToDecide[locale]
                      : (s.value ?? undefined)
                }
                onClick={() => onPick(s.key)}
              >
                <span aria-hidden className={mark}>
                  {s.state === 'done' && <Tick />}
                </span>
                <span className={words}>
                  <span className={named}>{s.label}</span>
                  {s.state === 'done' && s.value && <span className={answer}>{s.value}</span>}
                </span>
              </button>
            )}
          </li>
        ))}
        <li className={item}>
          {done ? (
            <span className={stop} data-state="current" aria-current="page">
              <span aria-hidden className={mark}>
                <span className={dot} />
              </span>
              <span className={named}>{m.results[locale]}</span>
            </span>
          ) : (
            <button
              type="button"
              className={stop}
              data-state="end"
              disabled={results === 0}
              onClick={onResults}
            >
              <span aria-hidden className={mark}>
                →
              </span>
              <span className={named}>{m.results[locale]}</span>
            </button>
          )}
        </li>
      </ol>
    </nav>
  )
}
