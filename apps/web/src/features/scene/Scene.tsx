import type { CatalogItem, Category, Locale } from '@choose/catalog'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { css } from 'styled-system/css'
import { gsap } from '../motion/gsap'
import { type FirstScreen, scene } from './controller'
import { isCompact } from './geometry'
import { markHydrated, readViewport } from './navigation'
import { PopupCard } from './PopupCard'
import {
  type Hit,
  type Rect,
  SceneRenderer,
  type SceneTarget,
  sameHit,
  spriteResolution,
} from './renderer'
import { Drawings, Photos, photoBudget, type Shape } from './sprites'
import { exposeStats, mark } from './stats'

// The canvas behind the pages of a locale, mounted once by the layout so it survives every
// navigation between the home page and the categories. It owns the pointer on the open canvas
// (hover, drag, fling, wheel) and the popup that follows the product under the pointer; a click
// (or a tap) on a product asks the page to open that product's sheet.

/** `shown`: the categories the site offers (with products), one band each, in this order. */
type Props = {
  catalogs: Record<Category, CatalogItem[]>
  shown: readonly Category[]
  locale: Locale
}

type Drag = { id: number; x: number; y: number; t: number; vx: number; vy: number; moved: number }

const TAP = 6
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * The card waits this long once the pointer leaves its product (crossing the paper between two
 * products, it glides to the next one instead of folding), then folds away in this long (ms).
 */
const POPUP_GRACE_MS = 120
const POPUP_OUT_MS = 190
/** How quickly the card catches up with its place (ms): it glides from one product to the next. */
const POPUP_EASE_MS = 70
/**
 * A card opens once the pointer has rested this long on a product (ms): a pointer crossing the
 * canvas on its way somewhere else opens nothing.
 */
const POPUP_INTENT_MS = 160
/** Slower than this (px/ms) the pointer is resting on its product: the card may open. */
const REST_SPEED = 0.3
/** Faster than this (px/ms) the pointer is passing through: an open card folds, it does not follow. */
const PASS_SPEED = 0.7

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Which side of its product the card opens on. */
type Side = 'right' | 'left' | 'below' | 'above'

/** Where the card goes beside a product’s screen box, and where its leader line starts. */
function placePopup(r: Rect, vw: number, vh: number, cw: number, ch: number) {
  const gap = 36
  const cy = r.y + r.h / 2
  if (r.x + r.w + gap + cw <= vw - 12 || r.x - gap - cw >= 12) {
    const right = r.x + r.w + gap + cw <= vw - 12
    return {
      side: (right ? 'right' : 'left') as Side,
      x: right ? r.x + r.w + gap : r.x - gap - cw,
      y: clamp(cy - 34, 76, vh - ch - 12),
      ax: right ? r.x + r.w + 12 : r.x - 12,
      ay: cy,
    }
  }
  // No room beside it (a phone): above or below the product instead.
  const below = r.y + r.h + gap + ch <= vh - 12
  return {
    side: (below ? 'below' : 'above') as Side,
    x: clamp(r.x + r.w / 2 - cw / 2, 12, vw - cw - 12),
    y: below ? r.y + r.h + gap : Math.max(76, r.y - gap - ch),
    ax: r.x + r.w / 2,
    ay: below ? r.y + r.h + 12 : r.y - 12,
  }
}

/** Where the leader line meets the card, wherever the card is on its way. */
function lineEnd(side: Side, x: number, y: number, cw: number, ch: number, ax: number, ay: number) {
  if (side === 'right') return { x: x, y: clamp(ay, y + 18, y + ch - 18) }
  if (side === 'left') return { x: x + cw, y: clamp(ay, y + 18, y + ch - 18) }
  return { x: clamp(ax, x + 18, x + cw - 18), y: side === 'below' ? y : y + ch }
}

/** Which screen the scene shows: the home panels, or a category’s canvas. */
const targetKey = (target: SceneTarget | null) =>
  !target ? '' : target.mode === 'bands' ? 'bands' : target.category

const hitKey = (hit: Hit) =>
  `${hit.category}:${hit.slug}:${hit.spot}:${hit.slot}:${hit.kx}:${hit.ky}`

export function Scene({ catalogs, shown, locale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLSpanElement>(null)
  const lineRef = useRef<SVGLineElement>(null)
  const rendererRef = useRef<SceneRenderer | null>(null)
  const [hit, setHit] = useState<Hit | null>(null)
  /**
   * The card on screen: the product it shows, the opening it belongs to (a new opening plays the
   * entrance; moving on to a neighbour glides instead), and whether it is folding away.
   */
  const [card, setCard] = useState<{
    hit: Hit
    opening: number
    leaving: boolean
    /** Moved on from another product of the same opening: its lines come in at once. */
    swap: boolean
  } | null>(null)
  const cardState = useRef(card)
  cardState.current = card
  /** Where the card is drawn, eased towards its place, and on which side of its product. */
  const placed = useRef({ x: 0, y: 0, side: 'right' as Side, at: 0 })
  // Re-render when the finder publishes new ranks, so an open popup stays current.
  useSyncExternalStore(scene.subscribe, scene.snapshot, () => 0)

  useEffect(() => {
    if (hit) {
      setCard((prev) => {
        const same = !!prev && !prev.leaving
        return {
          hit,
          opening: same && prev ? prev.opening : (prev?.opening ?? 0) + 1,
          leaving: false,
          swap: same && !!prev && !sameHit(prev.hit, hit),
        }
      })
      return
    }
    let gone: ReturnType<typeof setTimeout> | undefined
    const fold = setTimeout(() => {
      setCard((prev) => (prev ? { ...prev, leaving: true } : prev))
      gone = setTimeout(() => setCard((prev) => (prev?.leaving ? null : prev)), POPUP_OUT_MS)
    }, POPUP_GRACE_MS)
    return () => {
      clearTimeout(fold)
      clearTimeout(gone)
    }
  }, [hit])

  // A new opening is placed before it paints, so its entrance unfolds from the right side.
  const opening = card && !card.leaving ? card.opening : null
  useIsoLayoutEffect(() => {
    if (opening == null) return
    const renderer = rendererRef.current
    const box = cardRef.current
    const r = renderer?.focusRect()
    if (!renderer || !box || !r) return
    const { w: vw, h: vh } = renderer.viewport
    const to = placePopup(r, vw, vh, box.offsetWidth, box.offsetHeight)
    Object.assign(placed.current, { x: to.x, y: to.y, side: to.side, at: performance.now() })
    box.style.transform = `translate3d(${to.x}px, ${to.y}px, 0)`
    const frame = box.firstElementChild as HTMLElement | null
    if (frame) frame.dataset.side = to.side
    renderer.onFrame?.()
  }, [opening])

  useEffect(() => markHydrated(), [])

  // No native drag anywhere (links, drawings): CSS covers WebKit, this covers every browser.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault()
    document.addEventListener('dragstart', prevent)
    return () => document.removeEventListener('dragstart', prevent)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = () => Math.min(2, window.devicePixelRatio || 1)
    const resolution = spriteResolution(readViewport(), dpr())
    const drawings = new Drawings(resolution)
    const renderer = new SceneRenderer(canvas, shown, drawings)
    rendererRef.current = renderer
    mark('scene')
    const fit = () => {
      const vp = readViewport()
      renderer.resize(vp.w, vp.h, dpr())
    }
    fit()
    window.addEventListener('resize', fit)
    const detach = scene.attach(renderer)

    // ---- Popup placement, every frame: the product keeps drifting under it ------------------
    renderer.onFrame = () => {
      const root = overlayRef.current
      if (!root) return
      if (!cardState.current) {
        if (root.style.visibility !== 'hidden') root.style.visibility = 'hidden'
        return
      }
      const box = cardRef.current
      const dot = dotRef.current
      const line = lineRef.current
      const frame = box?.firstElementChild as HTMLElement | null | undefined
      const r = renderer.focusRect()
      // Between two products, or folding away: everything stays where it was.
      if (!box || !dot || !line || !frame || !r) return
      root.style.visibility = 'visible'
      const { w: vw, h: vh } = renderer.viewport
      const cw = box.offsetWidth
      const ch = box.offsetHeight
      const to = placePopup(r, vw, vh, cw, ch)
      const p = placed.current
      const now = performance.now()
      const k = 1 - Math.exp(-Math.min(64, now - p.at) / POPUP_EASE_MS)
      p.x += (to.x - p.x) * k
      p.y += (to.y - p.y) * k
      p.at = now
      if (p.side !== to.side) {
        p.side = to.side
        frame.dataset.side = to.side
      }
      const end = lineEnd(p.side, p.x, p.y, cw, ch, to.ax, to.ay)
      box.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
      // `translate`, not `transform`: the dot's entrance animates `scale`, which applies after
      // `translate` (it grows in place) but before `transform` (it would grow out of the corner).
      dot.style.translate = `${to.ax - 4}px ${to.ay - 4}px`
      line.setAttribute('x1', String(to.ax))
      line.setAttribute('y1', String(to.ay))
      line.setAttribute('x2', String(end.x))
      line.setAttribute('y2', String(end.y))
    }
    gsap.ticker.add(renderer.tick)

    // ---- Products: laid out at once from their shapes; drawings come as the canvas needs them --
    const shapes = new Map<Category, Map<string, Shape>>()
    for (const category of shown) {
      const list = drawings.register(catalogs[category])
      renderer.setItems(category, list)
      shapes.set(category, new Map(list.map((shape) => [shape.slug, shape])))
    }

    // ---- Photos: fetched for the products the canvas draws, as sharp as it draws them --------
    const photos = new Photos(
      resolution,
      dpr(),
      photoBudget(isCompact(readViewport()), dpr()),
      (category, slug, sprite) => renderer.setPhoto(category, slug, sprite, sprite != null),
    )
    const items = new Map(shown.map((c) => [c, new Map(catalogs[c].map((i) => [i.slug, i]))]))
    const askForPhotos = window.setInterval(() => {
      for (const [category, drawn] of renderer.takeDrawn()) {
        for (const [slug, { scale, distance }] of drawn) {
          const item = items.get(category)?.get(slug)
          const shape = shapes.get(category)?.get(slug)
          if (item && shape) photos.see(category, item, shape, scale, distance)
        }
      }
      // Then the products about to come into view: their photos' bytes, fetched before they show.
      for (const near of renderer.around()) {
        const item = items.get(near.category)?.get(near.slug)
        const shape = shapes.get(near.category)?.get(near.slug)
        if (item && shape) photos.ahead(near.category, item, shape, near.scale, near.distance)
      }
      photos.pump()
    }, 150)
    const unexpose = exposeStats(() => ({ ...renderer.stats(), photoStore: photos.stats }))

    // ---- The first screen: asked for at once, and what the preloader waits for ---------------
    // Read again if the scene moves before the preloader lifts (the page may say where it is
    // after the canvas exists): it waits for what will actually show.
    let first = renderer.firstScreen()
    let firstFor = targetKey(scene.current)
    const askFirst = () => {
      for (const f of first) {
        drawings.want(f.key)
        const item = items.get(f.category)?.get(f.slug)
        const shape = shapes.get(f.category)?.get(f.slug)
        if (item && shape) photos.see(f.category, item, shape, f.scale)
      }
      drawings.pump()
      photos.pump()
    }
    askFirst()
    scene.provideFirstScreen(() => {
      const key = targetKey(scene.current)
      if (key !== firstFor) {
        firstFor = key
        first = renderer.firstScreen()
        askFirst()
      }
      const tally = new Map<
        Category,
        { drawn: number; all: number; photographed: number; withPhoto: number }
      >()
      for (const f of first) {
        let t = tally.get(f.category)
        if (!t) {
          t = { drawn: 0, all: 0, photographed: 0, withPhoto: 0 }
          tally.set(f.category, t)
        }
        t.all++
        if (drawings.get(f.key)) t.drawn++
        if (!items.get(f.category)?.get(f.slug)?.photo) continue
        t.withPhoto++
        if (photos.settled(f.category, f.slug)) t.photographed++
      }
      const sum = { drawn: 0, all: 0, photographed: 0, withPhoto: 0 }
      const byCategory: FirstScreen['byCategory'] = {}
      for (const [category, t] of tally) {
        byCategory[category] = {
          drawings: t.all ? t.drawn / t.all : 1,
          photos: t.withPhoto ? t.photographed / t.withPhoto : 1,
        }
        sum.drawn += t.drawn
        sum.all += t.all
        sum.photographed += t.photographed
        sum.withPhoto += t.withPhoto
      }
      return {
        drawings: sum.all ? sum.drawn / sum.all : 1,
        photos: sum.withPhoto ? sum.photographed / sum.withPhoto : 1,
        byCategory,
      }
    })

    // ---- Pointer on the open canvas ----------------------------------------------------------
    // The cursor says at once that a product is clickable; its card waits until the pointer rests
    // on it, and until the last card has finished folding away. An open card glides to the
    // neighbour the pointer moves on to slowly, and folds when the pointer rushes past.
    let drag: Drag | null = null
    /** Where the mouse last was, and how fast it was going (px/ms, eased). */
    const pointer = { x: 0, y: 0, t: 0, speed: 0 }
    /** The product a card waits to open on, and the wait. */
    let pending: Hit | null = null
    let intent: ReturnType<typeof setTimeout> | undefined
    // A product under the pointer is clickable: it opens the product's sheet.
    const hover = (next: Hit | null) => {
      if (next) canvas.dataset.hover = 'true'
      else delete canvas.dataset.hover
    }
    const focus = (next: Hit | null) => {
      renderer.setFocus(next)
      setHit((prev) => (sameHit(prev, next) ? prev : next))
    }
    const forget = () => {
      clearTimeout(intent)
      intent = undefined
      pending = null
    }
    /** Shows a product's card at once (a tap), or none. */
    const show = (next: Hit | null) => {
      forget()
      hover(next)
      focus(next)
    }
    /** The pointer's speed: one that has stopped moving is at rest. */
    const speed = () => (performance.now() - pointer.t > 80 ? 0 : pointer.speed)
    const arm = (ms = POPUP_INTENT_MS) => {
      clearTimeout(intent)
      // A still pointer sends no more events: where it rests is read again when the wait ends.
      intent = setTimeout(() => {
        intent = undefined
        if (cardState.current?.leaving) return arm(POPUP_OUT_MS)
        const next = renderer.pick(pointer)
        if (!next) {
          pending = null
          return
        }
        // Still on its way: looked at again shortly.
        if (speed() > REST_SPEED) return arm(60)
        pending = null
        focus(next)
      }, ms)
    }
    /** Waits for the pointer to rest on this product before its card opens. */
    const waitFor = (next: Hit) => {
      if (sameHit(pending, next)) return
      pending = next
      arm()
    }
    renderer.onFocusLost = () => {
      forget()
      setHit(null)
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      forget()
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        vx: 0,
        vy: 0,
        moved: 0,
      }
      canvas.setPointerCapture(e.pointerId)
      renderer.beginDrag()
    }
    const move = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) {
        const now = performance.now()
        const dx = e.clientX - drag.x
        const dy = e.clientY - drag.y
        const dt = Math.max(8, now - drag.t) / 1000
        drag.vx = drag.vx * 0.3 + (dx / dt) * 0.7
        drag.vy = drag.vy * 0.3 + (dy / dt) * 0.7
        drag.x = e.clientX
        drag.y = e.clientY
        drag.t = now
        drag.moved += Math.hypot(dx, dy)
        renderer.dragBy(dx, dy)
        if (drag.moved > TAP) {
          show(null)
          canvas.dataset.dragging = 'true'
        }
        return
      }
      if (e.pointerType !== 'mouse') return
      const now = performance.now()
      const step =
        Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) / Math.max(8, now - pointer.t)
      // After a pause the pointer starts afresh rather than from the speed it had before.
      pointer.speed = now - pointer.t > 120 ? step : pointer.speed * 0.6 + step * 0.4
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.t = now
      const next = renderer.pick(pointer)
      hover(next)
      if (!next) {
        forget()
        focus(null)
        return
      }
      const card = cardState.current
      if (!card || card.leaving) return waitFor(next)
      // A card is open: a slow pointer takes it along to the next product, a quick one lets it go.
      if (pointer.speed <= PASS_SPEED || sameHit(card.hit, next)) {
        forget()
        focus(next)
        return
      }
      focus(null)
      waitFor(next)
    }
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const tap = drag.moved <= TAP
      // A pointer held still before release flings nothing.
      const still = performance.now() - drag.t > 90
      renderer.endDrag(tap || still ? 0 : drag.vx, tap || still ? 0 : drag.vy)
      delete canvas.dataset.dragging
      drag = null
      if (!tap) return
      const picked = renderer.pick({ x: e.clientX, y: e.clientY })
      // The sheet replaces the popup; without a page to open it, a tap still shows the popup.
      if (picked && scene.openProduct(picked.category, picked.slug)) show(null)
      else show(picked)
    }
    const leave = () => {
      if (!drag) show(null)
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? renderer.viewport.h : 1
      renderer.dragBy(-e.deltaX * unit, -e.deltaY * unit)
      show(null)
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('wheel', wheel, { passive: false })

    return () => {
      forget()
      window.clearInterval(askForPhotos)
      scene.provideFirstScreen(null)
      photos.dispose()
      drawings.dispose()
      unexpose()
      window.removeEventListener('resize', fit)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('wheel', wheel)
      gsap.ticker.remove(renderer.tick)
      detach()
      renderer.dispose()
      rendererRef.current = null
    }
  }, [catalogs, shown])

  const shownHit = card?.hit
  const item = shownHit
    ? catalogs[shownHit.category].find((i) => i.slug === shownHit.slug)
    : undefined
  const state = card?.leaving ? 'out' : 'in'

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className={css({
          position: 'fixed',
          inset: '0',
          w: '100%',
          h: '100%',
          zIndex: '0',
          touchAction: 'none',
          userSelect: 'none',
          '&[data-mode=canvas]': { cursor: 'grab' },
          '&[data-mode=canvas][data-hover]': { cursor: 'pointer' },
          '&[data-dragging]': { cursor: 'grabbing' },
        })}
      />
      {/* The popup: a leader line from the product to a card beside it. Its parts unfold in CSS
          (styles.css, data-popup-*), placed here every frame. */}
      <div
        ref={overlayRef}
        aria-hidden
        className={css({ position: 'fixed', inset: '0', zIndex: '15', pointerEvents: 'none' })}
        style={{ visibility: 'hidden' }}
      >
        <svg
          aria-hidden
          className={css({ position: 'absolute', inset: '0', w: '100%', h: '100%' })}
        >
          {card && (
            <line
              key={card.opening}
              ref={lineRef}
              data-popup-leader
              data-state={state}
              pathLength={1}
              stroke="#141414"
              strokeWidth={1}
            />
          )}
        </svg>
        {card && (
          <span
            key={card.opening}
            ref={dotRef}
            data-popup-dot
            data-state={state}
            className={css({
              position: 'absolute',
              top: '0',
              left: '0',
              w: '2',
              h: '2',
              borderRadius: 'full',
              bg: 'signal',
              boxShadow: '0 0 0 3px rgba(255, 90, 31, 0.2)',
            })}
          />
        )}
        <div
          ref={cardRef}
          className={css({ position: 'absolute', top: '0', left: '0', willChange: 'transform' })}
        >
          {card && item && (
            <div key={card.opening} data-popup-frame data-state={state}>
              <PopupCard
                swap={card.swap}
                key={hitKey(card.hit)}
                item={item}
                detail={scene.detailOf(card.hit.category, card.hit.slug)}
                locale={locale}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
