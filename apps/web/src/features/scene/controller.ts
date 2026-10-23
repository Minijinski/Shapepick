import type { Category } from '@choose/catalog'
import type { Pt } from './geometry'
import {
  CLOSE_S,
  type ItemTargets,
  OPEN_S,
  type Rect,
  type SceneRenderer,
  type SceneTarget,
  SWAP_S,
} from './renderer'

// The bridge between the routes and the scene. A page says what the scene should show
// (`showBands`, `showCanvas`) and the finder pushes its per-product targets and details. Requests
// made before the canvas exists are kept and applied when it attaches: React runs a child's
// effects before its parent's, so the page always speaks before the layout's canvas is ready.

/**
 * What the product popup prints besides the specs: its rank and match once the finder ranks, or
 * the answer that rules it out.
 */
export type ItemDetail = {
  rank: number | null
  score: number | null
  ruledOut: boolean
  excludedBy: string | null
}

/**
 * How the scene reaches a page: its first paint, a panel opening from the home page, one
 * category's canvas replaced by another's, or the canvas folding back home.
 */
export type Arrival = 'intro' | 'open' | 'swap' | 'close'

/** How far some products are: their drawings and photos, 0 … 1. */
export type Readiness = { drawings: number; photos: number }

/** How far the products of the scene's first screen are, all of them and by category. */
export type FirstScreen = Readiness & { byCategory: Partial<Record<Category, Readiness>> }

export const sameTarget = (a: SceneTarget | null, b: SceneTarget) =>
  !!a &&
  a.mode === b.mode &&
  (a.mode === 'bands' || (b.mode === 'canvas' && a.category === b.category))

class SceneController {
  private renderer: SceneRenderer | null = null
  private target: SceneTarget | null = null
  private kind: Arrival = 'intro'
  private stage: Rect | null = null
  private pickable = true
  private settleAt = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly waiting = new Set<() => void>()
  private readonly targets = new Map<Category, ItemTargets | null>()
  private readonly details = new Map<Category, Map<string, ItemDetail>>()
  private readonly listeners = new Set<() => void>()
  private readonly openers = new Set<(category: Category, slug: string) => void>()
  private version = 0
  private firstScreen: (() => FirstScreen) | null = null

  attach(renderer: SceneRenderer) {
    this.renderer = renderer
    this.kind = 'intro'
    for (const [category, targets] of this.targets) renderer.setTargets(category, targets)
    renderer.setStage(this.stage)
    renderer.setPickable(this.pickable)
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
    this.kind = this.arrivalTo(target)
    this.target = target
    // The free space belongs to the page that asked for it; the next page measures its own.
    this.stage = null
    this.renderer?.setStage(null)
    // The first page of a visit makes an entrance, whichever of the page and the canvas is ready
    // first; later ones move from where the scene is.
    const intro = this.kind === 'intro'
    if (this.renderer) this.settleIn(this.renderer.go(target, { focal, intro }))
    // Home shows every product of every category again, whatever answers each one keeps.
    if (target.mode === 'bands') {
      for (const category of this.targets.keys()) this.setTargets(category, null)
    }
  }

  /** The kind of transition that brings the scene to `target` (the current one if it is there). */
  arrivalTo(target: SceneTarget): Arrival {
    if (sameTarget(this.target, target)) return this.kind
    if (!this.renderer || !this.target) return 'intro'
    if (target.mode === 'bands') return 'close'
    return this.target.mode === 'canvas' ? 'swap' : 'open'
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
    const arrival = this.arrivalTo(target)
    return arrival === 'close' ? CLOSE_S : arrival === 'swap' ? SWAP_S : OPEN_S
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

  /** Whether the products on the canvas take the pointer (off while the results cover it). */
  setPickable(pickable: boolean) {
    this.pickable = pickable
    this.renderer?.setPickable(pickable)
  }

  /** The free part of the screen on a category's canvas, where its short list gathers. */
  setStage(category: Category, stage: Rect | null) {
    if (this.target?.mode !== 'canvas' || this.target.category !== category) return
    this.stage = stage
    this.renderer?.setStage(stage)
  }

  // ---- The first screen, for the preloader -----------------------------------------------------

  /** The canvas says how to read how ready its first screen is (null: gone). */
  provideFirstScreen(probe: (() => FirstScreen) | null) {
    this.firstScreen = probe
  }

  /** How ready the scene's first screen is; null until the canvas exists. */
  firstScreenProgress(): FirstScreen | null {
    return this.firstScreen?.() ?? null
  }

  // ---- Products picked on the canvas -----------------------------------------------------------

  /** A product clicked on the canvas: the page opens its sheet. False when no page listens. */
  openProduct(category: Category, slug: string) {
    for (const open of this.openers) open(category, slug)
    return this.openers.size > 0
  }

  /** Called with every product clicked on the canvas; returns an unsubscribe. */
  onOpenProduct(open: (category: Category, slug: string) => void) {
    this.openers.add(open)
    return () => {
      this.openers.delete(open)
    }
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
