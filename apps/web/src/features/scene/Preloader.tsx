import { type Category, categoryFromSlug, type Locale } from '@choose/catalog'
import { useParams } from '@tanstack/react-router'
import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { gsap, prefersReducedMotion } from '../motion/gsap'
import { scene } from './controller'
import { tiltFor } from './geometry'
import { readViewport } from './navigation'
import { type CssInk, preloaderArt } from './preloader-art'
import { mark } from './stats'

// What a visit sees first. On the home page, the panels themselves, tilted and spaced like the
// home's, each with its category's device (a keyboard, a monitor, a mouse) inking in as that
// category's first screen gets ready (its drawings and photos, the fonts); then each device lights
// its accent and the panels lift one after the other onto the real ones. Arriving straight on a
// category's canvas, that category's device alone, then a curtain cut at the panels' angle lifting
// onto the canvas. It is in the server's HTML and moves in CSS until the page wakes up; the page's
// entrances wait under it (CSS ones paused by `html[data-loading]`, GSAP ones held) and play as it
// lifts. It never holds a visit longer than a moment (TIMING); without JavaScript it is never
// shown (see __root.tsx).

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

/**
 * The preloader mounted last: React may run its effect twice in development (StrictMode), and the
 * first run’s cleanup must not end the hold the second one takes over.
 */
let holder = 0

/** In ms from the start of the visit: never shorter than `min`, never longer than `max` (or than
 * `afterWake` once the page wakes up late); photos get `photosGrace` once drawings are in. */
const TIMING = { min: 650, max: 2600, afterWake: 700, photosGrace: 900 }

/** Each drawing inks about half its units in CSS before the page wakes up, as the count runs to 50 %. */
const CSS_START = 200
const CSS_SPAN = 924
const inkOf = (units: number): CssInk => {
  const n = Math.floor(units / 2)
  return { units: n, step: CSS_SPAN / Math.max(n, 1), start: CSS_START }
}

const meta = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  columnGap: '4',
  rowGap: '1',
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.muted',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
})

const count = css({
  fontFamily: 'mono',
  fontSize: 'xs',
  color: 'ink',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0',
})

/** The box a drawing fits in: one cell its own size, so a tall drawing never outgrows it. */
const stage = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gridTemplateRows: 'minmax(0, 1fr)',
  placeItems: 'center',
})

const art = css({ display: 'block', w: '100%', h: '100%', overflow: 'visible' })

/** The value CSS has counted to before the page woke up (0 … 1), where the browser can say. */
function cssCount(el: HTMLElement | null) {
  if (!el) return 0
  const raw = getComputedStyle(el, '::after').getPropertyValue('--pre').trim()
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value / 100 : 0
}

/** One drawing being inked: its units, its accent, its count and how far it has got. */
type Part = {
  category: Category
  units: Element[]
  accent: Element | null
  number: HTMLElement | null
  value: number
  inked: number
}

export function Preloader({
  shown,
  counts,
  locale,
}: {
  /** The categories the site offers, in panel order. */
  shown: readonly Category[]
  counts: Record<Category, number>
  locale: Locale
}) {
  const root = useRef<HTMLDivElement>(null)
  const params = useParams({ strict: false }) as { category?: string; product?: string }
  // Arriving straight on a product's page, none at all: its sheet opens at once (__root.tsx).
  const [gone, setGone] = useState(() => params.product != null)
  // Arriving on a category's canvas, that category alone; anywhere else, every panel.
  const opened = params.category ? categoryFromSlug(params.category, locale) : null
  const single = opened && shown.includes(opened) ? opened : null

  useIsoLayoutEffect(() => {
    const html = document.documentElement
    const el = root.current
    // Only a visit's first page shows it: back on a page of the same visit, it is already gone.
    if (!html.hasAttribute('data-loading') || !el) {
      html.removeAttribute('data-loading')
      setGone(true)
      return
    }
    const mine = ++holder
    // The page's GSAP entrances wait with the CSS ones; the canvas keeps drawing (its ticker runs).
    gsap.globalTimeline.pause()
    el.style.animation = 'none'
    const parts: Part[] = Array.from(el.querySelectorAll<HTMLElement>('[data-part]')).map(
      (part) => {
        const number = part.querySelector<HTMLElement>('[data-count]')
        if (number) number.dataset.live = ''
        return {
          category: part.dataset.part as Category,
          units: Array.from(part.querySelectorAll('[data-unit]')),
          accent: part.querySelector('[data-accent]'),
          number,
          value: cssCount(number),
          inked: 0,
        }
      },
    )
    const woke = performance.now()
    let fonts = false
    void document.fonts?.ready.then(() => {
      fonts = true
    })
    let drawnAt: number | null = null
    let left = false

    const show = (part: Part, v: number) => {
      const on = Math.min(part.units.length, Math.round(v * part.units.length))
      for (let i = part.inked; i < on; i++) part.units[i]?.setAttribute('data-on', '')
      part.inked = Math.max(part.inked, on)
      if (part.number) part.number.textContent = `${String(Math.round(v * 100)).padStart(3, '0')} %`
    }

    const leave = (why: 'ready' | 'timeout') => {
      if (left) return
      left = true
      mark(`preloader-${why}`)
      gsap.ticker.remove(tick)
      window.clearTimeout(cap)
      for (const part of parts) {
        show(part, 1)
        part.accent?.setAttribute('data-lit', '')
      }
      el.style.pointerEvents = 'none'
      // Everything created while loading waits in `held`, which starts as the preloader lifts.
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
      if (!single) {
        // Each device steps back, then its panel lifts off the real one, one after the other.
        gsap
          .timeline({ onComplete: () => setGone(true) })
          .to(
            el.querySelectorAll('[data-device]'),
            { opacity: 0, y: -8, scale: 0.97, duration: 0.3, stagger: 0.06, ease: 'power2.in' },
            0.24,
          )
          .call(start, [], 0.34)
          .to(
            el.querySelectorAll('[data-slat]'),
            {
              clipPath: 'inset(0% 0% 100% 0%)',
              duration: 0.8,
              stagger: 0.09,
              ease: 'expo.inOut',
            },
            0.34,
          )
        return
      }
      const vp = readViewport()
      const slant = Math.tan(tiltFor(vp, shown.length)) * vp.h
      const cut = { p: 0 }
      gsap
        .timeline({ onComplete: () => setGone(true) })
        .to(
          el.querySelector('[data-plate]'),
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
      for (const part of parts) {
        // Each drawing follows its own category's first screen.
        const own = first?.byCategory[part.category] ?? first
        const real =
          0.15 + (fonts ? 0.15 : 0) + 0.4 * (own?.drawings ?? 0) + 0.3 * (own?.photos ?? 0)
        // The count never goes back, and holds just short of the end until everything is in.
        part.value += (Math.max(part.value, Math.min(real, 0.96)) - part.value) * 0.14
        show(part, part.value)
      }
      // The photos of the first screen, and of the first question's tiles if the page has some.
      const ready =
        fonts &&
        !!first &&
        first.drawings >= 1 &&
        ((first.photos >= 1 && (first.tiles ?? 1) >= 1) ||
          now - (drawnAt ?? now) > TIMING.photosGrace)
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
      if (left) return
      // Unmounted for good (not run again at once): the page is no longer held.
      queueMicrotask(() => {
        if (holder !== mine) return
        html.removeAttribute('data-loading')
        gsap.globalTimeline.resume()
      })
    }
  }, [])

  if (gone) return null

  if (single) {
    const { Art, units } = preloaderArt[single]
    return (
      <div
        ref={root}
        data-preloader
        data-nosnippet
        className={cx(overlay, paper)}
        role="status"
        aria-live="polite"
      >
        <div data-plate data-part={single} className={plate}>
          <div className={cx(stage, css({ h: 'min(36vh, 15rem)' }))}>
            <Art ink={inkOf(units)} className={art} />
          </div>
          <div className={meta}>
            <span>
              <span className={css({ color: 'signal' })}>●</span> {m.loadingCatalogue[locale]}
            </span>
            <span data-count className={count} />
          </div>
          <p className={css({ fontFamily: 'mono', fontSize: '2xs', color: 'ink.faint' })}>
            {counts[single]} {m.category[single][locale].toLowerCase()}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={root}
      data-preloader
      data-nosnippet
      className={overlay}
      role="status"
      aria-live="polite"
    >
      <span className={css({ srOnly: true })}>{m.loadingCatalogue[locale]}</span>
      <div data-split style={{ '--n': Math.max(shown.length, 1) } as CSSProperties}>
        {shown.map((category, i) => {
          const { Art, units } = preloaderArt[category]
          return (
            <div
              key={category}
              data-slat
              data-part={category}
              style={{ '--i': i } as CSSProperties}
            >
              <div data-slat-body>
                <div data-device className={device}>
                  <div
                    className={cx(
                      stage,
                      css({ gridArea: 'art', h: { base: '100%', _slats: 'min(30vh, 13rem)' } }),
                    )}
                  >
                    <Art ink={inkOf(units)} className={art} />
                  </div>
                  <div className={cx(meta, css({ gridArea: 'meta' }))}>
                    <span>
                      <span className={css({ color: 'signal' })}>
                        {String(i + 1).padStart(2, '0')}
                      </span>{' '}
                      {m.category[category][locale]} · {counts[category]}
                    </span>
                    <span data-count className={count} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const overlay = css({
  position: 'fixed',
  inset: '0',
  zIndex: '100',
  pointerEvents: 'auto',
})

/** Arriving on a canvas: the canvas's dotted paper, so the curtain lifts onto the same ground. */
const paper = css({
  display: 'grid',
  placeItems: 'center',
  px: '6',
  bg: 'paper',
  backgroundImage: 'radial-gradient(circle, #CFCBC2 1.15px, transparent 1.4px)',
  backgroundSize: '28px 28px',
  backgroundPosition: 'center',
  willChange: 'clip-path',
})

const plate = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyItems: 'stretch',
  gap: '4',
  w: 'min(30rem, 78vw)',
})

/**
 * A device in its panel: as wide as the panel allows, never wider than a drawing needs. In a
 * phone's row, the drawing at the right and its count at the left, where the row's label goes.
 */
const device = css({
  position: 'absolute',
  inset: '0',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 50%)',
  gridTemplateRows: 'minmax(0, 1fr)',
  gridTemplateAreas: '"meta art"',
  alignItems: 'end',
  gap: '3',
  p: '4',
  _slats: {
    position: 'static',
    inset: 'auto',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: 'auto',
    gridTemplateAreas: '"art" "meta"',
    alignItems: 'normal',
    w: 'min(76%, 22rem)',
    p: '0',
  },
})
