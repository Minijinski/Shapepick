import { type Category, categories, type Locale } from '@choose/catalog'
import { keyboardKeys } from '@choose/catalog/media'
import { useLayoutEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { gsap, prefersReducedMotion } from '../motion/gsap'
import { scene } from './controller'
import { tiltFor } from './geometry'
import { readViewport } from './navigation'
import { mark } from './stats'

// What a visit sees first: a keyboard drawn like the canvas's sketches, its keys inking in as the
// scene gets ready (the drawings and photos of its first screen, the fonts), its Enter key turning
// orange, then a curtain cut at the panels' angle lifting onto the page. It is in the server's
// HTML and moves in CSS until the page wakes up; the page's entrances wait under it (CSS ones
// paused by `html[data-loading]`, GSAP ones held) and play as it lifts. It never holds a visit
// longer than a moment (TIMING); without JavaScript it is never shown (see __root.tsx).

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

/** In ms from the start of the visit: never shorter than `min`, never longer than `max` (or than
 * `afterWake` once the page wakes up late); photos get `photosGrace` once drawings are in. */
const TIMING = { min: 650, max: 2600, afterWake: 700, photosGrace: 900 }

const { keys, width, height } = keyboardKeys('f75')
const PAD = 0.45
const VIEW = { w: width + PAD * 2, h: height + PAD * 2 }
/** Keys inked in CSS before the page wakes up: about half of them, one every `CSS_STEP` ms. */
const CSS_KEYS = Math.floor(keys.length / 2)
const CSS_STEP = 22
const CSS_START = 200
/** The key that turns signal orange once everything is in. */
const ENTER = keys.findIndex((k) => k.accent && k.w >= 2)

const overlay = css({
  position: 'fixed',
  inset: '0',
  zIndex: '100',
  display: 'grid',
  placeItems: 'center',
  px: '6',
  bg: 'paper',
  // The canvas's dotted paper, so the curtain lifts onto the same ground.
  backgroundImage: 'radial-gradient(circle, #CFCBC2 1.15px, transparent 1.4px)',
  backgroundSize: '28px 28px',
  backgroundPosition: 'center',
  pointerEvents: 'auto',
  willChange: 'clip-path',
})

const plate = css({
  display: 'grid',
  justifyItems: 'stretch',
  gap: '4',
  w: 'min(30rem, 78vw)',
})

const meta = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '4',
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.muted',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
})

const count = css({
  fontFamily: 'mono',
  fontSize: 'xs',
  color: 'ink',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0',
})

/** The value CSS has counted to before the page woke up (0 … 1), where the browser can say. */
function cssCount(el: HTMLElement | null) {
  if (!el) return 0
  const raw = getComputedStyle(el, '::after').getPropertyValue('--pre').trim()
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value / 100 : 0
}

export function Preloader({
  counts,
  locale,
}: {
  counts: Record<Category, number>
  locale: Locale
}) {
  const root = useRef<HTMLDivElement>(null)
  const board = useRef<SVGGElement>(null)
  const number = useRef<HTMLSpanElement>(null)
  const [gone, setGone] = useState(false)

  useIsoLayoutEffect(() => {
    const html = document.documentElement
    const el = root.current
    const keysEl = board.current
    const numberEl = number.current
    // Only a visit's first page shows it: back on a page of the same visit, it is already gone.
    if (!html.hasAttribute('data-loading') || !el || !keysEl || !numberEl) {
      html.removeAttribute('data-loading')
      setGone(true)
      return
    }
    // The page's GSAP entrances wait with the CSS ones; the canvas keeps drawing (its ticker runs).
    gsap.globalTimeline.pause()
    el.style.animation = 'none'
    const rects = Array.from(keysEl.querySelectorAll<SVGRectElement>('[data-key]'))
    const woke = performance.now()
    let value = cssCount(numberEl)
    numberEl.dataset.live = ''
    let fonts = false
    void document.fonts?.ready.then(() => {
      fonts = true
    })
    let drawnAt: number | null = null
    let inked = 0
    let left = false

    const show = (v: number) => {
      const on = Math.min(rects.length, Math.round(v * rects.length))
      for (let i = inked; i < on; i++) rects[i]?.setAttribute('data-on', '')
      inked = Math.max(inked, on)
      numberEl.textContent = `${String(Math.round(v * 100)).padStart(3, '0')} %`
    }

    const leave = (why: 'ready' | 'timeout') => {
      if (left) return
      left = true
      mark(`preloader-${why}`)
      gsap.ticker.remove(tick)
      window.clearTimeout(cap)
      show(1)
      rects[ENTER]?.setAttribute('data-enter', '')
      el.style.pointerEvents = 'none'
      // Everything created while loading waits in `held`, which starts as the curtain lifts.
      const held = gsap.exportRoot()
      held.pause()
      gsap.globalTimeline.resume()
      const start = () => {
        html.removeAttribute('data-loading')
        held.resume()
      }
      if (prefersReducedMotion()) {
        start()
        gsap.to(el, { opacity: 0, duration: 0.25, onComplete: () => setGone(true) })
        return
      }
      const vp = readViewport()
      const slant = Math.tan(tiltFor(vp, categories.length)) * vp.h
      const cut = { p: 0 }
      gsap
        .timeline({ onComplete: () => setGone(true) })
        .to(
          keysEl.closest('[data-plate]'),
          { opacity: 0, scale: 0.97, duration: 0.35, ease: 'power2.in' },
          0.22,
        )
        .call(start, [], 0.32)
        .to(
          cut,
          {
            p: 1,
            duration: 0.95,
            ease: 'expo.inOut',
            onUpdate: () => {
              // The edge leans like the panels' dividers, sweeping from the left edge out.
              const x = cut.p * (vp.w + slant)
              el.style.clipPath = `polygon(${x}px 0, 100% 0, 100% 100%, ${x - slant}px 100%)`
            },
          },
          0.3,
        )
    }

    const tick = () => {
      const now = performance.now()
      const first = scene.firstScreenProgress()
      if (first && first.drawings >= 1 && drawnAt == null) drawnAt = now
      const real =
        0.15 + (fonts ? 0.15 : 0) + 0.4 * (first?.drawings ?? 0) + 0.3 * (first?.photos ?? 0)
      // The count never goes back, and holds just short of the end until everything is in.
      value += (Math.max(value, Math.min(real, 0.96)) - value) * 0.14
      show(value)
      const ready =
        fonts &&
        !!first &&
        first.drawings >= 1 &&
        (first.photos >= 1 || now - (drawnAt ?? now) > TIMING.photosGrace)
      if (ready && now >= TIMING.min) leave('ready')
      else if (now >= Math.max(TIMING.max, woke + TIMING.afterWake)) leave('timeout')
    }
    gsap.ticker.add(tick)
    // The ticker stops with the tab: a timer makes sure the page is never held.
    const cap = window.setTimeout(
      () => leave('timeout'),
      Math.max(TIMING.max, woke + TIMING.afterWake) - woke + 400,
    )
    return () => {
      gsap.ticker.remove(tick)
      window.clearTimeout(cap)
      if (!left) {
        html.removeAttribute('data-loading')
        gsap.globalTimeline.resume()
      }
    }
  }, [])

  if (gone) return null
  const total = categories.map((c) => `${counts[c]} ${m.category[c][locale].toLowerCase()}`)
  return (
    <div ref={root} data-preloader className={overlay} role="status" aria-live="polite">
      <div data-plate className={plate}>
        <svg
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          aria-hidden
          className={css({ w: '100%', h: 'auto' })}
        >
          <rect
            x={0.03}
            y={0.03}
            width={VIEW.w - 0.06}
            height={VIEW.h - 0.06}
            rx={0.6}
            fill="none"
            stroke="#A8A399"
            strokeWidth={0.06}
            strokeDasharray="0.3 0.2"
          />
          <g ref={board}>
            {keys.map((k, i) => (
              <rect
                key={`${k.x}-${k.y}`}
                data-key={i}
                data-css={i < CSS_KEYS ? '' : undefined}
                x={PAD + k.x + 0.06}
                y={PAD + k.y + 0.06}
                width={k.w - 0.12}
                height={0.88}
                rx={0.14}
                style={
                  i < CSS_KEYS ? { animationDelay: `${CSS_START + i * CSS_STEP}ms` } : undefined
                }
              />
            ))}
          </g>
        </svg>
        <div className={meta}>
          <span>
            <span className={css({ color: 'signal' })}>●</span> {m.loadingCatalogue[locale]}
          </span>
          <span ref={number} data-count className={count} />
        </div>
        <p className={css({ fontFamily: 'mono', fontSize: '2xs', color: 'ink.faint' })}>
          {total.join(' · ')}
        </p>
      </div>
    </div>
  )
}
