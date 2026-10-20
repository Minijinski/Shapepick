import { type CatalogItem, type Category, categories, type Locale } from '@choose/catalog'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { css } from 'styled-system/css'
import { gsap } from '../motion/gsap'
import { scene } from './controller'
import { markHydrated, readViewport } from './navigation'
import { PopupCard } from './PopupCard'
import { type Hit, SceneRenderer, sameHit, spriteResolution } from './renderer'
import { buildSprites } from './sprites'

// The canvas behind the pages of a locale, mounted once by the layout so it survives every
// navigation between the home page and the categories. It owns the pointer on the open canvas
// (hover, drag, fling, wheel) and the popup that follows the product under the pointer; a click
// (or a tap) on a product asks the page to open that product's sheet.

type Props = { catalogs: Record<Category, CatalogItem[]>; locale: Locale }

type Drag = { id: number; x: number; y: number; t: number; vx: number; vy: number; moved: number }

const TAP = 6
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function Scene({ catalogs, locale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLSpanElement>(null)
  const lineRef = useRef<SVGLineElement>(null)
  const [hit, setHit] = useState<Hit | null>(null)
  // Re-render when the finder publishes new ranks, so an open popup stays current.
  useSyncExternalStore(scene.subscribe, scene.snapshot, () => 0)

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
    const renderer = new SceneRenderer(canvas, categories)
    const dpr = () => Math.min(2, window.devicePixelRatio || 1)
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
      const box = cardRef.current
      const dot = dotRef.current
      const line = lineRef.current
      if (!root || !box || !dot || !line) return
      const r = renderer.focusRect()
      if (!r || !box.firstElementChild) {
        if (root.style.opacity !== '0') root.style.opacity = '0'
        return
      }
      root.style.opacity = '1'
      const { w: vw, h: vh } = renderer.viewport
      const cw = box.offsetWidth
      const ch = box.offsetHeight
      const gap = 36
      const cy = r.y + r.h / 2
      let x: number
      let y: number
      let ax: number
      let ay: number
      let ex: number
      let ey: number
      if (r.x + r.w + gap + cw <= vw - 12 || r.x - gap - cw >= 12) {
        const right = r.x + r.w + gap + cw <= vw - 12
        x = right ? r.x + r.w + gap : r.x - gap - cw
        y = clamp(cy - 34, 76, vh - ch - 12)
        ax = right ? r.x + r.w + 12 : r.x - 12
        ay = cy
        ex = right ? x : x + cw
        ey = clamp(cy, y + 18, y + ch - 18)
      } else {
        // No room beside it (a phone): above or below the product instead.
        const below = r.y + r.h + gap + ch <= vh - 12
        x = clamp(r.x + r.w / 2 - cw / 2, 12, vw - cw - 12)
        y = below ? r.y + r.h + gap : Math.max(76, r.y - gap - ch)
        ax = r.x + r.w / 2
        ay = below ? r.y + r.h + 12 : r.y - 12
        ex = clamp(ax, x + 18, x + cw - 18)
        ey = below ? y : y + ch
      }
      box.style.transform = `translate3d(${x}px, ${y}px, 0)`
      dot.style.transform = `translate3d(${ax - 4}px, ${ay - 4}px, 0)`
      line.setAttribute('x1', String(ax))
      line.setAttribute('y1', String(ay))
      line.setAttribute('x2', String(ex))
      line.setAttribute('y2', String(ey))
    }
    gsap.ticker.add(renderer.tick)

    // ---- Sprites: the open category first, the others right after ---------------------------
    let cancelled = false
    const current = scene.current
    const first = current?.mode === 'canvas' ? current.category : null
    const order = [...categories].sort((a, b) => Number(b === first) - Number(a === first))
    void (async () => {
      const resolution = spriteResolution(readViewport(), dpr())
      for (const category of order) {
        const sprites = await buildSprites(category, catalogs[category], resolution)
        if (cancelled) return
        renderer.setSprites(category, sprites)
      }
    })()

    // ---- Pointer on the open canvas ----------------------------------------------------------
    let drag: Drag | null = null
    const show = (next: Hit | null) => {
      renderer.setFocus(next)
      setHit((prev) => (sameHit(prev, next) ? prev : next))
      // A product under the pointer is clickable: it opens the product's sheet.
      if (next) canvas.dataset.hover = 'true'
      else delete canvas.dataset.hover
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
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
      if (e.pointerType === 'mouse') show(renderer.pick({ x: e.clientX, y: e.clientY }))
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
      cancelled = true
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
    }
  }, [catalogs])

  const item = hit ? catalogs[hit.category].find((i) => i.slug === hit.slug) : undefined

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
      <div
        ref={overlayRef}
        aria-hidden
        className={css({
          position: 'fixed',
          inset: '0',
          zIndex: '15',
          pointerEvents: 'none',
          transition: 'opacity 160ms',
        })}
        style={{ opacity: 0 }}
      >
        <svg
          aria-hidden
          className={css({ position: 'absolute', inset: '0', w: '100%', h: '100%' })}
        >
          <line ref={lineRef} stroke="#141414" strokeWidth={1} />
        </svg>
        <span
          ref={dotRef}
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
        <div
          ref={cardRef}
          className={css({ position: 'absolute', top: '0', left: '0', willChange: 'transform' })}
        >
          {hit && item && (
            <PopupCard
              key={`${hit.slug}:${hit.spot}:${hit.slot}:${hit.kx}:${hit.ky}`}
              item={item}
              detail={scene.detailOf(hit.category, hit.slug)}
              locale={locale}
            />
          )}
        </div>
      </div>
    </>
  )
}
