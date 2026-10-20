import type { Category } from '@choose/catalog'
import type { Pt } from './geometry'
import { CLOSE_S, type ItemTargets, OPEN_S, type SceneRenderer, type SceneTarget } from './renderer'

// The bridge between the routes and the scene. A page says what the scene should show
// (`showBands`, `showCanvas`) and the finder pushes its per-product targets and details. Requests
// made before the canvas exists are kept and applied when it attaches: React runs a child's
// effects before its parent's, so the page always speaks before the layout's canvas is ready.

/** What the product popup prints besides the specs. */
export type ItemDetail = { rank: number | null; score: number | null; excludedBy: string | null }

export const sameTarget = (a: SceneTarget | null, b: SceneTarget) =>
  !!a &&
  a.mode === b.mode &&
  (a.mode === 'bands' || (b.mode === 'canvas' && a.category === b.category))

class SceneController {
  private renderer: SceneRenderer | null = null
  private target: SceneTarget | null = null
  private settleAt = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly waiting = new Set<() => void>()
  private readonly targets = new Map<Category, ItemTargets | null>()
  private readonly details = new Map<Category, Map<string, ItemDetail>>()
  private readonly listeners = new Set<() => void>()
  private version = 0

  attach(renderer: SceneRenderer) {
    this.renderer = renderer
    for (const [category, targets] of this.targets) renderer.setTargets(category, targets)
    if (this.target) this.settleIn(renderer.go(this.target, { intro: true }))
    return () => {
      if (this.renderer === renderer) this.renderer = null
    }
  }

  get current() {
    return this.target
  }

  showBands() {
    this.go({ mode: 'bands' })
  }

  /** `focal`: the screen point the zoom grows from (where the visitor clicked). */
  showCanvas(category: Category, focal?: Pt) {
    this.go({ mode: 'canvas', category }, focal)
  }

  private go(target: SceneTarget, focal?: Pt) {
    if (sameTarget(this.target, target)) return
    this.target = target
    if (this.renderer) this.settleIn(this.renderer.go(target, { focal }))
  }

  /**
   * A timer rather than the animation's own callback: it fires even in a hidden tab. It runs a
   * frame after the end, once the renderer has wrapped the transition up.
   */
  private settleIn(seconds: number) {
    this.settleAt = performance.now() + seconds * 1000
    clearTimeout(this.timer)
    this.timer = setTimeout(
      () => {
        const callbacks = [...this.waiting]
        this.waiting.clear()
        for (const callback of callbacks) callback()
      },
      seconds * 1000 + 80,
    )
  }

  /** Seconds until the current transition ends, 0 once settled. */
  remaining() {
    return Math.max(0, (this.settleAt - performance.now()) / 1000)
  }

  /**
   * Seconds until the scene shows `target`: what is left of the current transition, or the whole
   * of the one a page is about to request (after a browser back, the page renders first).
   */
  until(target: SceneTarget) {
    if (sameTarget(this.target, target) || !this.renderer) return this.remaining()
    return target.mode === 'bands' ? CLOSE_S : OPEN_S
  }

  /** Calls back once the scene has settled; returns an unsubscribe. */
  whenSettled(callback: () => void) {
    if (this.remaining() === 0) {
      callback()
      return () => {}
    }
    this.waiting.add(callback)
    return () => {
      this.waiting.delete(callback)
    }
  }

  setTargets(category: Category, targets: ItemTargets | null, origin?: Pt) {
    this.targets.set(category, targets)
    this.renderer?.setTargets(category, targets, origin)
  }

  hoverBand(category: Category | null) {
    this.renderer?.hoverBand(category)
  }

  // ---- Popup details: a tiny store React subscribes to -----------------------------------------

  setDetails(category: Category, details: Map<string, ItemDetail> | null) {
    if (details) this.details.set(category, details)
    else this.details.delete(category)
    this.version++
    for (const listener of this.listeners) listener()
  }

  detailOf(category: Category, slug: string) {
    return this.details.get(category)?.get(slug) ?? null
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  snapshot = () => this.version
}

export const scene = new SceneController()
