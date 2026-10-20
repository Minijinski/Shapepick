import type { Locale } from '@choose/catalog'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { Flip, gsap, prefersReducedMotion } from '../motion/gsap'
import { motion } from '../motion/tokens'

// The whole questionnaire under the console, as a map that never reorders: every question in its
// usual place, answered ones ticked, those still ahead dashed. The question being answered is
// lifted out of the map into the "In progress" slot at the start of the bar (the results take that
// slot once they are open). Picking a stop moves it up into the slot and the question it replaces
// back to its place, so the visitor takes the questions in any order without anything else
// moving: GSAP Flip carries the stops between the slot and the map.

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

export type JourneyStop = {
  key: string
  label: string
  /** The answer, for an answered stop. */
  value: string | null
  state: 'done' | 'current' | 'ahead'
}

type Props = {
  /** Every question asked, in the questionnaire's own order. */
  stops: JourneyStop[]
  /** The results are on screen: they hold the slot instead of a question. */
  done: boolean
  locale: Locale
  /** First visit: a bubble says the questions can be taken in any order. */
  hint: boolean
  onDismissHint: () => void
  onPick: (key: string) => void
  /** Seconds before the stops fade in. */
  enterDelay?: number
}

const RESULTS = '·results'

const bar = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  h: '11',
  px: '1.5',
  bg: 'surface.raised/80',
  backdropFilter: 'blur(10px)',
  borderWidth: '1px',
  borderColor: 'line',
  borderRadius: 'pill',
  boxShadow: '0 14px 32px -24px rgba(20,20,20,0.4)',
})

const slot = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2.5',
  flexShrink: '0',
  pl: { base: '0', md: '2.5' },
})

const caption = css({
  display: { base: 'none', md: 'block' },
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
})

const map = css({
  position: 'relative',
  flex: '1',
  minW: '0',
  h: '100%',
  animation: 'fadeUp 0.6s token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
})

const track = css({
  display: 'flex',
  alignItems: 'center',
  h: '100%',
  px: '3',
  overflowX: 'auto',
  scrollbarWidth: 'none',
  // The stops that scroll out of a narrow bar fade at its ends.
  maskImage:
    'linear-gradient(to right, transparent, #000 12px, #000 calc(100% - 12px), transparent)',
})

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
  transition: 'background 220ms, color 220ms, border-color 220ms',
  _hover: { color: 'ink', bg: 'ink/6' },
  _focusVisible: {
    outline: '2px solid',
    outlineColor: 'signal',
    outlineOffset: '2px',
  },
  '&[data-state=done]': { color: 'ink' },
  // Still ahead: a dashed outline, the shape of a question not asked yet. Hovered, it shows the
  // arrow that sends it up into the slot.
  '&[data-state=ahead]': {
    borderStyle: 'dashed',
    borderColor: 'line.strong',
    _hover: { borderStyle: 'solid', borderColor: 'ink', bg: 'transparent' },
  },
  '&:is(:hover, :focus-visible) [data-lift]': { opacity: 1, transform: 'scale(1)' },
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

const lift = css({
  position: 'absolute',
  top: '-1.5',
  right: '-1.5',
  display: 'grid',
  placeItems: 'center',
  w: '3.5',
  h: '3.5',
  borderRadius: 'full',
  bg: 'ink',
  color: 'paper',
  fontSize: '9px',
  lineHeight: '1',
  opacity: 0,
  transform: 'scale(0.6)',
  transition: 'opacity 180ms, transform 260ms token(easings.signal)',
  pointerEvents: 'none',
})

const dot = css({ w: '1.5', h: '1.5', borderRadius: 'full', bg: 'signal' })

const bubble = css({
  position: 'absolute',
  left: '2',
  bottom: 'calc(100% + 12px)',
  zIndex: '2',
  display: 'flex',
  alignItems: 'center',
  gap: '3',
  maxW: 'min(20rem, calc(100vw - 3rem))',
  py: '2',
  pl: '3.5',
  pr: '2',
  borderRadius: 'card',
  bg: 'ink',
  color: 'paper',
  fontSize: 'xs',
  lineHeight: '1.4',
  boxShadow: '0 16px 36px -18px rgba(20,20,20,0.6)',
  animation: 'fadeUp 0.5s token(easings.signal) 0.6s backwards',
  _motionReduce: { animation: 'none' },
  // A notch pointing down at the map.
  _after: {
    content: '""',
    position: 'absolute',
    top: '100%',
    left: '6',
    borderWidth: '6px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderTopColor: 'ink',
  },
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

export function JourneyBar({
  stops,
  done,
  locale,
  hint,
  onDismissHint,
  onPick,
  enterDelay = 0,
}: Props) {
  const nav = useRef<HTMLElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const state = useRef<Flip.FlipState | null>(null)
  const current = stops.find((s) => s.state === 'current')
  const rest = stops.filter((s) => s !== current)
  const held = current?.key ?? (done ? RESULTS : null)
  const signature = `${held}|${rest.map((s) => s.key).join('|')}`

  // A stop that changes place (into the slot, back to the map) travels there; the map closes or
  // opens the gap it leaves.
  useIsoLayoutEffect(() => {
    const items = nav.current?.querySelectorAll<HTMLElement>('[data-flip-id]')
    if (!items) return
    if (state.current && !prefersReducedMotion()) {
      Flip.from(state.current, {
        targets: items,
        duration: motion.base + 0.15,
        ease: motion.ease,
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: motion.base, ease: motion.ease },
          ),
        onLeave: (els) => gsap.to(els, { opacity: 0, duration: motion.fast }),
      })
    }
    state.current = Flip.getState(items)
  }, [signature])

  // On a bar too narrow for every stop, the next question still ahead scrolls into view.
  useEffect(() => {
    if (!held) return
    list.current?.querySelector<HTMLElement>('[data-state=ahead]')?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [held])

  return (
    <nav ref={nav} aria-label={m.journey[locale]} className={bar}>
      <div className={slot}>
        <span aria-hidden className={caption}>
          {m.inProgress[locale]}
        </span>
        {held && (
          <span
            data-flip-id={held}
            className={stop}
            data-state="current"
            aria-current={current ? 'step' : 'page'}
          >
            <span aria-hidden className={dot} />
            {current ? current.label : m.results[locale]}
          </span>
        )}
      </div>
      <span aria-hidden className={css({ flexShrink: '0', w: '1px', h: '5', bg: 'line' })} />
      <div data-console-part className={map} style={{ animationDelay: `${enterDelay}s` }}>
        {hint && (
          <div role="status" className={bubble}>
            <span>{m.journeyHint[locale]}</span>
            <button
              type="button"
              aria-label={m.close[locale]}
              onClick={onDismissHint}
              className={css({
                flexShrink: '0',
                display: 'grid',
                placeItems: 'center',
                w: '6',
                h: '6',
                borderRadius: 'full',
                color: 'paper',
                cursor: 'pointer',
                _hover: { bg: 'paper/15' },
              })}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}
        <ol ref={list} className={track}>
          {rest.map((s, i) => (
            <li
              key={s.key}
              data-flip-id={s.key}
              className={css({ display: 'flex', alignItems: 'center', flexShrink: '0' })}
            >
              {i > 0 && (
                <span aria-hidden className={css({ w: '2.5', h: '1px', bg: 'line.strong' })} />
              )}
              <button
                type="button"
                className={stop}
                data-state={s.state}
                title={s.state === 'ahead' ? m.answerNow[locale] : (s.value ?? undefined)}
                onClick={() => onPick(s.key)}
              >
                {s.state === 'done' && <Tick />}
                {s.label}
                {s.state === 'ahead' && (
                  <span aria-hidden data-lift className={lift}>
                    ↑
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}
