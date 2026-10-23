import type { Locale } from '@choose/catalog'
import { type CSSProperties, useEffect, useLayoutEffect, useRef } from 'react'
import { css, cx } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { prefersReducedMotion } from '../motion/gsap'
import type { JourneyStop } from './JourneyBar'

// The journey as a column at the left of the console (the layout under test, layout.ts), standing
// on the paper like the counter above it: every question down one thread in the questionnaire's
// order, answered ones ticked with their answer under their name, those still ahead dashed, those
// the answers leave nothing to decide greyed out, and the results at the end. An ink bar marks the
// question on screen and slides to the next one, ticking the one it leaves when it was answered.
// Every stop is as tall answered as not, so nothing in the column moves but the bar. Any stop but a
// greyed one can be picked. Switching categories the column stays: its bar slides on from where it
// was while the new category's questions come in.

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

/** Every stop's height and the room between two (px): the bar moves by their sum. */
const ROW = 42
const GAP = 2

/** Where the bar stood on screen when the last category's page went, and when (ms). */
let handoff: { top: number; at: number } | null = null
/** Past this (ms), the next column is a new one rather than the last one carried over. */
const HANDOFF_MS = 1000

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
  /** The page replaces another category's: the bar slides on from where that one's was. */
  carryOver?: boolean
}

const caption = css({
  px: '2.5',
  pb: '2',
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  animation: 'fadeIn 0.4s ease backwards',
  _motionReduce: { animation: 'none' },
})

const track = css({
  position: 'relative',
  // Never as high as the counter in the top-left corner.
  maxH: 'calc(100dvh - 15rem)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
})

const bar = css({
  position: 'absolute',
  top: '0',
  insetInline: '0',
  zIndex: '0',
  borderRadius: 'card',
  bg: 'ink',
  boxShadow: '0 6px 16px -8px rgba(20,20,20,0.45)',
  pointerEvents: 'none',
  transition: 'transform 0.55s token(easings.signal)',
  _motionReduce: { transition: 'none' },
})

const list = css({ position: 'relative', zIndex: '1', display: 'grid' })

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
  _after: { top: '50%', bottom: '-2px' },
  '&:first-child::before, &:last-child::after': { display: 'none' },
})

const stop = css({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '1.25rem minmax(0, 1fr)',
  alignItems: 'center',
  columnGap: '2.5',
  w: '100%',
  h: '100%',
  px: '2.5',
  borderRadius: 'card',
  textAlign: 'left',
  fontSize: 'xs',
  color: 'ink.muted',
  cursor: 'pointer',
  transition: 'background 200ms, color 200ms',
  animation: 'fadeIn 0.4s ease backwards',
  animationDelay: 'calc(var(--i, 0) * 30ms + 80ms)',
  _motionReduce: { animation: 'none', transition: 'none' },
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
  // On the bar: its words turn light as the bar reaches them.
  '&[data-state=current]': {
    color: 'paper',
    fontWeight: '550',
    cursor: 'default',
    transitionDelay: '140ms',
    _hover: { color: 'paper', bg: 'transparent' },
  },
})

/** Where a stop is on the thread: ticked when answered, dashed ahead, the signal dot on the bar. */
const mark = css({
  display: 'grid',
  placeItems: 'center',
  w: '5',
  h: '5',
  borderRadius: 'full',
  bg: 'paper',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'line.strong',
  color: 'ink.muted',
  fontSize: '2xs',
  lineHeight: '1',
  transition: 'background 200ms, border-color 200ms',
  '[data-state=done] > &': { bg: 'ink', borderStyle: 'solid', borderColor: 'ink', color: 'paper' },
  '[data-state=current] > &': { bg: 'transparent', borderColor: 'transparent' },
  '[data-state=skipped] > &, :disabled > &': { borderColor: 'line' },
})

/** A tick or a dot pops in when its stop is answered, or reached. */
const pop = css({
  display: 'grid',
  placeItems: 'center',
  animation: 'railPop 0.36s cubic-bezier(0.34, 1.56, 0.64, 1) backwards',
  _motionReduce: { animation: 'none' },
})

const dot = css({ w: '1.5', h: '1.5', borderRadius: 'full', bg: 'signal' })

/**
 * The name, and the answer under it once there is one: without an answer the name sits in the
 * middle of its stop, and moves up to make room as the answer comes in.
 */
const words = css({
  display: 'grid',
  minW: '0',
  lineHeight: '1.25',
  transform: 'translateY(0.4375rem)',
  transition: 'transform 320ms token(easings.signal)',
  '&[data-answered]': { transform: 'none' },
  _motionReduce: { transition: 'none' },
})

const named = css({ truncate: true })

const answer = css({
  minH: '0.875rem',
  fontSize: '2xs',
  fontWeight: '400',
  color: 'ink.muted',
  truncate: true,
  opacity: 0,
  transition: 'opacity 260ms ease 90ms',
  '[data-answered] > &': { opacity: 1 },
  '[data-state=current] &': { color: 'paper/70' },
  _motionReduce: { transition: 'none' },
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

/** A stop's mark: what it holds says where the stop is. */
function Mark({ state }: { state: JourneyStop['state'] | 'end' }) {
  return (
    <span aria-hidden className={mark}>
      {state === 'done' && (
        <span className={pop}>
          <Tick />
        </span>
      )}
      {state === 'current' && <span className={cx(pop, dot)} />}
      {state === 'end' && '→'}
    </span>
  )
}

export function JourneyRail({
  stops,
  done,
  locale,
  onPick,
  results,
  onResults,
  carryOver = false,
}: Props) {
  const box = useRef<HTMLDivElement>(null)
  const ink = useRef<HTMLSpanElement>(null)
  const at = done ? stops.length : stops.findIndex((s) => s.state === 'current')
  /** Where the bar stands: on the stop on screen; it slides there in CSS. */
  const y = Math.max(0, at) * (ROW + GAP)

  // Taking over from another category's column, the bar first stands where that one's was on
  // screen, then slides on to its stop.
  useIsoLayoutEffect(() => {
    const el = ink.current
    const scroller = box.current
    const last =
      carryOver && handoff && performance.now() - handoff.at < HANDOFF_MS ? handoff : null
    handoff = null
    if (!el || !scroller || !last || prefersReducedMotion()) return
    const to = el.style.transform
    el.style.transition = 'none'
    el.style.transform = `translateY(${last.top - scroller.getBoundingClientRect().top + scroller.scrollTop}px)`
    el.getBoundingClientRect()
    el.style.transition = ''
    el.style.transform = to
  }, [])

  // Its page going, the column leaves where its bar stands on screen for the next category's.
  useIsoLayoutEffect(() => {
    const el = ink.current
    return () => {
      if (el) handoff = { top: el.getBoundingClientRect().top, at: performance.now() }
    }
  }, [])

  // The stop on screen stays in view when the column is too tall for the page and scrolls.
  useEffect(() => {
    const el = box.current
    if (!el || at < 0 || el.scrollHeight <= el.clientHeight) return
    const top = at * (ROW + GAP) - (el.clientHeight - ROW) / 2
    el.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [at])

  return (
    <nav aria-label={m.journey[locale]}>
      <p aria-hidden data-console-part className={caption}>
        {m.journey[locale]}
      </p>
      <div ref={box} className={track}>
        <span
          ref={ink}
          aria-hidden
          className={bar}
          style={{
            height: ROW,
            transform: `translateY(${y}px)`,
            visibility: at < 0 ? 'hidden' : undefined,
          }}
        />
        <ol className={list} style={{ gap: GAP }}>
          {/* One button per stop whatever its state, so a stop that changes state keeps its place
              and only its mark and words move. */}
          {stops.map((s, i) => {
            const answered = (s.state === 'done' || s.state === 'current') && !!s.value
            return (
              <li key={s.key} className={item} style={{ height: ROW }}>
                <button
                  type="button"
                  data-console-part
                  className={stop}
                  data-state={s.state}
                  disabled={s.state === 'skipped'}
                  aria-current={s.state === 'current' ? 'step' : undefined}
                  title={
                    s.state === 'ahead'
                      ? m.answerNow[locale]
                      : s.state === 'skipped'
                        ? m.nothingToDecide[locale]
                        : (s.value ?? undefined)
                  }
                  style={{ '--i': i } as CSSProperties}
                  onClick={() => s.state !== 'current' && onPick(s.key)}
                >
                  <Mark state={s.state} />
                  <span className={words} data-answered={answered ? '' : undefined}>
                    <span className={named}>{s.label}</span>
                    <span className={answer}>{answered ? s.value : null}</span>
                  </span>
                </button>
              </li>
            )
          })}
          <li className={item} style={{ height: ROW }}>
            <button
              type="button"
              data-console-part
              className={stop}
              data-state={done ? 'current' : 'end'}
              disabled={!done && results === 0}
              aria-current={done ? 'page' : undefined}
              style={{ '--i': stops.length } as CSSProperties}
              onClick={() => !done && onResults()}
            >
              <Mark state={done ? 'current' : 'end'} />
              <span className={words}>
                <span className={named}>{m.results[locale]}</span>
                <span className={answer} />
              </span>
            </button>
          </li>
        </ol>
      </div>
    </nav>
  )
}
