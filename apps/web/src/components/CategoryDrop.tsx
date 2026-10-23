import { useLayoutEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { gsap, prefersReducedMotion } from '~/features/motion/gsap'

// The disc behind the header's category on screen. Another category picked, it runs there like a
// drop pulled along: its front leaves first and draws it out, round ahead with a tail tapering
// behind and a little thinner for it, then its back catches up, lands a touch past and the drop
// gathers round on the new icon. From the home page it swells in behind its icon; going home it
// shrinks away. It moves as soon as the category is picked, ahead of the page that follows.

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

/** From one icon to the next (rem): an icon (2.25rem) and the gap after it (0.375rem), as SiteHeader lays them out. */
const PITCH = 2.625
/** How much thinner the drop gets, drawn out by an icon's width. */
const THIN = 0.14
/** How much of its stretch goes into its tail. */
const TAIL = 0.6

const inOut = gsap.parseEase('power3.inOut')
const clamp = (t: number) => Math.min(1, Math.max(0, t))
/** Where the front is along the move: on the icon at 78% of it. */
const front = (p: number) => inOut(clamp(p / 0.78))
/** Where the back is: it leaves a little after the front and lands last, a touch past it. */
const back = (p: number) => {
  const t = clamp((p - 0.06) / 0.94)
  return inOut(t) + (t > 0.7 ? 0.05 * Math.sin((Math.PI * (t - 0.7)) / 0.3) : 0)
}

/** The drop while it moves: its edges (px, from the first icon's left), its scale and opacity. */
type Shape = { a: number; b: number; scale: number; opacity: number }

const disc = css({
  position: 'absolute',
  top: '0',
  left: '0',
  w: '9',
  h: '9',
  borderRadius: 'full',
  bg: 'surface.raised',
  boxShadow: '0 0 0 1px token(colors.line)',
  pointerEvents: 'none',
})

/** At rest: behind the `at`th icon, out of sight for none. */
const rest = (at: number) => ({
  transform: `translateX(calc(${Math.max(0, at)} * ${PITCH}rem))`,
  opacity: at < 0 ? 0 : 1,
})

/** Draws the drop moving towards `dir` (0: in place, a disc). */
function draw(el: HTMLElement, s: Shape, size: number, dir: number) {
  const w = Math.max(size * 0.6, s.b - s.a)
  // Drawn out it thins; pressed together as it lands it bulges.
  const h = w >= size ? size * (1 - THIN * Math.min(1, (w - size) / size)) : size + (size - w) * 0.8
  const r = h / 2
  const tail = Math.min(w - r, r + TAIL * (w - h))
  el.style.width = `${w}px`
  el.style.height = `${h}px`
  el.style.transform = `translate(${s.a + (s.b - s.a - w) / 2}px, ${(size - h) / 2}px) scale(${s.scale})`
  el.style.opacity = String(s.opacity)
  el.style.borderRadius =
    dir === 0 || w <= h
      ? '50%'
      : dir > 0
        ? `${tail}px ${r}px ${r}px ${tail}px / ${r}px`
        : `${r}px ${tail}px ${tail}px ${r}px / ${r}px`
}

/** `at`: the index of the icon it sits behind among its siblings marked `data-slot`, -1 for none. */
export function CategoryDrop({ at }: { at: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [initial] = useState(at)
  /** The icon it sits behind, or heads to. */
  const goal = useRef(at)
  /** Its shape while it moves; null at rest. */
  const shape = useRef<Shape | null>(null)
  const tween = useRef<gsap.core.Tween | null>(null)

  useIsoLayoutEffect(() => {
    const el = ref.current
    const from = goal.current
    goal.current = at
    if (!el || from === at) return
    tween.current?.kill()
    const slots = [...(el.parentElement?.querySelectorAll<HTMLElement>('[data-slot]') ?? [])]
    const settle = () => {
      shape.current = null
      el.removeAttribute('style')
      Object.assign(el.style, rest(at))
    }
    // A hidden header (a phone) has nothing to show the move on.
    const first = slots[0]
    if (prefersReducedMotion() || !el.offsetParent || !first) return settle()
    const size = first.offsetWidth
    const box = (i: number) => {
      const left = slots[i]?.offsetLeft ?? 0
      return { a: left, b: left + size }
    }
    // Mid-move it carries on from where it is; at rest, from its icon.
    const s: Shape =
      shape.current ??
      (from >= 0 ? { ...box(from), scale: 1, opacity: 1 } : { ...box(at), scale: 0.3, opacity: 0 })
    shape.current = s

    if (at < 0) {
      tween.current = gsap.to(s, {
        scale: 0.3,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onUpdate: () => draw(el, s, size, 0),
        onComplete: settle,
      })
      return
    }
    const start = { ...s }
    const end = box(at)
    const dir = Math.sign(end.a - start.a)
    if (dir === 0) {
      tween.current = gsap.to(s, {
        ...end,
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: 'back.out(2)',
        onUpdate: () => draw(el, s, size, 0),
        onComplete: settle,
      })
      return
    }
    const progress = { p: 0 }
    const lead = dir > 0 ? 'b' : 'a'
    const trail = dir > 0 ? 'a' : 'b'
    tween.current = gsap.to(progress, {
      p: 1,
      duration: 0.45 + 0.1 * Math.min(3, Math.abs(end.a - start.a) / size),
      ease: 'none',
      onUpdate: () => {
        const { p } = progress
        s[lead] = start[lead] + (end[lead] - start[lead]) * front(p)
        s[trail] = start[trail] + (end[trail] - start[trail]) * back(p)
        const shown = clamp(p / 0.4)
        s.scale = start.scale + (1 - start.scale) * shown
        s.opacity = start.opacity + (1 - start.opacity) * shown
        draw(el, s, size, dir)
      },
      onComplete: settle,
    })
  }, [at])

  return <span ref={ref} aria-hidden className={disc} style={rest(initial)} />
}
