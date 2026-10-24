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
// (or a tap) on a product asks the page to open that product's sheet. The page's widgets (marked
// `data-keep-clear`) are left alone: the popup never covers them, nor opens for a product they
// mostly hide.

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
 * products, it glides to the next one instead of leaving), then fades away in this long (ms): the
 * `popupOut` animation in styles.css (140 ms), and the frame or two it waits to start.
 */
const POPUP_GRACE_MS = 120
const POPUP_OUT_MS = 180
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

/** Where the card goes, and where its leader line starts. */
type Placement = { side: Side; x: number; y: number; ax: number; ay: number }

/** Between a product and its card (px). */
const POPUP_GAP = 36
/** The room a card keeps from the screen's edges and from the page's widgets (px). */
const POPUP_CLEAR = 12
/** The card stays under the site header (px). */
const POPUP_TOP = 76
/** A card faces its product over at least this much (px), so its leader line stays short. */
const POPUP_FACING = 18
/**
 * A card's size before one has been measured: its width (`w` 64, 80 from `md`) and less than any
 * card's height, whole or compact. Too tall a guess would keep every card shut on a short screen,
 * and never measured; a card opened on too short a one is measured before it paints, then turns
 * compact, or stays hidden if it is still too big.
 */
const POPUP_SIZE = { w: 320, wCompact: 256, h: 200, hCompact: 140 }

/** Faded out or hidden is not showing (both spellings: older browsers only know the first two). */
const SHOWING: CheckVisibilityOptions = {
  checkOpacity: true,
  checkVisibilityCSS: true,
  opacityProperty: true,
  visibilityProperty: true,
}

/**
 * The page's widgets on screen, marked `data-keep-clear` (the console, the podium, the journey,
 * the counter, the popovers they open): those faded out, inert or not displayed do not count.
 * Read at most once a frame.
 */
const widgets = (() => {
  let frame = -1
  let boxes: Rect[] = []
  return (): readonly Rect[] => {
    if (frame === gsap.ticker.frame) return boxes
    frame = gsap.ticker.frame
    boxes = []
    for (const el of document.querySelectorAll<HTMLElement>('[data-keep-clear]')) {
      if (el.closest('[inert]') || !el.checkVisibility(SHOWING)) continue
      const box = el.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) {
        boxes.push({ x: box.left, y: box.top, w: box.width, h: box.height })
      }
    }
    return boxes
  }
})()

/**
 * What a card sliding along one axis must stay out of: the stretches of that axis taken by the
 * widgets in its way, with room to spare. `y`: the card slides up and down, from `at` to
 * `at + size` across; `x`: it slides sideways, from `at` to `at + size` down.
 */
function blockedAlong(axis: 'x' | 'y', boxes: readonly Rect[], at: number, size: number) {
  const spans: [number, number][] = []
  for (const b of boxes) {
    const [from, across, start, along] = axis === 'y' ? [b.x, b.w, b.y, b.h] : [b.y, b.h, b.x, b.w]
    if (from - POPUP_CLEAR >= at + size || from + across + POPUP_CLEAR <= at) continue
    spans.push([start - POPUP_CLEAR, start + along + POPUP_CLEAR])
  }
  return spans
}

/** The place in `lo` … `hi` nearest `want` where a card `length` long overlaps no span. */
function nearestClear(
  want: number,
  lo: number,
  hi: number,
  length: number,
  spans: readonly [number, number][],
) {
  if (lo > hi) return null
  const clear = (v: number) => spans.every(([a, b]) => v + length <= a || v >= b)
  let best: number | null = null
  for (const v of [clamp(want, lo, hi), ...spans.flatMap(([a, b]) => [a - length, b])]) {
    if (v < lo || v > hi || !clear(v)) continue
    if (best == null || Math.abs(v - want) < Math.abs(best - want)) best = v
  }
  return best
}

/**
 * Where the card goes beside a product’s screen box, clear of the screen’s edges and of the page’s
 * widgets, and where its leader line starts; null when it has room nowhere.
 */
function placePopup(
  r: Rect,
  vw: number,
  vh: number,
  cw: number,
  ch: number,
  boxes: readonly Rect[],
): Placement | null {
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  // Beside it, on the right first: the card slides up or down out of the widgets' way, as long
  // as it still faces its product.
  for (const side of ['right', 'left'] as const) {
    const x = side === 'right' ? r.x + r.w + POPUP_GAP : r.x - POPUP_GAP - cw
    if (x < POPUP_CLEAR || x + cw > vw - POPUP_CLEAR) continue
    const y = nearestClear(
      cy - 34,
      Math.max(POPUP_TOP, r.y + POPUP_FACING - ch),
      Math.min(vh - POPUP_CLEAR - ch, r.y + r.h - POPUP_FACING),
      ch,
      blockedAlong('y', boxes, x, cw),
    )
    if (y == null) continue
    return { side, x, y, ax: side === 'right' ? r.x + r.w + 12 : r.x - 12, ay: cy }
  }
  // No room beside it (a phone, or widgets on both sides): below or above it, sliding sideways.
  for (const side of ['below', 'above'] as const) {
    const y = side === 'below' ? r.y + r.h + POPUP_GAP : r.y - POPUP_GAP - ch
    if (y < POPUP_TOP || y + ch > vh - POPUP_CLEAR) continue
    const x = nearestClear(
      cx - cw / 2,
      Math.max(POPUP_CLEAR, r.x + POPUP_FACING - cw),
      Math.min(vw - POPUP_CLEAR - cw, r.x + r.w - POPUP_FACING),
      cw,
      blockedAlong('x', boxes, y, ch),
    )
    if (x == null) continue
    return { side, x, y, ax: cx, ay: side === 'below' ? r.y + r.h + 12 : r.y - 12 }
  }
  return null
}

/** Where the leader line meets the card, wherever the card is on its way. */
function lineEnd(side: Side, x: number, y: number, cw: number, ch: number, ax: number, ay: number) {
  if (side === 'right') return { x: x, y: clamp(ay, y + 18, y + ch - 18) }
  if (side === 'left') return { x: x + cw, y: clamp(ay, y + 18, y + ch - 18) }
  return { x: clamp(ax, x + 18, x + cw - 18), y: side === 'below' ? y : y + ch }
}

/**
 * Whether a product's card opens on its rank and match (or on the answer that rules it out): one
 * line more, so a taller card.
 */
const headed = (hit: Hit) => {
  const detail = scene.detailOf(hit.category, hit.slug)
  return detail?.rank != null || detail?.ruledOut ? 1 : 0
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
    /** Moved on from another product of the same opening: only its lines fade in again. */
    swap: boolean
  } | null>(null)
  const cardState = useRef(card)
  cardState.current = card
  /**
   * Whether the card leaves its specs out: there is no room for the whole card beside its product,
   * clear of the page's widgets (a short screen).
   */
  const [compact, setCompact] = useState(false)
  const compactState = useRef(compact)
  compactState.current = compact
  /**
   * Where the card is drawn, eased towards its place, on which side of its product, and for which
   * opening (0: none yet).
   */
  const placed = useRef({ x: 0, y: 0, side: 'right' as Side, at: 0, opening: 0 })
  /**
   * The last cards' sizes (0: none measured yet), which the next ones expect: whole or compact,
   * each without and with the line of rank and match (see `headed`).
   */
  const cardSize = useRef({ w: 0, whole: [0, 0], compact: [0, 0] })
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

  // A new opening is placed before it paints, so its entrance drifts in on the right side. A card
  // larger than the room it was expected to fit turns compact, still before it paints.
  const opening = card && !card.leaving ? card.opening : null
  useIsoLayoutEffect(() => {
    if (opening == null) return
    const renderer = rendererRef.current
    const box = cardRef.current
    const r = renderer?.focusRect()
    if (!renderer || !box || !r) return
    const { w: vw, h: vh } = renderer.viewport
    const cw = box.offsetWidth
    const ch = box.offsetHeight
    cardSize.current.w = cw
    if (card) cardSize.current[compact ? 'compact' : 'whole'][headed(card.hit)] = ch
    const to = placePopup(r, vw, vh, cw, ch, widgets())
    if (!to) {
      if (overlayRef.current) overlayRef.current.style.visibility = 'hidden'
      if (!compact) {
        setCompact(true)
        return
      }
      // Not even room for the compact card: no card after all.
      renderer.setFocus(null)
      setHit(null)
      return
    }
    // A card already on screen (turning whole or compact as it glides on) eases to its place.
    if (placed.current.opening === opening) return
    Object.assign(placed.current, {
      x: to.x,
      y: to.y,
      side: to.side,
      at: performance.now(),
      opening,
    })
    box.style.transform = `translate3d(${to.x}px, ${to.y}px, 0)`
    const frame = box.firstElementChild as HTMLElement | null
    if (frame) frame.dataset.side = to.side
    renderer.onFrame?.()
  }, [opening, compact])

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
    renderer.keepClear = widgets
    mark('scene')
    // The layout is the viewport's; the canvas paints down to the bottom of the largest one (its
    // CSS height, 100lvh), so a phone's toolbar folding away as the home scrolls never resizes it.
    const fit = () => {
      const vp = readViewport()
      renderer.resize(vp.w, vp.h, dpr(), canvas.clientHeight)
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
      const { w: vw, h: vh } = renderer.viewport
      const cw = box.offsetWidth
      const ch = box.offsetHeight
      const size = cardSize.current
      size.w = cw
      size[compactState.current ? 'compact' : 'whole'][headed(cardState.current.hit)] = ch
      const to = placePopup(r, vw, vh, cw, ch, widgets())
      // Its room is gone (a widget opened beside it, the window shrank): the whole card turns
      // compact, a compact one folds away.
      if (!to) {
        if (!compactState.current) setCompact(true)
        else {
          renderer.setFocus(null)
          setHit(null)
        }
        return
      }
      root.style.visibility = 'visible'
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
    /** Highlights a product and opens its card, compact if said so (null: none). */
    const focus = (next: Hit | null, small = false) => {
      renderer.setFocus(next)
      if (next) setCompact(small)
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
    /**
     * Which card has room beside this product, clear of the page's widgets, sized as the last ones
     * were: the whole card, else the compact one, else none. Without one the product opens no
     * card, but its sheet still opens on a click.
     */
    const fitFor = (next: Hit) => {
      const r = renderer.rectOf(next)
      if (!r) return null
      const { w: vw, h: vh } = renderer.viewport
      const size = cardSize.current
      const cw = size.w || (vw >= 768 ? POPUP_SIZE.w : POPUP_SIZE.wCompact)
      const head = headed(next)
      const boxes = widgets()
      if (placePopup(r, vw, vh, cw, size.whole[head] || POPUP_SIZE.h, boxes)) return 'whole'
      if (placePopup(r, vw, vh, cw, size.compact[head] || POPUP_SIZE.hCompact, boxes)) {
        return 'compact'
      }
      return null
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
        const fit = fitFor(next)
        if (fit) focus(next, fit === 'compact')
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
      // On the home page the canvas only shows the panels: a finger on it scrolls the page.
      if (e.button !== 0 || canvas.dataset.mode !== 'canvas') return
      scene.canvasPressed()
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
      // A card is open: a slow pointer takes it along to the next product (if it has room
      // there), a quick one lets it go.
      if (pointer.speed <= PASS_SPEED || sameHit(card.hit, next)) {
        forget()
        const fit = fitFor(next)
        focus(fit ? next : null, fit === 'compact')
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
      // The home page scrolls under a wheel; only a canvas takes it.
      if (canvas.dataset.mode !== 'canvas') return
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
          top: '0',
          left: '0',
          w: '100%',
          // The largest viewport: still covering the screen once a phone's toolbar folds away.
          h: '100lvh',
          zIndex: '0',
          // On a canvas, a finger browses it; on the home page, it scrolls the page.
          touchAction: 'none',
          '&[data-mode=bands]': { touchAction: 'pan-y pinch-zoom' },
          userSelect: 'none',
          '&[data-mode=canvas]': { cursor: 'grab' },
          '&[data-mode=canvas][data-hover]': { cursor: 'pointer' },
          '&[data-dragging]': { cursor: 'grabbing' },
        })}
      />
      {/* The popup: a leader line from the product to a card beside it. Its parts come in in CSS
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
                compact={compact}
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
