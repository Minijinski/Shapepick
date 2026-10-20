import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import { css } from 'styled-system/css'
import { gsap, prefersReducedMotion } from '../motion/gsap'
import { motion } from '../motion/tokens'

// The white panel docked at the bottom of the finder: the question console, then the results, in
// one frame. Its content sets its height and the frame eases from one height to the next, growing
// or shrinking upwards, so its bottom edge never moves: one question follows another without a
// jolt, and the console morphs into the results and back.

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

const frame = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  // The content hangs from the bottom edge: while the frame grows it uncovers the top.
  justifyContent: 'flex-end',
  bg: 'surface.raised',
  borderRadius: 'panel',
  borderWidth: '1px',
  borderColor: 'line',
  boxShadow: 'panel',
  overflow: 'hidden',
})

const Follow = createContext<() => void>(() => {})

/** For the panel's content: after each of its renders, the panel eases to its new height. */
export function useDockHeight() {
  const follow = useContext(Follow)
  useIsoLayoutEffect(() => follow())
}

export function DockPanel({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  /** The height on screen (kept by a ResizeObserver) and the one the frame is easing to. */
  const shown = useRef<number | null>(null)
  const target = useRef<number | null>(null)

  const follow = useCallback(function follow() {
    const el = box.current
    const content = el?.firstElementChild
    if (!el || !(content instanceof HTMLElement)) return
    const to = content.offsetHeight + el.offsetHeight - el.clientHeight
    if (to === target.current) return
    target.current = to
    const from = shown.current
    if (from == null || Math.abs(from - to) < 1 || prefersReducedMotion()) {
      gsap.killTweensOf(el)
      gsap.set(el, { clearProps: 'height' })
      return
    }
    gsap.fromTo(
      el,
      { height: from },
      {
        height: to,
        duration: motion.base + 0.1,
        ease: motion.ease,
        overwrite: true,
        // Whatever moved meanwhile (a title split into words, a webfont landing) is eased to as
        // well, rather than snapped to when the frame lets go of its height.
        onComplete: () => {
          shown.current = el.offsetHeight
          target.current = null
          follow()
        },
      },
    )
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      shown.current = el.offsetHeight
    })
    observer.observe(el)
    shown.current = el.offsetHeight
    return () => observer.disconnect()
  }, [])

  // A new content (the results in place of the console) is followed from the first paint.
  useIsoLayoutEffect(() => follow())

  return (
    <Follow.Provider value={follow}>
      <div ref={box} data-dock-panel className={frame}>
        {children}
      </div>
    </Follow.Provider>
  )
}
