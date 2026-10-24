import { type AriaAttributes, useLayoutEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from './gsap'
import { motion } from './tokens'

// A number that rolls to each new value rather than changing at once. React renders the first
// value (server HTML included), GSAP writes the text after that. A number that stays on screen
// from one page to the next (the counter, switching categories) leaves what it shows in a slot as
// its page goes, and the next page's number rolls on from there. A number given a width (`pad`)
// keeps it: the zeros in front only hold the place, so they get a style of their own and are not
// read out.

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

/** Where a number leaves what it showed as its page went, and when (ms). */
export type RollSlot = { last: { value: number; at: number } | null }
export const rollSlot = (): RollSlot => ({ last: null })

/** Past this (ms), the next page's number is a new one rather than the last one carried over. */
const HANDOFF_MS = 1000

const whole = (n: number) => String(Math.round(n))

type Props = AriaAttributes & {
  value: number
  format?: (n: number) => string
  className?: string
  /** At least this many digits: zeros fill the front. */
  pad?: number
  /** The style of those zeros. */
  padClassName?: string
  /** The slot this number leaves what it shows in as its page goes. */
  slot?: RollSlot
  /** The page replaces another one: roll on from what that one's number left in the slot. */
  carryOver?: boolean
}

export function Rolling({
  value,
  format = whole,
  className,
  pad,
  padClassName,
  slot,
  carryOver = false,
  ...aria
}: Props) {
  const el = useRef<HTMLSpanElement>(null)
  const zerosEl = useRef<HTMLSpanElement>(null)
  const digitsEl = useRef<HTMLSpanElement>(null)
  const [initial] = useState(value)
  const shown = useRef(value)
  /** The zeros that fill the front, and the number itself. */
  const split = (n: number) => {
    const digits = format(n)
    return { zeros: pad ? '0'.repeat(Math.max(0, pad - digits.length)) : '', digits }
  }
  const paint = () => {
    const { zeros, digits } = split(shown.current)
    if (pad == null) {
      if (el.current) el.current.textContent = digits
      return
    }
    if (zerosEl.current) zerosEl.current.textContent = zeros
    if (digitsEl.current) digitsEl.current.textContent = digits
  }

  // Before the roll below starts: taking over from the last page's number, start where it was.
  useIsoLayoutEffect(() => {
    if (!slot) return
    const last =
      carryOver && slot.last && performance.now() - slot.last.at < HANDOFF_MS ? slot.last : null
    slot.last = null
    if (last) {
      shown.current = last.value
      paint()
    }
    return () => {
      slot.last = { value: shown.current, at: performance.now() }
    }
  }, [])

  useIsoLayoutEffect(() => {
    if (prefersReducedMotion()) {
      shown.current = value
      return paint()
    }
    const roll = { n: shown.current }
    const tween = gsap.to(roll, {
      n: value,
      duration: motion.slow,
      ease: motion.ease,
      onUpdate: () => {
        shown.current = roll.n
        paint()
      },
    })
    return () => {
      tween.kill()
    }
  }, [value])

  const first = split(initial)
  return (
    <span ref={el} className={className} {...aria}>
      {pad == null ? (
        first.digits
      ) : (
        <>
          <span ref={zerosEl} aria-hidden className={padClassName}>
            {first.zeros}
          </span>
          <span ref={digitsEl}>{first.digits}</span>
        </>
      )}
    </span>
  )
}
