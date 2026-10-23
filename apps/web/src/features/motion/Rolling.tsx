import { type AriaAttributes, useLayoutEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from './gsap'
import { motion } from './tokens'

// A number that rolls to each new value rather than changing at once. React renders the first
// value (server HTML included), GSAP writes the text after that. A number that stays on screen
// from one page to the next (the counter, switching categories) leaves what it shows in a slot as
// its page goes, and the next page's number rolls on from there.

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
  /** The slot this number leaves what it shows in as its page goes. */
  slot?: RollSlot
  /** The page replaces another one: roll on from what that one's number left in the slot. */
  carryOver?: boolean
}

export function Rolling({
  value,
  format = whole,
  className,
  slot,
  carryOver = false,
  ...aria
}: Props) {
  const el = useRef<HTMLSpanElement>(null)
  const [initial] = useState(value)
  const shown = useRef(value)
  const paint = () => {
    if (el.current) el.current.textContent = format(shown.current)
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

  return (
    <span ref={el} className={className} {...aria}>
      {format(initial)}
    </span>
  )
}
