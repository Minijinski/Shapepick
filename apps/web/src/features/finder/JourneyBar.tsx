import type { JourneyState, Locale } from '@choose/catalog'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { gsap, prefersReducedMotion } from '../motion/gsap'
import { motion } from '../motion/tokens'

// The whole questionnaire under the console, as one chain that never reorders: every question in
// its usual place, answered ones ticked with their answer, those still ahead dashed, those the
// answers leave nothing to decide greyed out until the answers widen, and the results at the end.
// It is the one place where the visitor sees and changes the answers given so far: the question
// on screen (or the results, once they are open) is inked in place, and any other stop can be
// picked, so the questions are taken in any order. A chain wider than the bar scrolls: it can be
// dragged, the side it runs past fades and shows an arrow, and the stop on screen comes to the
// middle.

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

export type JourneyStop = {
  key: string
  label: string
  /** The answer, for an answered stop. */
  value: string | null
  state: JourneyState
}

type Props = {
  /** Every question, in the questionnaire's own order. */
  stops: JourneyStop[]
  /** The results are on screen: their stop, at the end of the chain, is the one inked. */
  done: boolean
  locale: Locale
  onPick: (key: string) => void
  /** How many products the answers keep: with none, the results stop waits greyed out. */
  results: number
  onResults: () => void
  /** Seconds before the stops fade in. */
  enterDelay?: number
}

/** How far (px) a press moves before it drags the chain rather than picking a stop. */
const DRAG_START = 5
/** How long (ms) a flung chain keeps scrolling for every px/ms it was thrown at. */
const FLING = 260

const bar = css({
  display: 'flex',
  alignItems: 'center',
  h: '11',
  px: '1',
  bg: 'surface.raised/80',
  backdropFilter: 'blur(10px)',
  borderWidth: '1px',
  borderColor: 'line',
  borderRadius: 'pill',
  boxShadow: '0 14px 32px -24px rgba(20,20,20,0.4)',
})

const map = css({
  position: 'relative',
  flex: '1',
  minW: '0',
  h: '100%',
  animation: 'fadeUp 0.6s token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
  // The stops that run past the bar fade out on that side only (styles.css registers the two
  // lengths, so the fades ease in and out).
  '&[data-more-before]': { '--fade-before': '44px' },
  '&[data-more-after]': { '--fade-after': '44px' },
})

const track = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  h: '100%',
  px: '2',
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
  touchAction: 'pan-x',
  maskImage:
    'linear-gradient(to right, transparent, #000 var(--fade-before), #000 calc(100% - var(--fade-after)), transparent)',
  transition: '--fade-before 240ms ease, --fade-after 240ms ease',
  '[data-more-before] > &, [data-more-after] > &': { cursor: 'grab' },
  '&[data-dragging]': { cursor: 'grabbing' },
})

const item = css({ display: 'flex', alignItems: 'center', flexShrink: '0' })

const link = css({ w: '2.5', h: '1px', bg: 'line.strong' })

const stop = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1.5',
  h: '7',
  px: '2.5',
  borderRadius: 'pill',
  borderWidth: '1px',
  borderColor: 'transparent',
  fontSize: 'xs',
  whiteSpace: 'nowrap',
  color: 'ink.muted',
  cursor: 'pointer',
  transition: 'background 220ms, color 220ms, border-color 220ms, box-shadow 220ms',
  _hover: { color: 'ink', bg: 'ink/6' },
  _focusVisible: {
    outline: '2px solid',
    outlineColor: 'signal',
    outlineOffset: '2px',
  },
  '&[data-state=done]': { color: 'ink' },
  // Still ahead (and the results, while they wait at the end): a dashed outline, the shape of
  // somewhere not reached yet, drawn in full under the pointer.
  '&:is([data-state=ahead], [data-state=end])': {
    borderStyle: 'dashed',
    borderColor: 'line.strong',
    _hover: { borderStyle: 'solid', borderColor: 'ink', bg: 'transparent' },
  },
  '&[data-state=end]': {
    color: 'ink',
    _disabled: {
      color: 'ink.faint',
      borderColor: 'line',
      cursor: 'default',
      _hover: { borderStyle: 'dashed', borderColor: 'line' },
    },
  },
  // Nothing left to decide: still in its place, faded out of reach.
  '&[data-state=skipped]': {
    color: 'ink.faint',
    borderStyle: 'dashed',
    borderColor: 'line',
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

const tick = css({
  display: 'grid',
  placeItems: 'center',
  w: '3.5',
  h: '3.5',
  borderRadius: 'full',
  bg: 'ink',
  color: 'paper',
})

const dot = css({ w: '1.5', h: '1.5', borderRadius: 'full', bg: 'signal' })

/** An answered question’s answer, after its name, cut short when it is long. */
const answer = css({
  maxW: '11rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  color: 'ink.muted',
  animation: 'fadeIn 0.4s ease backwards',
  _motionReduce: { animation: 'none' },
  _before: { content: '"·"', mr: '1.5', color: 'ink.faint' },
})

/** The arrows at the ends of a chain that runs past the bar: shown on the side it runs past. */
const nudge = css({
  position: 'absolute',
  top: '50%',
  zIndex: '1',
  display: 'grid',
  placeItems: 'center',
  w: '7',
  h: '7',
  mt: '-3.5',
  borderRadius: 'full',
  bg: 'surface.raised',
  borderWidth: '1px',
  borderColor: 'line',
  color: 'ink.muted',
  cursor: 'pointer',
  opacity: 0,
  transform: 'scale(0.7)',
  pointerEvents: 'none',
  transition: 'opacity 200ms, transform 260ms token(easings.signal), color 160ms',
  _hover: { color: 'ink', borderColor: 'line.strong' },
  _focusVisible: {
    outline: '2px solid',
    outlineColor: 'signal',
    outlineOffset: '2px',
  },
  '&[data-side=before]': { left: '0' },
  '&[data-side=after]': { right: '0' },
  '&[data-shown]': { opacity: 1, transform: 'none', pointerEvents: 'auto' },
  _motionReduce: { transition: 'none' },
})

const Tick = () => (
  <span aria-hidden className={tick}>
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
)

const Chevron = ({ d }: { d: string }) => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
)

export function JourneyBar({
  stops,
  done,
  locale,
  onPick,
  results,
  onResults,
  enterDelay = 0,
}: Props) {
  const list = useRef<HTMLOListElement>(null)
  /** Whether the chain runs past the bar, before and after what it shows. */
  const [more, setMore] = useState({ before: false, after: false })
  const current = done ? '·results' : (stops.find((s) => s.state === 'current')?.key ?? null)
  const centred = useRef(false)

  // Which ends the chain runs past, as it scrolls, as the bar resizes and as stops change.
  const measured = useRef(more)
  const measure = useCallback(() => {
    const el = list.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const before = el.scrollLeft > 1
    const after = el.scrollLeft < max - 1
    // Only a change re-renders the bar: measuring never sets off another measure.
    if (measured.current.before === before && measured.current.after === after) return
    measured.current = { before, after }
    setMore(measured.current)
  }, [])
  useIsoLayoutEffect(() => measure(), [measure, stops, done])

  // Dragged with a mouse or a pen (a finger scrolls it natively), flung when let go mid-move, and
  // scrolled by a plain wheel; the click that ends a drag picks nothing.
  useEffect(() => {
    const el = list.current
    if (!el) return
    let press: {
      id: number
      x: number
      left: number
      t: number
      v: number
      moved: boolean
    } | null = null
    let swallow = false
    const runsPast = () => el.scrollWidth > el.clientWidth + 1
    const down = (e: PointerEvent) => {
      swallow = false
      if (e.pointerType === 'touch' || e.button !== 0 || !runsPast()) return
      gsap.killTweensOf(el)
      press = {
        id: e.pointerId,
        x: e.clientX,
        left: el.scrollLeft,
        t: performance.now(),
        v: 0,
        moved: false,
      }
    }
    const move = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return
      const dx = e.clientX - press.x
      if (!press.moved) {
        if (Math.abs(dx) < DRAG_START) return
        press.moved = true
        el.setPointerCapture(e.pointerId)
        el.dataset.dragging = ''
      }
      const now = performance.now()
      const from = el.scrollLeft
      el.scrollLeft = press.left - dx
      press.v = press.v * 0.5 + ((el.scrollLeft - from) / Math.max(8, now - press.t)) * 0.5
      press.t = now
    }
    const up = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return
      const { moved, v, t } = press
      press = null
      if (!moved) return
      delete el.dataset.dragging
      swallow = true
      // A chain let go while still moving glides on a little; one held still stays put.
      if (performance.now() - t < 80 && Math.abs(v) > 0.05 && !prefersReducedMotion()) {
        gsap.to(el, { scrollLeft: el.scrollLeft + v * FLING, duration: 0.6, ease: 'power3.out' })
      }
    }
    const click = (e: MouseEvent) => {
      if (!swallow) return
      swallow = false
      e.preventDefault()
      e.stopPropagation()
    }
    const wheel = (e: WheelEvent) => {
      if (!runsPast() || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      gsap.killTweensOf(el)
      el.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : 1)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    el.addEventListener('scroll', measure, { passive: true })
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('click', click, true)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      gsap.killTweensOf(el)
      observer.disconnect()
      el.removeEventListener('scroll', measure)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('click', click, true)
      el.removeEventListener('wheel', wheel)
    }
  }, [measure])

  // The stop on screen comes to the middle of the bar (at once the first time).
  useEffect(() => {
    const el = list.current
    const on = el?.querySelector<HTMLElement>('[aria-current]')
    if (!el || !on || current == null) return
    const to = Math.max(
      0,
      Math.min(
        on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2,
        el.scrollWidth - el.clientWidth,
      ),
    )
    const first = !centred.current
    centred.current = true
    if (Math.abs(to - el.scrollLeft) < 2) return
    gsap.killTweensOf(el)
    if (first || prefersReducedMotion()) el.scrollLeft = to
    else gsap.to(el, { scrollLeft: to, duration: motion.base + 0.1, ease: motion.ease })
  }, [current])

  /** Scrolls the chain by most of the bar's width, back or on. */
  const page = (dir: -1 | 1) => {
    const el = list.current
    if (!el) return
    const to = Math.max(
      0,
      Math.min(el.scrollLeft + dir * el.clientWidth * 0.7, el.scrollWidth - el.clientWidth),
    )
    gsap.killTweensOf(el)
    if (prefersReducedMotion()) el.scrollLeft = to
    else gsap.to(el, { scrollLeft: to, duration: motion.base, ease: motion.ease })
  }

  return (
    <nav aria-label={m.journey[locale]} data-journey-bar className={bar}>
      <div
        data-console-part
        data-more-before={more.before || undefined}
        data-more-after={more.after || undefined}
        className={map}
        style={{ animationDelay: `${enterDelay}s` }}
      >
        <button
          type="button"
          data-side="before"
          data-shown={more.before || undefined}
          className={nudge}
          aria-label={m.scrollBack[locale]}
          aria-hidden={!more.before || undefined}
          tabIndex={more.before ? undefined : -1}
          onClick={() => page(-1)}
        >
          <Chevron d="M15 6l-6 6 6 6" />
        </button>
        <ol ref={list} className={track}>
          {stops.map((s, i) => (
            <li key={s.key} className={item}>
              {i > 0 && <span aria-hidden className={link} />}
              {s.state === 'current' ? (
                <span className={stop} data-state="current" aria-current="step">
                  <span aria-hidden className={dot} />
                  {s.label}
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
                  {s.state === 'done' && <Tick />}
                  {s.label}
                  {s.state === 'done' && s.value && <span className={answer}>{s.value}</span>}
                </button>
              )}
            </li>
          ))}
          <li className={item}>
            <span aria-hidden className={link} />
            {done ? (
              <span className={stop} data-state="current" aria-current="page">
                <span aria-hidden className={dot} />
                {m.results[locale]}
              </span>
            ) : (
              <button
                type="button"
                className={stop}
                data-state="end"
                disabled={results === 0}
                onClick={onResults}
              >
                {m.results[locale]}
                <span aria-hidden>→</span>
              </button>
            )}
          </li>
        </ol>
        <button
          type="button"
          data-side="after"
          data-shown={more.after || undefined}
          className={nudge}
          aria-label={m.scrollMore[locale]}
          aria-hidden={!more.after || undefined}
          tabIndex={more.after ? undefined : -1}
          onClick={() => page(1)}
        >
          <Chevron d="M9 6l6 6-6 6" />
        </button>
      </div>
    </nav>
  )
}
