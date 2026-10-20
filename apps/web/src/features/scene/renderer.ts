import type { Category } from '@choose/catalog'
import { radii } from '~/styles/radii'
import { gsap } from '../motion/gsap'
import {
  bandQuads,
  boundsOf,
  centroid,
  frameOf,
  fullQuad,
  hash01,
  isCompact,
  lerpQuad,
  type Pt,
  type Quad,
  tileLayout,
  tiltFor,
  traceRounded,
  type Viewport,
} from './geometry'
import type { Sprite } from './sprites'

// The scene behind every page of a locale, drawn on one canvas. On the home page it is one tilted
// panel per category, each a window onto that category's world drifting along the panel. On a
// category page the chosen panel has grown over the others into the whole screen, and its world
// is the canvas the visitor browses. Both are the same drawing with different numbers, which is
// why going from one to the other cannot flicker.
//
// On the canvas every product keeps its places. The answers grade it: kept products are drawn in
// colour, ruled-out ones as sketches, fainter the more answers they miss. Once only a short list
// is left, those products leave the field and gather in front of it, each shown once.

export type SceneTarget = { mode: 'bands' } | { mode: 'canvas'; category: Category }

/** What the finder wants each product of its category to look like. */
export type ItemTargets = {
  /** How many answers each product fails (0: kept); null while nothing filters yet. */
  misses: Map<string, number> | null
  /** Products the hovered option keeps, highlighted. */
  hot: Set<string> | null
  /** Kept products, best match first. */
  order: string[]
  /** Their match, 0 … 1, in the same order: printed beside the podium's ranks on the canvas. */
  scores?: number[]
}

/**
 * The part of the screen the finder leaves free, where the short list gathers. `axis` is the x it
 * centres on when it fits around it (the console's axis), rather than on the free space's own.
 */
export type Rect = { x: number; y: number; w: number; h: number; axis?: number }

/**
 * A product under the pointer: one of the short list (`spot`), or one copy on the field (the tile
 * repeats; `slot` is its place in the tile, `kx`/`ky` which repetition).
 */
export type Hit = {
  category: Category
  slug: string
  spot: boolean
  slot: number
  kx: number
  ky: number
}

export const sameHit = (a: Hit | null, b: Hit | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.category === b.category &&
    a.slug === b.slug &&
    a.spot === b.spot &&
    a.slot === b.slot &&
    a.kx === b.kx &&
    a.ky === b.ky)

// ==== Tuning ===================================================================================

/** Room per product in the repeating tile, in world px: wide enough that neighbours never touch. */
const CELL: Record<Category, { w: number; h: number }> = {
  keyboard: { w: 400, h: 230 },
  monitor: { w: 540, h: 370 },
}
/** How far a product may stray from its cell centre, as a share of the room it leaves. */
const JITTER = 0.3
/** A small catalogue is laid out more than once per tile, so its repetition is far apart. */
const MIN_SLOTS = 50
const ZOOM = { band: 0.5, canvas: 1, bandCompact: 0.4, canvasCompact: 0.56 }
/** On-screen drift in px/s: along the panel on the home page, a calmer diagonal on the canvas. */
const SPEED = { band: 36, canvas: 18 }
/** Direction products travel on the canvas: from the top-right corner towards the bottom-left. */
const CANVAS_ANGLE = (145 * Math.PI) / 180
const HOVER_ZOOM = 0.07
/** Seconds a panel takes to open over the others, to fold back, and to swap categories. */
export const OPEN_S = 1.25
export const CLOSE_S = 1.1
export const SWAP_S = 1.05
const MASK_EASE = 'expo.inOut'
/** The world properties transitions animate; the sprites' fade-in is left alone. */
const MOTION = 'zoom,angle,speed,pause'
const DOT_STEP = 28
/** Up to this many kept products gather in front of the field, if the free space fits them. */
const SPOT_MAX = 12
const SPOT_ZOOM = { max: 1, maxCompact: 0.72, min: 0.42 }
/** Margin around the short list, in screen px, where the field below never takes the pointer. */
const SPOT_MARGIN = 32
/** Opacity of a sketch by the number of answers its product fails (1, 2, 3 or more). */
const FAINT = [1, 0.75, 0.5, 0.3] as const

const PAPER = [243, 241, 236] as const
const PANEL = [234, 231, 224] as const
const PANEL_HOVER = [248, 247, 244] as const
const SIGNAL = '#FF5A1F'
const INK = '#141414'
const INK_MUTED = '#625E56'
const MONO = '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace'

/** Device px per world px the sprites need: the pixel ratio times the largest zoom drawn. */
export const spriteResolution = (vp: Viewport, dpr: number) =>
  dpr *
  (isCompact(vp)
    ? Math.max(ZOOM.canvasCompact, SPOT_ZOOM.maxCompact)
    : Math.max(ZOOM.canvas, SPOT_ZOOM.max))

// ==== Animation channels =======================================================================

// Products change state in bulk (an answer can grey out half the canvas), so they are not GSAP
// tweens: each channel stores where it comes from, where it goes and when it started, and the
// drawing reads it. That also lets every on-screen copy start late by its distance from the
// console, which makes a new answer ripple across the canvas.

type Channel = { from: number; to: number; start: number; dur: number; ripple: boolean }

const channel = (v: number): Channel => ({ from: v, to: v, start: 0, dur: 0, ripple: false })
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function read(c: Channel, now: number, delay = 0) {
  if (c.dur <= 0) return c.to
  const t = (now - c.start - delay) / c.dur
  if (t >= 1) return c.to
  if (t <= 0) return c.from
  return c.from + (c.to - c.from) * easeOut(t)
}

function aim(c: Channel, to: number, now: number, dur: number, ripple = false) {
  if (c.to === to) return
  c.from = dur > 0 ? read(c, now) : to
  c.to = to
  c.start = now
  c.dur = dur
  c.ripple = ripple
}

// ==== Model ====================================================================================

/** One product: its bitmaps and its state, shared by every place it has in the tile. */
type Item = {
  slug: string
  sprite: Sprite
  /** 1 kept by the answers (drawn in colour), 0 ruled out (drawn as a sketch). */
  on: Channel
  /** Opacity of the sketch: fainter the more answers the product fails. */
  faint: Channel
  /** 1 kept by the option under the pointer. */
  hot: Channel
  /** 1 while another option is previewed. */
  dim: Channel
  /** The field copies: shown (1), or handed over to the short list (0). */
  field: Channel
  /** Position among the kept products, best first. */
  rank: number | null
  /** Its match (0 … 1) while it is kept. */
  score: number | null
}

/** A place in the tile: a cell centre and a -1..1 jitter scaled by the room its product leaves. */
type Slot = { cx: number; cy: number; jx: number; jy: number; item: Item }

/** One copy on the field: a slot of the tile and which repetition of the tile. */
type Copy = { slot: number; kx: number; ky: number }

/** A product of the short list, flying between the field and its place in front. */
type SpotItem = {
  item: Item
  /** Its place in the short list (screen px) and scale. */
  to: Pt
  scale: number
  /** The flight towards it (or back to the field). */
  from: Pt
  fromScale: number
  start: number
  dur: number
  leaving: boolean
  /** Leaving a short list it still belongs to the answers of: the field copy it lands on. */
  land: Copy | null
  landed: boolean
  phase: number
}

type Pose = { x: number; y: number; scale: number; alpha: number }

class World {
  items: Item[] = []
  slots: Slot[] = []
  bySlug = new Map<string, Item>()
  cell = { w: 1, h: 1 }
  tile = { w: 1, h: 1 }
  /** World point at the viewport centre. */
  cam: Pt
  zoom = ZOOM.band
  /** Direction products travel on screen, radians. */
  angle = Math.PI / 2
  speed = SPEED.band
  /** Drift multiplier: eased to 0 while a product is looked at or the canvas dragged. */
  pause = 1
  /** Fades the products in once their sprites exist. */
  alpha = 0
  /** Fades a whole category out and in when the visitor switches categories. */
  presence = channel(1)
  /** Fling after a drag, screen px/s. */
  velocity: Pt = { x: 0, y: 0 }
  /** During a zoom, the world point that stays under a screen point (the click). */
  anchor: { screen: Pt; world: Pt } | null = null
  spot: SpotItem[] = []

  constructor(readonly category: Category) {
    const cell = CELL[category]
    this.cam = { x: hash01(category) * cell.w * 4, y: hash01(`${category}~`) * cell.h * 4 }
  }
}

type Band = {
  category: Category
  index: number
  world: World
  /** Intro: 0 below its place and transparent, 1 in place. */
  enter: number
  /** 0 the panel, 1 the whole screen. */
  expand: number
  /** Pointer over the panel on the home page. */
  hover: number
  /** Paper veil over a panel while another one is hovered or opening. */
  veil: number
  /** The panel's own paper and dots; off while its products appear over another category. */
  ground: number
}

type Transform = { scale: number; ox: number; oy: number }

const mix = (a: readonly number[], b: readonly number[], t: number) =>
  a.map((v, i) => Math.round(v + ((b[i] ?? v) - v) * t))
const rgb = (c: readonly number[]) => `rgb(${c.join(',')})`

// ==== Renderer =================================================================================

export class SceneRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private vp: Viewport = { w: 1, h: 1 }
  private dpr = 1
  private quads: Quad[] = []
  private readonly bands: Band[]
  /** Panels grown over the others, last on top. */
  private stack: Category[] = []
  private target: SceneTarget = { mode: 'bands' }
  private readonly targets = new Map<Category, ItemTargets | null>()
  private stage: Rect | null = null
  private dots: CanvasPattern | null = null
  private focus: { hit: Hit; since: number } | null = null
  private dragging = false
  private ripple: Pt = { x: 0, y: 0 }
  private last = performance.now()
  private readonly reduce: boolean
  /** Called after every frame, for overlays that follow a product (the popup). */
  onFrame: (() => void) | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    categories: readonly Category[],
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available')
    this.ctx = ctx
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.bands = categories.map((category, index) => ({
      category,
      index,
      world: new World(category),
      enter: 0,
      expand: 0,
      hover: 0,
      veil: 0,
      ground: 1,
    }))
  }

  // ---- Setup ----------------------------------------------------------------------------------

  get viewport() {
    return this.vp
  }

  resize(w: number, h: number, dpr: number) {
    this.vp = { w, h }
    this.dpr = dpr
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.quads = bandQuads(this.vp, this.bands.length)
    this.dots = this.makeDots()
    this.ripple = { x: w / 2, y: h * 0.8 }
    for (const band of this.bands) {
      if (gsap.isTweening(band.world)) continue
      band.world.zoom = this.zoomFor(band)
      band.world.angle = this.angleFor(band)
    }
  }

  /** Lays a category's products out in its tile once their bitmaps exist. */
  setSprites(category: Category, sprites: Map<string, Sprite>) {
    const band = this.band(category)
    if (!band) return
    const world = band.world
    world.items = [...sprites].map(([slug, sprite]) => ({
      slug,
      sprite,
      on: channel(1),
      faint: channel(1),
      hot: channel(0),
      dim: channel(0),
      field: channel(1),
      rank: null,
      score: null,
    }))
    world.bySlug = new Map(world.items.map((item) => [item.slug, item]))
    const copies = Math.max(1, Math.ceil(MIN_SLOTS / Math.max(world.items.length, 1)))
    const layout = tileLayout(
      world.items.map((item) => item.slug),
      CELL[category],
      copies,
    )
    world.cell = CELL[category]
    world.tile = { w: layout.w, h: layout.h }
    world.slots = layout.cells.flatMap((c) => {
      const item = world.bySlug.get(c.id)
      return item ? [{ cx: c.cx, cy: c.cy, jx: c.jx, jy: c.jy, item }] : []
    })
    world.spot = []
    this.applyTargets(band, this.targets.get(category) ?? null, false)
    gsap.to(world, { alpha: 1, duration: this.reduce ? 0 : 0.9, ease: 'power2.out' })
  }

  dispose() {
    for (const band of this.bands) gsap.killTweensOf([band, band.world])
    this.onFrame = null
  }

  // ---- Where the scene is going ---------------------------------------------------------------

  /** Moves the scene to a target and returns the seconds until it settles. */
  go(target: SceneTarget, { focal, intro = false }: { focal?: Pt; intro?: boolean } = {}) {
    const from = this.target
    this.target = target
    this.focus = null
    this.canvas.dataset.mode = target.mode
    for (const band of this.bands) gsap.killTweensOf(band)
    if (intro) {
      return target.mode === 'bands' ? this.introBands() : this.introCanvas(target.category)
    }
    if (target.mode === 'bands') {
      return from.mode === 'canvas' ? this.close(from.category) : this.introBands()
    }
    if (from.mode === 'canvas' && from.category !== target.category) {
      return this.swap(from.category, target.category, focal)
    }
    return this.open(target.category, focal)
  }

  private introBands() {
    this.stack = []
    this.bands.forEach((band, i) => {
      Object.assign(band, { expand: 0, hover: 0, veil: 0, ground: 1 })
      this.rest(band)
      if (this.reduce) band.enter = 1
      else
        gsap.fromTo(
          band,
          { enter: 0 },
          { enter: 1, duration: 1.2, delay: 0.1 + 0.09 * i, ease: 'expo.out' },
        )
    })
    return this.reduce ? 0 : 0.5
  }

  private introCanvas(category: Category) {
    const band = this.band(category)
    if (!band) return 0
    this.stack = [category]
    for (const other of this.bands) {
      Object.assign(other, { enter: 1, expand: other === band ? 1 : 0, hover: 0, veil: 0 })
      other.ground = 1
      this.rest(other)
    }
    if (!this.reduce) {
      gsap.from(band.world, { zoom: band.world.zoom * 1.08, duration: 1.6, ease: 'expo.out' })
    }
    return this.reduce ? 0 : 0.35
  }

  /** The clicked panel grows over the others while its world zooms in around the click. */
  private open(category: Category, focal: Pt | undefined) {
    const band = this.band(category)
    const base = band && this.quads[band.index]
    if (!band || !base) return 0
    const world = band.world
    const below = this.stack.filter((c) => c !== category)
    this.stack = [...below, category]
    gsap.killTweensOf(world, MOTION)
    this.foldHover(band)
    Object.assign(band, { enter: 1, veil: 0, ground: 1 })
    const point = focal ?? centroid(base)
    world.anchor = { screen: point, world: this.toWorld(band, point) }
    const zoom = this.zoomFor(band)
    const settle = () => {
      world.anchor = null
      this.stack = [category]
      // The panels underneath are hidden now: put them back to rest for the way home.
      for (const other of this.bands) {
        if (other === band) continue
        gsap.killTweensOf(other)
        Object.assign(other, { expand: 0, veil: 0, hover: 0, enter: 1, ground: 1 })
        this.rest(other)
      }
    }
    if (this.reduce) {
      Object.assign(world, { zoom, angle: CANVAS_ANGLE, speed: SPEED.canvas })
      band.expand = 1
      settle()
      return 0
    }
    gsap.to(band, { expand: 1, duration: OPEN_S, ease: MASK_EASE, onComplete: settle })
    gsap.to(world, { zoom, duration: OPEN_S, ease: MASK_EASE })
    gsap.to(world, {
      angle: CANVAS_ANGLE,
      speed: SPEED.canvas,
      duration: OPEN_S,
      ease: 'power2.inOut',
    })
    for (const other of this.bands) {
      if (other === band || below.includes(other.category)) continue
      gsap.to(other, { veil: 1, hover: 0, duration: OPEN_S * 0.6, ease: 'power2.out' })
    }
    return OPEN_S
  }

  /** The open panel shrinks back into its slot, revealing the others again. */
  private close(category: Category) {
    const band = this.band(category)
    const base = band && this.quads[band.index]
    if (!band || !base) return this.introBands()
    const world = band.world
    gsap.killTweensOf(world, MOTION)
    this.stack = [category]
    Object.assign(band, { ground: 1, veil: 0 })
    for (const other of this.bands) {
      if (other === band) continue
      Object.assign(other, { enter: 1, expand: 0, hover: 0, veil: 1, ground: 1 })
      this.rest(other)
      gsap.to(other, { veil: 0, duration: CLOSE_S * 0.7, delay: CLOSE_S * 0.3, ease: 'power2.out' })
    }
    const point = centroid(base)
    world.anchor = { screen: point, world: this.toWorld(band, point) }
    const settle = () => {
      world.anchor = null
      this.stack = []
    }
    const zoom = this.zoomFor(band)
    const angle = this.angleFor(band)
    if (this.reduce) {
      Object.assign(world, { zoom, angle, speed: SPEED.band, pause: 1 })
      band.expand = 0
      settle()
      return 0
    }
    gsap.to(band, { expand: 0, duration: CLOSE_S, ease: MASK_EASE, onComplete: settle })
    gsap.to(world, { zoom, duration: CLOSE_S, ease: MASK_EASE })
    gsap.to(world, {
      angle,
      speed: SPEED.band,
      pause: 1,
      duration: CLOSE_S,
      ease: 'power2.inOut',
    })
    return CLOSE_S
  }

  /**
   * From one category's canvas to another's, in place: the screen stays a canvas, the old
   * products dissolve and the new ones appear, both in a wave from where the visitor clicked.
   */
  private swap(from: Category, to: Category, focal: Pt | undefined) {
    const old = this.band(from)
    const band = this.band(to)
    if (!old || !band) return this.open(to, focal)
    const now = performance.now()
    if (focal) this.ripple = focal
    // Whatever was half-way (a panel still opening) lands at once: the old canvas fills the screen.
    for (const other of this.bands) {
      if (other === old || other === band) continue
      Object.assign(other, { expand: 0, veil: 0, hover: 0, enter: 1, ground: 1 })
      this.rest(other)
    }
    gsap.killTweensOf(old.world, MOTION)
    Object.assign(old, { enter: 1, expand: 1, hover: 0, veil: 0, ground: 1 })
    Object.assign(old.world, { zoom: this.zoomForCanvas(), pause: 1, anchor: null })
    gsap.killTweensOf(band.world, MOTION)
    Object.assign(band, { enter: 1, expand: 1, hover: 0, veil: 0, ground: 0 })
    // Same camera, zoom and drift as the old world: the dots run on without a seam.
    Object.assign(band.world, {
      zoom: old.world.zoom,
      cam: { ...old.world.cam },
      angle: CANVAS_ANGLE,
      speed: SPEED.canvas,
      pause: 1,
      velocity: { ...old.world.velocity },
      anchor: null,
      spot: [],
    })
    for (const item of band.world.items) aim(item.field, 1, now, 0)
    this.stack = [from, to]
    const settle = () => {
      this.stack = [to]
      band.ground = 1
      Object.assign(old, { expand: 0, veil: 0, hover: 0, enter: 1, ground: 1 })
      this.rest(old)
    }
    if (this.reduce) {
      band.world.presence = channel(1)
      settle()
      return 0
    }
    aim(old.world.presence, 0, now, 520, true)
    band.world.presence = { from: 0, to: 1, start: now + 280, dur: 720, ripple: true }
    gsap.to(band, { ground: 0, duration: SWAP_S, onComplete: settle })
    return SWAP_S
  }

  /** The pointer is over a panel of the home page (null: over none). */
  hoverBand(category: Category | null) {
    if (this.target.mode !== 'bands' || this.stack.length) return
    for (const band of this.bands) {
      const on = band.category === category
      gsap.to(band, {
        hover: on ? 1 : 0,
        veil: category && !on ? 1 : 0,
        duration: 0.7,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    }
  }

  // ---- Product states -------------------------------------------------------------------------

  /** New per-product targets; `origin` is where the change ripples out from (the console). */
  setTargets(category: Category, targets: ItemTargets | null, origin?: Pt) {
    this.targets.set(category, targets)
    if (origin) this.ripple = origin
    const band = this.band(category)
    if (band) this.applyTargets(band, targets, true)
  }

  /** The free part of the screen on the open canvas (null: no short list, e.g. on results). */
  setStage(stage: Rect | null) {
    const same =
      stage === this.stage ||
      (!!stage &&
        !!this.stage &&
        Math.abs(stage.x - this.stage.x) < 1 &&
        Math.abs(stage.y - this.stage.y) < 1 &&
        Math.abs(stage.w - this.stage.w) < 1 &&
        Math.abs(stage.h - this.stage.h) < 1 &&
        Math.abs((stage.axis ?? 0) - (this.stage.axis ?? 0)) < 1)
    if (same) return
    this.stage = stage
    if (this.target.mode !== 'canvas') return
    const band = this.band(this.target.category)
    const t = band && this.targets.get(band.category)
    if (band) this.updateSpot(band, t?.misses ? t.order : null, performance.now(), true)
  }

  private applyTargets(band: Band, t: ItemTargets | null, animate: boolean) {
    const now = performance.now()
    const slow = animate ? 560 : 0
    const fast = animate ? 240 : 0
    const rankOf = new Map(t?.order.map((slug, i) => [slug, i]) ?? [])
    for (const item of band.world.items) {
      const misses = t?.misses?.get(item.slug) ?? 0
      const hot = !!t?.hot?.has(item.slug)
      aim(item.on, misses === 0 ? 1 : 0, now, slow, true)
      aim(item.faint, FAINT[Math.min(misses, FAINT.length - 1)] ?? 1, now, slow, true)
      aim(item.hot, hot ? 1 : 0, now, fast)
      aim(item.dim, t?.hot && !hot ? 1 : 0, now, fast)
      item.rank = rankOf.get(item.slug) ?? null
      item.score = item.rank != null ? (t?.scores?.[item.rank] ?? null) : null
    }
    this.updateSpot(band, t?.misses ? t.order : null, now, animate)
  }

  /**
   * The short list: when few products are left, they fly out of the field to a grid in the free
   * space, each shown once; the ones dropped fly back (or fade into their sketches).
   */
  private updateSpot(band: Band, order: string[] | null, now: number, animate: boolean) {
    const world = band.world
    if (!world.items.length) return
    const wanted =
      order && order.length > 0 && order.length <= SPOT_MAX && this.target.mode === 'canvas'
        ? order
        : []
    const layout = wanted.length ? this.spotLayout(world, wanted) : null
    const keep = layout ? wanted : []

    for (const s of world.spot) {
      if (s.leaving || keep.includes(s.item.slug)) continue
      const pose = this.spotPose(band, s, now)
      Object.assign(s, {
        leaving: true,
        from: { x: pose.x, y: pose.y },
        fromScale: pose.scale,
        start: now,
        dur: animate ? 820 : 0,
      })
      if (s.item.on.to === 1) {
        // Still kept (the list just grew too long): back to the nearest copy on the field.
        s.land = this.nearestCopy(band, s.item, pose)
      } else {
        // Ruled out: it fades where it is while its sketches come back on the field.
        s.land = null
        aim(s.item.field, 1, now, animate ? 420 : 0)
      }
    }

    keep.forEach((slug, i) => {
      const item = world.bySlug.get(slug)
      const to = layout?.positions[i]
      if (!item || !to || !layout) return
      const existing = world.spot.find((s) => s.item === item)
      if (existing) {
        const settled =
          !existing.leaving && Math.hypot(existing.to.x - to.x, existing.to.y - to.y) < 1
        if (settled && Math.abs(existing.scale - layout.zoom) < 0.001) return
        const pose = this.spotPose(band, existing, now)
        Object.assign(existing, {
          to,
          scale: layout.zoom,
          from: { x: pose.x, y: pose.y },
          fromScale: pose.scale,
          start: now + i * 40,
          dur: animate ? 720 : 0,
          leaving: false,
          land: null,
          landed: false,
        })
        aim(item.field, 0, now, animate ? 250 : 0)
        return
      }
      // Entering: it takes off from its nearest copy on the field, which hands over to it.
      const copy = this.nearestCopy(band, item, to)
      const pose = copy ? this.copyPose(band, copy) : { x: to.x, y: to.y + 40, scale: layout.zoom }
      world.spot.push({
        item,
        to,
        scale: layout.zoom,
        from: { x: pose.x, y: pose.y },
        fromScale: pose.scale,
        start: now + i * 55,
        dur: animate ? 950 : 0,
        leaving: false,
        land: null,
        landed: false,
        phase: hash01(slug) * Math.PI * 2,
      })
      aim(item.field, 0, now, animate ? 250 : 0)
    })
  }

  /**
   * The short list's grid: centred on the stage's axis (under the console) when it fits there,
   * otherwise across the whole free space.
   */
  private spotLayout(world: World, slugs: string[]) {
    const stage = this.stage
    if (!stage) return null
    const items = slugs.flatMap((slug) => world.bySlug.get(slug) ?? [])
    if (!items.length) return null
    if (stage.axis != null) {
      const half = Math.min(stage.axis - stage.x, stage.x + stage.w - stage.axis)
      const centred = { ...stage, x: stage.axis - half, w: half * 2 }
      const layout = half > 0 ? this.gridIn(centred, items) : null
      if (layout) return layout
    }
    return this.gridIn(stage, items)
  }

  /** A grid of `items` in `stage`: the largest scale at which every product fits. */
  private gridIn(stage: Rect, items: Item[]) {
    if (stage.w < 120 || stage.h < 80) return null
    const n = items.length
    const maxW = Math.max(...items.map((i) => i.sprite.w))
    const maxH = Math.max(...items.map((i) => i.sprite.h))
    const compact = isCompact(this.vp)
    const gap = compact ? 18 : 36
    const ceiling = compact ? SPOT_ZOOM.maxCompact : SPOT_ZOOM.max
    // The largest scale wins; among layouts that reach it, the one shaped most like the free space.
    const aspect = stage.w / stage.h
    let best = { cols: 1, rows: n, zoom: 0, fit: Number.POSITIVE_INFINITY }
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols)
      const zoom = Math.min(
        (stage.w - gap * (cols - 1)) / cols / maxW,
        (stage.h - gap * (rows - 1)) / rows / maxH,
        ceiling,
      )
      const gridW = cols * (maxW * zoom + gap) - gap
      const gridH = rows * (maxH * zoom + gap) - gap
      const fit = Math.abs(Math.log(gridW / gridH / aspect)) + (cols * rows - n) * 0.15
      if (zoom > best.zoom + 0.01 || (zoom > best.zoom - 0.01 && fit < best.fit)) {
        best = { cols, rows, zoom, fit }
      }
    }
    if (best.zoom < SPOT_ZOOM.min) return null
    const { cols, rows, zoom } = best
    const cw = maxW * zoom + gap
    const ch = maxH * zoom + gap
    const gridH = rows * ch - gap
    const positions = items.map((_, i) => {
      const row = Math.floor(i / cols)
      const inRow = row < rows - 1 ? cols : n - cols * (rows - 1)
      const rowW = inRow * cw - gap
      return {
        x: stage.x + (stage.w - rowW) / 2 + (i % cols) * cw + (maxW * zoom) / 2,
        y: stage.y + (stage.h - gridH) / 2 + row * ch + (maxH * zoom) / 2,
      }
    })
    return { zoom, positions }
  }

  /** Where a product of the short list is now: on its flight, then floating gently. */
  private spotPose(band: Band, s: SpotItem, now: number): Pose {
    const p = s.dur > 0 ? easeInOut(clamp01((now - s.start) / s.dur)) : now >= s.start ? 1 : 0
    let to = s.to
    let scale = s.scale
    if (s.leaving && s.land) {
      const copy = this.copyPose(band, s.land)
      to = copy
      scale = copy.scale
    }
    const settled = s.leaving ? 1 - p : p
    const bob = this.reduce ? 0 : Math.sin(now / 1400 + s.phase) * 3 * settled
    let alpha = 1
    if (s.leaving && !s.land) alpha = 1 - p
    // Once landed, the copy on the field has faded back in under it: hand over, then go.
    if (s.landed) alpha = 1 - clamp01((now - s.start - s.dur) / 260)
    return {
      x: lerp(s.from.x, to.x, p),
      y: lerp(s.from.y, to.y, p) + bob,
      scale: lerp(s.fromScale, scale, p),
      alpha,
    }
  }

  /** The copy of a product on the field closest to a screen point. */
  private nearestCopy(band: Band, item: Item, near: Pt): Copy | null {
    const world = band.world
    const t = this.transformOf(band)
    const wx = (near.x - t.ox) / t.scale
    const wy = (near.y - t.oy) / t.scale
    let best: Copy | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < world.slots.length; index++) {
      const slot = world.slots[index]
      if (!slot || slot.item !== item) continue
      const at = this.placeIn(world, slot)
      const kx = Math.round((wx - at.x) / world.tile.w)
      const ky = Math.round((wy - at.y) / world.tile.h)
      const distance = Math.hypot(at.x + kx * world.tile.w - wx, at.y + ky * world.tile.h - wy)
      if (distance < bestDistance) {
        bestDistance = distance
        best = { slot: index, kx, ky }
      }
    }
    return best
  }

  /** Screen position and scale of one copy on the field. */
  private copyPose(band: Band, copy: Copy) {
    const world = band.world
    const t = this.transformOf(band)
    const slot = world.slots[copy.slot]
    if (!slot) return { x: 0, y: 0, scale: t.scale }
    const at = this.placeIn(world, slot)
    return {
      x: (at.x + copy.kx * world.tile.w) * t.scale + t.ox,
      y: (at.y + copy.ky * world.tile.h) * t.scale + t.oy,
      scale: t.scale,
    }
  }

  /** Where a slot's product sits: its cell centre, nudged as far as its size allows. */
  private placeIn(world: World, slot: Slot): Pt {
    const { sprite } = slot.item
    return {
      x: slot.cx + slot.jx * Math.max(0, world.cell.w - sprite.w) * JITTER,
      y: slot.cy + slot.jy * Math.max(0, world.cell.h - sprite.h) * JITTER,
    }
  }

  // ---- Pointer on the open canvas -------------------------------------------------------------

  /** The product under a screen point, on the open canvas only. */
  pick(p: Pt): Hit | null {
    const band = this.activeBand()
    if (!band) return null
    const world = band.world
    const now = performance.now()
    // The short list sits in front of the field.
    for (let i = world.spot.length - 1; i >= 0; i--) {
      const s = world.spot[i]
      if (!s || s.leaving) continue
      const pose = this.spotPose(band, s, now)
      const { w, h } = s.item.sprite
      if (Math.abs(p.x - pose.x) <= (w * pose.scale) / 2 + 6) {
        if (Math.abs(p.y - pose.y) <= (h * pose.scale) / 2 + 6) {
          return { category: band.category, slug: s.item.slug, spot: true, slot: -1, kx: 0, ky: 0 }
        }
      }
    }
    // Under the short list the field only drifts by, greyed out: it never takes the pointer
    // there, so a gap between two products of the list never opens a sketch's card.
    if (this.overSpot(band, p, now)) return null
    const t = this.transformOf(band)
    const wx = (p.x - t.ox) / t.scale
    const wy = (p.y - t.oy) / t.scale
    const { w: tw, h: th } = world.tile
    let best: Hit | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < world.slots.length; index++) {
      const slot = world.slots[index]
      if (!slot || slot.item.field.to < 1) continue
      const { item } = slot
      const at = this.placeIn(world, slot)
      const kx = Math.round((wx - at.x) / tw)
      const ky = Math.round((wy - at.y) / th)
      const dx = wx - (at.x + kx * tw)
      const dy = wy - (at.y + ky * th)
      if (Math.abs(dx) > item.sprite.w / 2 + 6 || Math.abs(dy) > item.sprite.h / 2 + 6) continue
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        best = { category: band.category, slug: item.slug, spot: false, slot: index, kx, ky }
      }
    }
    return best
  }

  /** Whether a screen point is over the short list, the gaps between its products included. */
  private overSpot(band: Band, p: Pt, now: number) {
    let x0 = Number.POSITIVE_INFINITY
    let y0 = Number.POSITIVE_INFINITY
    let x1 = Number.NEGATIVE_INFINITY
    let y1 = Number.NEGATIVE_INFINITY
    for (const s of band.world.spot) {
      if (s.leaving) continue
      const pose = this.spotPose(band, s, now)
      const hw = (s.item.sprite.w * pose.scale) / 2
      const hh = (s.item.sprite.h * pose.scale) / 2
      x0 = Math.min(x0, pose.x - hw)
      x1 = Math.max(x1, pose.x + hw)
      y0 = Math.min(y0, pose.y - hh)
      y1 = Math.max(y1, pose.y + hh)
    }
    const m = SPOT_MARGIN
    return p.x >= x0 - m && p.x <= x1 + m && p.y >= y0 - m && p.y <= y1 + m
  }

  /** Highlights a product (null: none) and holds the drift while it is looked at. */
  setFocus(hit: Hit | null) {
    if (sameHit(hit, this.focus?.hit ?? null)) return
    this.focus = hit ? { hit, since: performance.now() } : null
    const band = this.activeBand()
    if (!band || this.dragging) return
    gsap.to(band.world, {
      pause: hit ? 0 : 1,
      duration: hit ? 0.45 : 1.1,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  /** Screen box of the focused product, for the popup. */
  focusRect() {
    const focus = this.focus
    const band = focus && this.activeBand()
    if (!focus || !band || band.category !== focus.hit.category) return null
    const world = band.world
    if (focus.hit.spot) {
      const s = world.spot.find((x) => x.item.slug === focus.hit.slug && !x.leaving)
      if (!s) return null
      const pose = this.spotPose(band, s, performance.now())
      const w = s.item.sprite.w * pose.scale
      const h = s.item.sprite.h * pose.scale
      return { x: pose.x - w / 2, y: pose.y - h / 2, w, h }
    }
    const slot = world.slots[focus.hit.slot]
    // A product that just left the field for the short list no longer has its popup here.
    if (!slot || slot.item.slug !== focus.hit.slug || slot.item.field.to < 1) return null
    const pose = this.copyPose(band, focus.hit)
    const w = slot.item.sprite.w * pose.scale
    const h = slot.item.sprite.h * pose.scale
    return { x: pose.x - w / 2, y: pose.y - h / 2, w, h }
  }

  beginDrag() {
    const band = this.activeBand()
    if (!band) return
    this.dragging = true
    band.world.velocity = { x: 0, y: 0 }
    gsap.to(band.world, { pause: 0, duration: 0.25, overwrite: 'auto' })
  }

  /** Moves the canvas with the pointer (or a wheel), in screen px. */
  dragBy(dx: number, dy: number) {
    const band = this.activeBand()
    if (!band) return
    band.world.cam.x -= dx / band.world.zoom
    band.world.cam.y -= dy / band.world.zoom
  }

  /** Lets go with the pointer's velocity, then eases the drift back in. */
  endDrag(vx: number, vy: number) {
    this.dragging = false
    const band = this.activeBand()
    if (!band) return
    band.world.velocity = { x: vx, y: vy }
    gsap.to(band.world, {
      pause: this.focus ? 0 : 1,
      duration: 1.6,
      delay: 0.3,
      ease: 'power2.inOut',
      overwrite: 'auto',
    })
  }

  // ---- Frame ----------------------------------------------------------------------------------

  tick = () => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    for (const band of this.bands) {
      this.step(band, dt)
      this.settleSpot(band, now)
    }
    this.draw(now)
    this.onFrame?.()
  }

  private step(band: Band, dt: number) {
    const world = band.world
    const speed = this.reduce ? 0 : world.speed * world.pause * (1 + 0.5 * band.hover)
    let mx = Math.cos(world.angle) * speed * dt
    let my = Math.sin(world.angle) * speed * dt
    if (!this.dragging) {
      mx += world.velocity.x * dt
      my += world.velocity.y * dt
      const decay = Math.exp(-4 * dt)
      world.velocity.x *= decay
      world.velocity.y *= decay
    }
    // Products move by (mx, my) on screen, so the camera moves the other way in the world.
    world.cam.x -= mx / world.zoom
    world.cam.y -= my / world.zoom
    const anchor = world.anchor
    if (anchor) {
      anchor.world.x -= mx / world.zoom
      anchor.world.y -= my / world.zoom
      world.cam.x = anchor.world.x - (anchor.screen.x - this.vp.w / 2) / world.zoom
      world.cam.y = anchor.world.y - (anchor.screen.y - this.vp.h / 2) / world.zoom
    }
  }

  /** Lands the products flying back to the field, then lets them go. */
  private settleSpot(band: Band, now: number) {
    const world = band.world
    if (!world.spot.length) return
    world.spot = world.spot.filter((s) => {
      if (!s.leaving || now < s.start + s.dur) return true
      if (!s.land) return false
      if (!s.landed) {
        s.landed = true
        aim(s.item.field, 1, now, 240)
      }
      return now < s.start + s.dur + 260
    })
  }

  private draw(now: number) {
    const { ctx, vp, dpr } = this
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vp.w, vp.h)
    const stacked = this.stack.flatMap((c) => this.band(c) ?? [])
    const order = [...this.bands.filter((b) => !stacked.includes(b)), ...stacked]
    // Nothing under a panel that already covers the screen needs drawing.
    let first = 0
    order.forEach((band, i) => {
      if (band.expand >= 1 && band.enter >= 1 && band.ground >= 1) first = i
    })
    for (const band of order.slice(first)) this.drawBand(band, now)
  }

  private drawBand(band: Band, now: number) {
    const { ctx, vp, dpr } = this
    const base = this.quads[band.index]
    if (!base || band.enter <= 0) return
    let quad = band.expand > 0 ? lerpQuad(base, fullQuad(vp), band.expand) : base
    const lift = (1 - band.enter) * 56
    if (lift) quad = quad.map((p) => ({ x: p.x, y: p.y + lift })) as Quad
    const path = new Path2D()
    traceRounded(path, quad, frameOf(vp).radius * (1 - band.expand))
    const t = this.transformOf(band)

    ctx.save()
    if (band.ground > 0) {
      ctx.globalAlpha = band.enter * band.ground
      if (band.expand > 0 && band.expand < 1) {
        // A sheet sliding over the others casts a shadow while it moves.
        ctx.shadowColor = `rgba(20, 20, 20, ${0.2 * Math.sin(Math.PI * band.expand)})`
        ctx.shadowBlur = 64 * dpr
        ctx.shadowOffsetY = 20 * dpr
      }
      ctx.fillStyle = rgb(mix(mix(PANEL, PANEL_HOVER, band.hover), PAPER, band.expand))
      ctx.fill(path)
      ctx.shadowColor = 'transparent'
    }
    ctx.clip(path)
    if (band.ground > 0) this.drawDots(t, quad)
    // Each product sets its own opacity: hand the panel's down explicitly, never read it back.
    this.drawField(band, t, quad, now, band.enter)
    this.drawSpot(band, now, band.enter)
    if (band.veil > 0.001) {
      ctx.globalAlpha = band.enter * band.veil * 0.62
      ctx.fillStyle = rgb(PAPER)
      ctx.fill(path)
    }
    ctx.restore()
  }

  private drawDots(t: Transform, quad: Quad) {
    const pattern = this.dots
    if (!pattern) return
    const b = boundsOf(quad)
    const size = Math.round(DOT_STEP * this.dpr)
    const scale = (t.scale * DOT_STEP) / size
    pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, t.ox, t.oy]))
    this.ctx.fillStyle = pattern
    this.ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)
  }

  private drawField(band: Band, t: Transform, quad: Quad, now: number, bandAlpha: number) {
    const world = band.world
    if (!world.slots.length || world.alpha <= 0) return
    const b = boundsOf(quad)
    const wx0 = (b.x0 - t.ox) / t.scale
    const wx1 = (b.x1 - t.ox) / t.scale
    const wy0 = (b.y0 - t.oy) / t.scale
    const wy1 = (b.y1 - t.oy) / t.scale
    const { w: tw, h: th } = world.tile
    const { w: cw, h: ch } = world.cell
    const alpha = bandAlpha * world.alpha
    const open = this.activeBand() === band
    const focus = open && this.focus && !this.focus.hit.spot ? this.focus : null
    const focusIn = this.focusIn(now)
    // With a short list on show, the podium badges ride on it rather than on the field.
    const ranked = open && !world.spot.some((s) => !s.leaving)

    world.slots.forEach((slot, index) => {
      const { item } = slot
      const field = read(item.field, now)
      if (field <= 0.002) return
      const at = this.placeIn(world, slot)
      const kx0 = Math.ceil((wx0 - cw - at.x) / tw)
      const kx1 = Math.floor((wx1 + cw - at.x) / tw)
      const ky0 = Math.ceil((wy0 - ch - at.y) / th)
      const ky1 = Math.floor((wy1 + ch - at.y) / th)
      for (let kx = kx0; kx <= kx1; kx++) {
        for (let ky = ky0; ky <= ky1; ky++) {
          const sx = (at.x + kx * tw) * t.scale + t.ox
          const sy = (at.y + ky * th) * t.scale + t.oy
          const delay = this.rippleDelay(sx, sy)
          const presence = read(world.presence, now, world.presence.ripple ? delay : 0)
          if (presence <= 0.002) continue
          const focused =
            !!focus && focus.hit.slot === index && focus.hit.kx === kx && focus.hit.ky === ky
          this.drawProduct(
            item,
            sx,
            sy,
            t.scale * (0.9 + 0.1 * presence),
            alpha * field * presence,
            now,
            delay,
            focused ? focusIn : 0,
            ranked,
          )
        }
      }
    })
  }

  private drawSpot(band: Band, now: number, bandAlpha: number) {
    const world = band.world
    if (!world.spot.length || world.alpha <= 0) return
    const alpha = bandAlpha * world.alpha
    const focus = this.activeBand() === band && this.focus?.hit.spot ? this.focus : null
    const focusIn = this.focusIn(now)
    for (const s of world.spot) {
      const pose = this.spotPose(band, s, now)
      const delay = this.rippleDelay(pose.x, pose.y)
      const presence = read(world.presence, now, world.presence.ripple ? delay : 0)
      const focused = !!focus && !s.leaving && focus.hit.slug === s.item.slug
      this.drawProduct(
        s.item,
        pose.x,
        pose.y,
        pose.scale,
        alpha * pose.alpha * presence,
        now,
        0,
        focused ? focusIn : 0,
        !s.leaving,
      )
    }
  }

  private drawProduct(
    item: Item,
    x: number,
    y: number,
    base: number,
    alpha: number,
    now: number,
    delay: number,
    focus: number,
    ranked: boolean,
  ) {
    const { ctx } = this
    const s = item.sprite
    const on = read(item.on, now, item.on.ripple ? delay : 0)
    const faint = read(item.faint, now, item.faint.ripple ? delay : 0)
    const hot = read(item.hot, now)
    const dim = read(item.dim, now)
    const scale = base * (0.88 + 0.12 * on) * (1 + 0.04 * hot) * (1 + 0.05 * focus)
    const dw = (s.w + s.pad * 2) * scale
    const dh = (s.h + s.pad * 2) * scale
    const a = alpha * (1 - 0.5 * dim)
    if (a <= 0.002) return
    if (on < 0.999) {
      ctx.globalAlpha = a * (1 - on) * faint
      ctx.drawImage(s.ghost, x - dw / 2, y - dh / 2, dw, dh)
    }
    if (on > 0.001) {
      ctx.globalAlpha = a * on
      ctx.drawImage(s.color, x - dw / 2, y - dh / 2, dw, dh)
    }
    const w = s.w * scale
    const h = s.h * scale
    if (hot > 0.01) this.drawRing(x, y, w, h, a * hot * Math.max(on, faint))
    if (ranked && item.rank != null && item.rank < 3 && on > 0.5) {
      this.drawRank(item.rank, item.score, x, y, w, h, a * on)
    }
    if (focus > 0) this.drawBrackets(x, y, w, h, a * focus)
  }

  private drawRing(cx: number, cy: number, w: number, h: number, alpha: number) {
    const { ctx } = this
    const pad = 10
    ctx.globalAlpha = alpha
    ctx.strokeStyle = SIGNAL
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(cx - w / 2 - pad, cy - h / 2 - pad, w + pad * 2, h + pad * 2, radii.card)
    ctx.stroke()
  }

  /** The podium's rank medal above a product, and its match beside it. */
  private drawRank(
    rank: number,
    score: number | null,
    cx: number,
    cy: number,
    w: number,
    h: number,
    alpha: number,
  ) {
    const { ctx } = this
    const label = String(rank + 1)
    const x = cx - w / 2
    const y = cy - h / 2 - 15
    const size = 18
    ctx.globalAlpha = alpha
    ctx.font = `500 10px ${MONO}`
    const pill = Math.max(size, ctx.measureText(label).width + 10)
    ctx.fillStyle = rank === 0 ? SIGNAL : INK
    ctx.beginPath()
    ctx.roundRect(x, y - size / 2, pill, size, size / 2)
    ctx.fill()
    ctx.fillStyle = rank === 0 ? '#FFFFFF' : rgb(PAPER)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + pill / 2, y + 0.5)
    if (score != null) {
      ctx.textAlign = 'left'
      ctx.fillStyle = INK_MUTED
      ctx.font = `500 11px ${MONO}`
      ctx.fillText(`${Math.round(score * 100)} %`, x + pill + 6, y + 0.5)
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  /** Corner marks around the product under the pointer, like a viewfinder. */
  private drawBrackets(cx: number, cy: number, w: number, h: number, alpha: number) {
    const { ctx } = this
    const pad = 12
    const arm = 10
    const x0 = cx - w / 2 - pad
    const x1 = cx + w / 2 + pad
    const y0 = cy - h / 2 - pad
    const y1 = cy + h / 2 + pad
    ctx.globalAlpha = alpha
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(x0, y0 + arm)
    ctx.lineTo(x0, y0)
    ctx.lineTo(x0 + arm, y0)
    ctx.moveTo(x1 - arm, y0)
    ctx.lineTo(x1, y0)
    ctx.lineTo(x1, y0 + arm)
    ctx.moveTo(x1, y1 - arm)
    ctx.lineTo(x1, y1)
    ctx.lineTo(x1 - arm, y1)
    ctx.moveTo(x0 + arm, y1)
    ctx.lineTo(x0, y1)
    ctx.lineTo(x0, y1 - arm)
    ctx.stroke()
  }

  // ---- Helpers --------------------------------------------------------------------------------

  private band(category: Category) {
    return this.bands.find((b) => b.category === category)
  }

  /** The panel that fills the screen on a category page, once it has finished opening. */
  private activeBand() {
    if (this.target.mode !== 'canvas') return null
    const band = this.band(this.target.category)
    return band && band.expand >= 0.999 ? band : null
  }

  private isOpen(band: Band) {
    return this.target.mode === 'canvas' && this.target.category === band.category
  }

  private focusIn(now: number) {
    return this.focus ? easeOut(Math.min(1, (now - this.focus.since) / 240)) : 0
  }

  private zoomFor(band: Band) {
    if (this.isOpen(band)) return this.zoomForCanvas()
    return isCompact(this.vp) ? ZOOM.bandCompact : ZOOM.band
  }

  private zoomForCanvas() {
    return isCompact(this.vp) ? ZOOM.canvasCompact : ZOOM.canvas
  }

  /** Along the panel, downwards: the direction of its tilted dividers. */
  private angleFor(band: Band) {
    return this.isOpen(band) ? CANVAS_ANGLE : Math.PI / 2 + tiltFor(this.vp, this.bands.length)
  }

  /** A panel back at rest: home zoom, drifting along its tilt, every product on its field. */
  private rest(band: Band) {
    const world = band.world
    gsap.killTweensOf(world, MOTION)
    Object.assign(world, {
      zoom: this.zoomFor(band),
      angle: this.angleFor(band),
      speed: this.isOpen(band) ? SPEED.canvas : SPEED.band,
      pause: 1,
      anchor: null,
      velocity: { x: 0, y: 0 },
      presence: channel(1),
      spot: [],
    })
    const now = performance.now()
    for (const item of world.items) aim(item.field, 1, now, 0)
  }

  /** World → screen: the camera, then the hover zoom around the panel's centre. */
  private transformOf(band: Band): Transform {
    const world = band.world
    const cx = this.vp.w / 2
    const cy = this.vp.h / 2
    const k = 1 + HOVER_ZOOM * band.hover
    const pivot = centroid(this.quads[band.index] ?? fullQuad(this.vp))
    return {
      scale: world.zoom * k,
      ox: pivot.x + (cx - world.cam.x * world.zoom - pivot.x) * k,
      oy: pivot.y + (cy - world.cam.y * world.zoom - pivot.y) * k,
    }
  }

  private toWorld(band: Band, p: Pt): Pt {
    const t = this.transformOf(band)
    return { x: (p.x - t.ox) / t.scale, y: (p.y - t.oy) / t.scale }
  }

  /** Bakes the hover zoom into the camera, so a panel can open without a jump. */
  private foldHover(band: Band) {
    if (!band.hover) return
    const t = this.transformOf(band)
    band.world.zoom = t.scale
    band.world.cam = { x: (this.vp.w / 2 - t.ox) / t.scale, y: (this.vp.h / 2 - t.oy) / t.scale }
    band.hover = 0
  }

  private rippleDelay(x: number, y: number) {
    return Math.min(420, Math.hypot(x - this.ripple.x, y - this.ripple.y) * 0.3)
  }

  private makeDots() {
    const size = Math.round(DOT_STEP * this.dpr)
    const tile = document.createElement('canvas')
    tile.width = size
    tile.height = size
    const c = tile.getContext('2d')
    if (!c) return null
    c.fillStyle = '#CFCBC2'
    c.beginPath()
    c.arc(size / 2, size / 2, 1.15 * this.dpr, 0, Math.PI * 2)
    c.fill()
    return this.ctx.createPattern(tile, 'repeat')
  }
}
