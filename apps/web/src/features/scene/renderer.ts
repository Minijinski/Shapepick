import type { Category } from '@choose/catalog'
import { radii } from '~/styles/radii'
import { gsap } from '../motion/gsap'
import {
  bandQuads,
  bandsInRows,
  boundsOf,
  centroid,
  frameOf,
  fullQuad,
  hash01,
  insideQuad,
  isCompact,
  lerpQuad,
  type Pt,
  type Quad,
  tileLayout,
  tiltFor,
  topVeil,
  traceRounded,
  type Viewport,
} from './geometry'
import type { Drawings, Shape, Sprite } from './sprites'
import { frame, mark } from './stats'

// The scene behind every page of a locale, drawn on one canvas. On the home page it is one tilted
// panel per category, each a window onto that category's world drifting along the panel. On a
// category page the chosen panel has grown over the others into the whole screen, and its world
// is the canvas the visitor browses. Both are the same drawing with different numbers, which is
// why going from one to the other cannot flicker.
//
// The canvas shows the products the answers keep, repeated in a tile: an answer that rules some
// out makes them fade away and the others close ranks, so the field is never left with holes.
// Once only a short list is left, those products leave the field and gather in front of it, each
// shown once. Products are laid out from their shape alone and drawn from bitmaps shared by every
// product drawn alike, made when the canvas first needs them.

export type SceneTarget = { mode: 'bands' } | { mode: 'canvas'; category: Category }

/** What the finder wants each product of its category to look like. */
export type ItemTargets = {
  /** The products the answers keep; null while nothing filters (the whole catalogue). */
  kept: Set<string> | null
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
  // A mouse seen from above stands upright: a tall cell, roomy enough that small mice never crowd.
  mouse: { w: 320, h: 390 },
}
/**
 * How far a product may stray from its cell centre, as a share of the room it leaves. Mice stray
 * less: two neighbours never come close, whichever way each one strays.
 */
const JITTER: Record<Category, number> = { keyboard: 0.3, monitor: 0.3, mouse: 0.22 }
/** A small catalogue is laid out more than once per tile, so its repetition is far apart. */
const MIN_SLOTS = 50
const ZOOM = { band: 0.5, canvas: 1, bandCompact: 0.4, bandRows: 0.42, canvasCompact: 0.56 }
/** On-screen drift in px/s: along the panel on the home page, a calmer diagonal on the canvas. */
const SPEED = { band: 36, canvas: 18 }
/** Direction products travel on the canvas: from the top-right corner towards the bottom-left. */
const CANVAS_ANGLE = (145 * Math.PI) / 180
const HOVER_ZOOM = 0.07
/** How much a product the hovered option keeps grows: a breath, its ring stays put. */
const HOT_LIFT = 0.015
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
/** The rank badge: its height, and how far in from the product's left edge it starts (screen px). */
const BADGE = { h: 18, inset: 8 }
/** Room left between the badge and the ring it interrupts. */
const BADGE_GAP = 5
/**
 * The field regrouping after an answer (ms): it waits for the answers to settle (a budget slider
 * sends one per notch), the products ruled out fade where they are, then the kept ones glide to
 * their new places while the newcomers fade in, all in a wave from the console.
 */
const REGROUP = {
  settle: 160,
  leave: 360,
  glideAfter: 140,
  glide: 760,
  enterAfter: 260,
  enter: 420,
}
/** A drawing (or a plate standing in for it) fading in once its bitmap exists. */
const APPEAR_MS = 280
/**
 * Where a product on the field takes the pointer (screen px): half of it (`share`) clear of the
 * screen’s edges and of the paper fading under the header (the finder's top gradient is still
 * about half opaque at `veil` of its height, `topVeil`; on a phone down to `topCompact`). The
 * widgets, the counter among them, are left out on their own (`keepClear`). One showing less than
 * that is only a glimpse.
 */
const PICK = { veil: 0.5, topCompact: 118, side: 8, bottom: 8, share: 0.5 }
/** How far ahead (s) the canvas looks for products coming into view, along its motion. */
const AHEAD_S = 0.9
/**
 * A world that has just come on screen forms its short list as an arrival (ms; a visit’s first
 * page waits under the preloader, so longer): finalists held on an opening panel glide to their
 * places, the others appear in them. The page says where the short list goes a moment after the
 * scene starts moving (later when its code has to load): the finalists wait for it, and go back to
 * the field when the page says it has no room, or if it never says anything.
 */
const ARRIVAL_MS = { open: 1800, swap: 1800, intro: 3200 }
const STAGE_WAIT_MS = 3000
const ARRIVE = { glide: 820, stagger: 35, appear: 560, rise: 16, morph: 380 }

/**
 * A finalist held on an opening panel (world px): one of its own copies there, or, when none is
 * in sight (a large catalogue), a product near the click it takes the place of, fading in as that
 * one fades out (`since`: when).
 */
type HeldCopy = Pt & { since?: number }

const PAPER = [243, 241, 236] as const
const PANEL = [234, 231, 224] as const
const PANEL_HOVER = [248, 247, 244] as const
const SIGNAL = '#FF5A1F'
const INK = '#141414'
const INK_MUTED = '#625E56'
/** The plate a product shows while its drawing is on its way: a faint print of its shape. */
const PLATE = 'rgba(20, 20, 20, 0.055)'
const MONO = '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace'

/** Device px per world px the sprites need: the pixel ratio times the largest zoom drawn. */
export const spriteResolution = (vp: Viewport, dpr: number) =>
  dpr *
  (isCompact(vp)
    ? Math.max(ZOOM.canvasCompact, SPOT_ZOOM.maxCompact)
    : Math.max(ZOOM.canvas, SPOT_ZOOM.max))

// ==== Animation channels =======================================================================

// Products change state in bulk (an answer can rule out half the canvas), so they are not GSAP
// tweens: each channel stores where it comes from, where it goes and when it started, and the
// drawing reads it. Changes that ripple across the canvas start late by their distance from the
// console instead.

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

/** One product: its shape, bitmaps and state, shared by every place it has in the tile. */
type Item = {
  slug: string
  /** Size of its drawing in world px, known from its specs before any bitmap exists. */
  w: number
  h: number
  /** Its drawing, shared with every product drawn alike. */
  key: string
  /** Its photo, cut out, once the canvas has it: drawn in place of the drawing. */
  photo: Sprite | null
  /** The bitmap shown before the current one, faded out over `swap` (0 → 1). */
  previous: Sprite | null
  swap: Channel
  /** 1 kept by the option under the pointer. */
  hot: Channel
  /** 1 while another option is previewed. */
  dim: Channel
  /** The field copies: shown (1), or handed over to the short list (0). */
  field: Channel
  /** Position among the kept products, best first; null for a lone one. */
  rank: number | null
  /** Its match (0 … 1) while it is kept. */
  score: number | null
}

/** A place in the tile: a cell centre and a -1..1 jitter scaled by the room its product leaves. */
type Slot = { cx: number; cy: number; jx: number; jy: number; item: Item }

/** One copy on the field: a slot of the tile and which repetition of the tile. */
type Copy = { slot: number; kx: number; ky: number }

/** A copy of the field gliding from where it was to its place in a new tile (world px). */
type Glide = Copy & { fromX: number; fromY: number; start: number; dur: number }

/** A copy of a product an answer ruled out, fading where it was (world px). */
type Leaver = { item: Item; x: number; y: number; alpha: number; start: number; dur: number }

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
  /**
   * Waiting for its place, while the page has not said where the short list gathers: held where
   * it was on the field (world px), following the camera, or hidden until it appears in place.
   */
  wait: Pt | 'hidden' | null
  /** Coming in where it belongs, fading in as it rises, rather than flying from the field. */
  appear: boolean
}

type Pose = { x: number; y: number; scale: number; alpha: number }

/** A rank badge laid out above its product: the pill from `x` to `x + pill`, its text to `right`. */
type Badge = {
  rank: number
  label: string
  match: string | null
  x: number
  y: number
  pill: number
  right: number
}

const copyKey = (c: Copy) => `${c.slot}:${c.kx}:${c.ky}`

/** How a product was drawn: its largest scale, and its nearest place to the middle of the screen. */
export type Drawn = { scale: number; distance: number }

/** A product near the open canvas, about to come into view: its photo is worth fetching now. */
export type Near = { category: Category; slug: string; scale: number; distance: number }

/** Notes that a product was drawn at `scale`, `distance` px from the middle of the screen. */
const seen = (drawn: Map<string, Drawn>, slug: string, scale: number, distance: number) => {
  const known = drawn.get(slug)
  if (!known) {
    drawn.set(slug, { scale, distance })
    return
  }
  if (known.scale < scale) known.scale = scale
  if (known.distance > distance) known.distance = distance
}

class World {
  items: Item[] = []
  slots: Slot[] = []
  bySlug = new Map<string, Item>()
  /** The products laid out in the tile (null: all of them). */
  kept: Set<string> | null = null
  /** A new set of products waiting to be laid out (the answers may still be changing). */
  pending: { kept: Set<string> | null; order: string[] | null; at: number } | null = null
  /** The regrouping under way: copies gliding to the new tile, copies fading out. */
  glides = new Map<string, Glide>()
  leaving: Leaver[] = []
  /** When the current tile started fading in (copies that do not glide); -1 once shown. */
  entered = -1
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
  /** Fades the products in once they are laid out. */
  alpha = 0
  /** Fades a whole category out and in when the visitor switches categories. */
  presence = channel(1)
  /** Fling after a drag, screen px/s. */
  velocity: Pt = { x: 0, y: 0 }
  /** During a zoom, the world point that stays under a screen point (the click). */
  anchor: { screen: Pt; world: Pt } | null = null
  spot: SpotItem[] = []
  /** When and how this world last came on screen: a panel opening, a category swapped in, a visit. */
  arrival: { at: number; kind: 'open' | 'swap' | 'intro' } | null = null
  /** A short list waiting to learn where it gathers, until the page says (or this time passes). */
  awaiting: { until: number } | null = null

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
  /**
   * Its world moves with the page as the home's rows scroll. Off once the panel has opened into
   * the canvas: the scroll is then part of its camera.
   */
  scrolls: boolean
}

type Transform = { scale: number; ox: number; oy: number }

const mix = (a: readonly number[], b: readonly number[], t: number) =>
  a.map((v, i) => Math.round(v + ((b[i] ?? v) - v) * t))
const rgb = (c: readonly number[]) => `rgb(${c.join(',')})`

/** Two kept sets lay out the same products (null: all `total` of them). */
function sameKept(a: Set<string> | null, b: Set<string> | null, total: number) {
  if (a === b) return true
  if ((a?.size ?? total) !== (b?.size ?? total)) return false
  if (!a || !b) return true
  for (const slug of a) if (!b.has(slug)) return false
  return true
}

// ==== Renderer =================================================================================

export class SceneRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private vp: Viewport = { w: 1, h: 1 }
  /**
   * How tall the canvas paints (px): the largest viewport, taller than the layout's on a phone
   * whose toolbar can fold away, so the canvas never has to be resized as it does.
   */
  private paintH = 1
  private dpr = 1
  /** The home's panels are rows, in page px, that move as the page scrolls (a phone). */
  private rows = false
  /** How far the home page is scrolled (px): read every frame while the home shows its rows. */
  private scroll = 0
  /** The home page's layer (its title, links and labels), moved with the rows in the same frame. */
  private homeLayer: HTMLElement | null = null
  private quads: Quad[] = []
  private readonly bands: Band[]
  /** Panels grown over the others, last on top. */
  private stack: Category[] = []
  private target: SceneTarget = { mode: 'bands' }
  private readonly targets = new Map<Category, ItemTargets | null>()
  private stage: Rect | null = null
  /** Off while the finder's results cover the canvas: the products then take no pointer. */
  private pickable = true
  /** Under a product's sheet (its veil and blur over the canvas): one frame in two is drawn. */
  private veiled = false
  private skipped = false
  private dots: CanvasPattern | null = null
  private focus: { hit: Hit; since: number } | null = null
  private dragging = false
  private ripple: Pt = { x: 0, y: 0 }
  private last = performance.now()
  /**
   * Products drawn since `takeDrawn` last ran, by category, with the largest scale each was drawn
   * at (screen px per world px) and how near the middle of the screen: the photos worth fetching,
   * how sharp, and which first.
   */
  private drawn = new Map<Category, Map<string, Drawn>>()
  /** Pointer moves since the last frame, and the drag's speed they make (screen px/s). */
  private push: Pt = { x: 0, y: 0 }
  private dragVelocity: Pt = { x: 0, y: 0 }
  /** Plates drawn this frame (products whose drawing is not ready yet), for the stats. */
  private plates = 0
  private products = 0
  /** Products whose middle is on screen this frame, and how many of them show their photo. */
  private onScreen = 0
  private onScreenPhotos = 0
  /** The last frame’s counts, for the stats. */
  private lastFrame = { products: 0, plates: 0, onScreen: 0, onScreenPhotos: 0 }
  private readonly reduce: boolean
  /** Called after every frame, for overlays that follow a product (the popup). */
  onFrame: (() => void) | null = null
  /**
   * Called when the scene lets go of the product it highlighted on its own (the field regrouping
   * after an answer, the results covering the canvas): its popup goes with it.
   */
  onFocusLost: (() => void) | null = null
  /**
   * The page's widgets on screen (the console, the podium, the journey, the counter): a product
   * mostly under them is out of sight, as one at the screen's edges is.
   */
  keepClear: (() => readonly Rect[]) | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    categories: readonly Category[],
    private readonly drawings: Drawings,
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
      scrolls: true,
    }))
  }

  // ---- Setup ----------------------------------------------------------------------------------

  get viewport() {
    return this.vp
  }

  /**
   * The layout viewport (`w` × `h`), and how tall the canvas paints (`paintH`, at least `h`). A
   * resize that changes nothing (a phone's toolbar folding away) leaves the canvas alone: resetting
   * its size would clear it for a frame.
   */
  resize(w: number, h: number, dpr: number, paintH = h) {
    const paint = Math.max(h, paintH)
    if (w === this.vp.w && h === this.vp.h && dpr === this.dpr && paint === this.paintH) return
    this.vp = { w, h }
    this.paintH = paint
    this.dpr = dpr
    this.rows = bandsInRows(this.vp)
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(paint * dpr)
    this.quads = bandQuads(this.vp, this.bands.length)
    this.dots = this.makeDots()
    this.ripple = { x: w / 2, y: h * 0.8 }
    for (const band of this.bands) {
      if (gsap.isTweening(band.world)) continue
      band.world.zoom = this.zoomFor(band)
      band.world.angle = this.angleFor(band)
    }
  }

  /**
   * The home page's layer of title, links and labels (null: gone). While the home shows its rows,
   * the scene reads the page's scroll once per frame and moves the rows and this layer by it in the
   * same frame, so a label never lags behind its row, even during a fling.
   */
  setHomeLayer(layer: HTMLElement | null) {
    this.homeLayer = layer
    this.applyScroll()
  }

  /** How far the home page was scrolled when the scene last followed it (px): it comes back there. */
  get homeScroll() {
    return this.scroll
  }

  /** A category's products, from their shapes: laid out at once, drawn as their bitmaps come. */
  setItems(category: Category, shapes: Shape[]) {
    const band = this.band(category)
    if (!band) return
    const world = band.world
    world.items = shapes.map((shape) => ({
      slug: shape.slug,
      w: shape.w,
      h: shape.h,
      key: shape.key,
      photo: null,
      previous: null,
      swap: channel(1),
      hot: channel(0),
      dim: channel(0),
      field: channel(1),
      rank: null,
      score: null,
    }))
    world.bySlug = new Map(world.items.map((item) => [item.slug, item]))
    world.cell = CELL[category]
    world.kept = null
    world.slots = []
    world.spot = []
    this.layOut(band, this.targets.get(category)?.kept ?? null)
    this.applyTargets(band, this.targets.get(category) ?? null, false)
    gsap.to(world, { alpha: 1, duration: this.reduce ? 0 : 0.9, ease: 'power2.out' })
    mark(`items-${category}`)
  }

  /** The products drawn (on screen or about to be) since the last call, by category. */
  takeDrawn() {
    const drawn = this.drawn
    this.drawn = new Map()
    return drawn
  }

  /**
   * Products of the open canvas about to come into view: within `reach` screens of it (a share of
   * its larger side), further where the canvas is heading (its drift, a drag, a fling), nearest
   * first and each once, with the scale they will be drawn at. Their photos are worth fetching
   * before they show. None while a short list hides the field.
   */
  around(reach = 0.8, limit = 48): Near[] {
    const band = this.activeBand()
    const world = band?.world
    if (!band || !world?.slots.length || world.spot.some((s) => !s.leaving)) return []
    const t = this.transformOf(band)
    const { w: vw, h: vh } = this.vp
    const margin = Math.max(vw, vh) * reach
    // Products move by the drift and the drag on screen: the ones to come are on the other side.
    const drift = this.reduce ? 0 : world.speed * world.pause
    const moving = this.dragging ? this.dragVelocity : world.velocity
    const lead = {
      x: Math.max(-vw, Math.min(vw, -(Math.cos(world.angle) * drift + moving.x) * AHEAD_S)),
      y: Math.max(-vh, Math.min(vh, -(Math.sin(world.angle) * drift + moving.y) * AHEAD_S)),
    }
    const x0 = -margin + Math.min(0, lead.x)
    const x1 = vw + margin + Math.max(0, lead.x)
    const y0 = -margin + Math.min(0, lead.y)
    const y1 = vh + margin + Math.max(0, lead.y)
    // Nearest to where the screen is heading, rather than to where it is.
    const cx = vw / 2 + lead.x / 2
    const cy = vh / 2 + lead.y / 2
    const { w: tw, h: th } = world.tile
    const best = new Map<string, number>()
    world.slots.forEach((slot) => {
      if (slot.item.field.to < 1) return
      const at = this.placeIn(world, slot)
      const kx0 = Math.ceil(((x0 - t.ox) / t.scale - at.x) / tw)
      const kx1 = Math.floor(((x1 - t.ox) / t.scale - at.x) / tw)
      const ky0 = Math.ceil(((y0 - t.oy) / t.scale - at.y) / th)
      const ky1 = Math.floor(((y1 - t.oy) / t.scale - at.y) / th)
      for (let kx = kx0; kx <= kx1; kx++) {
        for (let ky = ky0; ky <= ky1; ky++) {
          const sx = (at.x + kx * tw) * t.scale + t.ox
          const sy = (at.y + ky * th) * t.scale + t.oy
          const d = Math.hypot(sx - cx, sy - cy)
          if (d < (best.get(slot.item.slug) ?? Number.POSITIVE_INFINITY))
            best.set(slot.item.slug, d)
        }
      }
    })
    return [...best]
      .sort((a, b) => a[1] - b[1])
      .slice(0, limit)
      .map(([slug, distance]) => ({ category: band.category, slug, scale: t.scale, distance }))
  }

  /**
   * Gives a product its photo (null: back to its drawing), crossfading on screen; without `fade`
   * (a photo let go out of sight), at once, keeping no hold on the old bitmap.
   */
  setPhoto(category: Category, slug: string, photo: Sprite | null, fade = true) {
    const item = this.band(category)?.world.bySlug.get(slug)
    if (!item || item.photo === photo) return
    if (!fade) {
      item.photo = photo
      item.previous = null
      item.swap = channel(1)
      return
    }
    item.previous = item.photo ?? this.drawings.get(item.key)?.sprite ?? null
    item.photo = photo
    item.swap = channel(0)
    aim(item.swap, 1, performance.now(), this.reduce ? 0 : 600)
  }

  /**
   * The products the scene shows once it has made its entrance (the home page's panels, or the
   * open canvas and its short list), with the scale each is drawn at: what the preloader waits
   * for. Read from the panels' resting places, so it holds while the entrance has not started.
   */
  firstScreen() {
    const out = new Map<string, { category: Category; slug: string; key: string; scale: number }>()
    const add = (category: Category, item: Item, scale: number) => {
      const id = `${category}:${item.slug}`
      const known = out.get(id)
      if (!known || known.scale < scale)
        out.set(id, { category, slug: item.slug, key: item.key, scale })
    }
    for (const band of this.bands) {
      const base = this.slotOf(band)
      if (!base || (this.target.mode === 'canvas' && !this.isOpen(band))) continue
      const world = band.world
      for (const s of world.spot) if (!s.leaving) add(band.category, s.item, s.scale)
      if (!world.slots.length || world.spot.some((s) => !s.leaving)) continue
      const b = boundsOf(this.target.mode === 'canvas' ? this.full() : base)
      // A row further down the page is not on the first screen: the preloader does not wait for it.
      if (b.y0 >= this.vp.h || b.y1 <= 0) continue
      const t = this.transformOf(band)
      const { w: tw, h: th } = world.tile
      world.slots.forEach((slot) => {
        const at = this.placeIn(world, slot)
        const half = { w: slot.item.w / 2, h: slot.item.h / 2 }
        const kx0 = Math.ceil(((b.x0 - t.ox) / t.scale - half.w - at.x) / tw)
        const kx1 = Math.floor(((b.x1 - t.ox) / t.scale + half.w - at.x) / tw)
        const ky0 = Math.ceil(((b.y0 - t.oy) / t.scale - half.h - at.y) / th)
        const ky1 = Math.floor(((b.y1 - t.oy) / t.scale + half.h - at.y) / th)
        if (kx0 <= kx1 && ky0 <= ky1) add(band.category, slot.item, t.scale)
      })
    }
    return [...out.values()]
  }

  /** What the scene holds, for `__scene.stats()`. */
  stats() {
    let photos = 0
    let photoBytes = 0
    const categories: Record<string, unknown> = {}
    for (const band of this.bands) {
      const world = band.world
      for (const item of world.items) {
        if (!item.photo) continue
        photos++
        photoBytes += item.photo.bytes
      }
      categories[band.category] = {
        items: world.items.length,
        laidOut: world.kept?.size ?? world.items.length,
        slots: world.slots.length,
        spot: world.spot.length,
        // A regrouping under way: copies gliding, copies fading out, answers waiting to settle.
        glides: world.glides.size,
        leaving: world.leaving.length,
        pending: !!world.pending,
        // A short list waiting to learn where it gathers, and its finalists waiting meanwhile.
        awaiting: !!world.awaiting,
        waiting: world.spot.filter((s) => s.wait).length,
        // Finalists flying back to the field (the short list grew too long, or broke up).
        returning: world.spot.filter((s) => s.leaving && s.land).length,
      }
    }
    const drawings = this.drawings.stats
    return {
      categories,
      drawings,
      photos: { count: photos, bytes: photoBytes },
      bitmapMB: Math.round(((drawings.bytes + photoBytes) / 1e6) * 10) / 10,
      frame: this.lastFrame,
    }
  }

  dispose() {
    for (const band of this.bands) gsap.killTweensOf([band, band.world])
    this.onFrame = null
    this.onFocusLost = null
  }

  // ---- Where the scene is going ---------------------------------------------------------------

  /** Moves the scene to a target and returns the seconds until it settles. */
  go(target: SceneTarget, { focal, intro = false }: { focal?: Pt; intro?: boolean } = {}) {
    const from = this.target
    this.target = target
    this.focus = null
    // The free space belongs to the page that measured it: the next page measures its own. A short
    // list on screen is left as it is and goes with its canvas. (A visit's first page may measure
    // before the scene starts: its free space stays.)
    if (!intro) this.stage = null
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
    // A canvas from the start: its world has no page to move with.
    band.scrolls = false
    if (!this.reduce) {
      gsap.from(band.world, { zoom: band.world.zoom * 1.08, duration: 1.6, ease: 'expo.out' })
    }
    // A visit that starts on a category with a short list shows it in place from the first frame.
    const now = performance.now()
    band.world.arrival = { at: now, kind: 'intro' }
    const targets = this.targets.get(category)
    this.updateSpot(band, targets?.kept ? targets.order : null, now, true)
    return this.reduce ? 0 : 0.35
  }

  /** The clicked panel grows over the others while its world zooms in around the click. */
  private open(category: Category, focal: Pt | undefined) {
    const band = this.band(category)
    const base = band && this.slotOf(band)
    if (!band || !base) return 0
    const world = band.world
    const below = this.stack.filter((c) => c !== category)
    this.stack = [...below, category]
    gsap.killTweensOf(world, MOTION)
    this.foldHover(band)
    Object.assign(band, { enter: 1, veil: 0, ground: 1 })
    const point = focal ?? centroid(base)
    world.anchor = { screen: point, world: this.toWorld(band, point) }
    world.arrival = { at: performance.now(), kind: 'open' }
    // Answers given on an earlier visit change the field from the click on, in a wave from it.
    this.ripple = point
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
    // Its row where the home was left: the page comes back to that scroll (scene.homeScroll).
    const base = band && this.slotOf(band)
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
      // Back in its row: its world moves with the page again.
      this.unfoldScroll(band)
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
    const pending = band.world.pending
    band.world.pending = null
    if (pending) this.layOut(band, pending.kept)
    Object.assign(band, { enter: 1, expand: 1, hover: 0, veil: 0, ground: 0, scrolls: false })
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
      awaiting: null,
      arrival: { at: now, kind: 'swap' },
      leaving: [],
      entered: -1,
    })
    band.world.glides.clear()
    for (const item of band.world.items) aim(item.field, 1, now, 0)
    this.stack = [from, to]
    const settle = () => {
      this.stack = [to]
      band.ground = 1
      Object.assign(old, { expand: 0, veil: 0, hover: 0, enter: 1, ground: 1 })
      this.rest(old)
      // Out of sight now, the old canvas lets its short list go.
      this.clearSpot(old)
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
    // A page with no room for a short list (its results cover the canvas) lets the finalists
    // waiting for one go back to the field at once.
    if (!stage && this.target.mode === 'canvas') {
      const band = this.band(this.target.category)
      if (band?.world.awaiting) this.releaseSpot(band, performance.now())
    }
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
    if (band && !band.world.pending) {
      this.updateSpot(band, t?.kept ? t.order : null, performance.now(), true)
    }
  }

  private applyTargets(band: Band, t: ItemTargets | null, animate: boolean) {
    const world = band.world
    if (!world.items.length) return
    const now = performance.now()
    const fast = animate ? 240 : 0
    // A lone product has no rank to show: its badge would follow it on every copy of the field.
    const rankOf = new Map(t && t.order.length > 1 ? t.order.map((slug, i) => [slug, i]) : [])
    for (const item of world.items) {
      const hot = !!t?.hot?.has(item.slug)
      aim(item.hot, hot ? 1 : 0, now, fast)
      aim(item.dim, t?.hot && !hot ? 1 : 0, now, fast)
      item.rank = rankOf.get(item.slug) ?? null
      item.score = item.rank != null ? (t?.scores?.[item.rank] ?? null) : null
    }
    const kept = t?.kept ?? null
    const order = kept ? (t?.order ?? null) : null
    if (sameKept(kept, world.kept, world.items.length)) {
      // Back to what is laid out (an answer undone before the field moved): nothing to regroup.
      world.pending = null
      this.updateSpot(band, order, now, animate)
      return
    }
    const mode = animate ? this.regroups(band, now) : 'cut'
    if (mode !== 'cut' && !this.arriving(band, now)) {
      // The answers may still be moving (a slider, several picks): the field waits for them.
      world.pending = { kept, order, at: now + REGROUP.settle }
      return
    }
    world.pending = null
    if (mode === 'cut') {
      this.layOut(band, kept)
      this.updateSpot(band, order, now, false)
      return
    }
    // Arriving with answers given on an earlier visit (a panel opening onto them): the field
    // changes at once, in a wave from the click, and its finalists stay where they are, ready to
    // gather in the short list.
    const { at, held } = this.regroup(band, kept, new Set(this.spotWanted(band, order)), now, true)
    this.updateSpot(band, order, now, true, at, held)
  }

  /** Whether a world has just come on screen, and forms its short list as an arrival. */
  private arriving(band: Band, now: number) {
    const arrival = band.world.arrival
    return !!arrival && now - arrival.at < ARRIVAL_MS[arrival.kind]
  }

  /**
   * How the field of a band moves to a new set of products: the open canvas glides, a panel in
   * sight (opening, closing, the home page) crossfades, one out of sight just changes.
   */
  private regroups(band: Band, now: number): 'glide' | 'fade' | 'cut' {
    if (this.reduce || band.enter <= 0) return 'cut'
    const presence = band.world.presence
    // A category swapped in whose products have not begun to show: nothing to see change.
    if (presence.dur > 0 && presence.to === 1 && now < presence.start) return 'cut'
    const arriving = presence.dur > 0 && now < presence.start + presence.dur + 420
    if (this.activeBand() === band && !arriving) return 'glide'
    const inSight =
      this.target.mode === 'bands' || this.isOpen(band) || this.stack.includes(band.category)
    return inSight ? 'fade' : 'cut'
  }

  /** Lays the products `kept` (null: all) out in the tile, at once. */
  private layOut(band: Band, kept: Set<string> | null) {
    const world = band.world
    const items = kept ? world.items.filter((item) => kept.has(item.slug)) : world.items
    const copies = Math.max(1, Math.ceil(MIN_SLOTS / Math.max(items.length, 1)))
    const layout = tileLayout(
      items.map((item) => item.slug),
      CELL[band.category],
      copies,
    )
    world.tile = { w: layout.w, h: layout.h }
    world.slots = layout.cells.flatMap((c) => {
      const item = world.bySlug.get(c.id)
      return item ? [{ cx: c.cx, cy: c.cy, jx: c.jx, jy: c.jy, item }] : []
    })
    world.kept = kept
    world.glides.clear()
    world.leaving = []
    world.entered = -1
  }

  /**
   * The field takes a new set of products. On the open canvas, the copies on screen of products
   * still kept glide to their nearest place in the new tile; the others fade where they are; the
   * new tile's other copies fade in, all in a wave from the console. Products about to join the
   * short list (`spot`) leave their copies behind: the short list takes off from where they were.
   * With `hold` (a panel opening onto a short list whose place is not known yet), one copy of each
   * of them, the one nearest the click on the panel, stays where it is instead of fading.
   * Returns where each product was on screen (`at`), and the copies held (`held`, world px).
   */
  private regroup(
    band: Band,
    kept: Set<string> | null,
    spot: Set<string>,
    now: number,
    hold = false,
  ) {
    const world = band.world
    const mode = this.regroups(band, now)
    const shown = mode === 'cut' ? [] : this.shownCopies(band, now)
    const before = world.leaving.filter((l) => now < l.start + l.dur)
    this.layOut(band, kept)
    const at = new Map<string, Pt[]>()
    const held = new Map<string, HeldCopy>()
    if (mode === 'cut') return { at, held }
    const t = this.transformOf(band)
    const toScreen = (c: { x: number; y: number }) => ({
      x: c.x * t.scale + t.ox,
      y: c.y * t.scale + t.oy,
    })
    if (hold) {
      const quad = this.quadOf(band)
      const nearer = (a: Pt, b: Pt) =>
        Math.hypot(a.x - this.ripple.x, a.y - this.ripple.y) <
        Math.hypot(b.x - this.ripple.x, b.y - this.ripple.y)
      const inSight = shown.filter((c) => c.alpha >= 0.5 && insideQuad(quad, toScreen(c)))
      for (const c of inSight) {
        if (!spot.has(c.item.slug)) continue
        const known = held.get(c.item.slug)
        if (!known || nearer(toScreen(c), toScreen(known)))
          held.set(c.item.slug, { x: c.x, y: c.y })
      }
      // Finalists with no copy in sight take the places of the products nearest the click.
      const places = inSight
        .filter((c) => !spot.has(c.item.slug))
        .sort((a, b) => (nearer(toScreen(a), toScreen(b)) ? -1 : 1))
      for (const slug of spot) {
        if (held.has(slug)) continue
        const place = places.shift()
        if (!place) break
        const p = toScreen(place)
        held.set(slug, { x: place.x, y: place.y, since: now + this.rippleDelay(p.x, p.y) })
      }
    }
    const taken = new Set<string>()
    for (const c of shown) {
      const { x: sx, y: sy } = toScreen(c)
      const delay = this.rippleDelay(sx, sy)
      let list = at.get(c.item.slug)
      if (!list) {
        list = []
        at.set(c.item.slug, list)
      }
      list.push({ x: sx, y: sy })
      const keep = held.get(c.item.slug)
      // The copy held for the short list stays put: it is the finalist itself, waiting.
      if (keep && keep.since == null && keep.x === c.x && keep.y === c.y) continue
      const stays =
        mode === 'glide' && !spot.has(c.item.slug) && (world.kept?.has(c.item.slug) ?? true)
      const to = stays ? this.freeCopyNear(band, c.item, c.x, c.y, taken) : null
      if (to) {
        taken.add(copyKey(to))
        world.glides.set(copyKey(to), {
          ...to,
          fromX: c.x,
          fromY: c.y,
          start: now + REGROUP.glideAfter + delay * 0.6,
          dur: REGROUP.glide,
        })
      } else {
        before.push({
          item: c.item,
          x: c.x,
          y: c.y,
          alpha: c.alpha,
          start: now + delay,
          dur: REGROUP.leave,
        })
      }
    }
    world.leaving = before
    world.entered = now
    return { at, held }
  }

  /** The field's copies on screen (and a cell around it), where they are drawn now (world px). */
  private shownCopies(band: Band, now: number) {
    const world = band.world
    const out: { item: Item; x: number; y: number; alpha: number }[] = []
    if (!world.slots.length) return out
    const t = this.transformOf(band)
    const { w: tw, h: th } = world.tile
    const { w: cw, h: ch } = world.cell
    const wx0 = -t.ox / t.scale - cw
    const wx1 = (this.vp.w - t.ox) / t.scale + cw
    const wy0 = -t.oy / t.scale - ch
    const wy1 = (this.vp.h - t.oy) / t.scale + ch
    world.slots.forEach((slot, index) => {
      const field = read(slot.item.field, now)
      if (field <= 0.05) return
      const at = this.placeIn(world, slot)
      for (let kx = Math.ceil((wx0 - at.x) / tw); kx <= Math.floor((wx1 - at.x) / tw); kx++) {
        for (let ky = Math.ceil((wy0 - at.y) / th); ky <= Math.floor((wy1 - at.y) / th); ky++) {
          if (world.glides.has(copyKey({ slot: index, kx, ky }))) continue
          const x = at.x + kx * tw
          const y = at.y + ky * th
          const enter = this.enterOf(world, x * t.scale + t.ox, y * t.scale + t.oy, now)
          if (enter <= 0.05) continue
          out.push({ item: slot.item, x, y, alpha: field * enter })
        }
      }
    })
    for (const glide of world.glides.values()) {
      const slot = world.slots[glide.slot]
      if (!slot) continue
      const p = this.glideAt(world, glide, now)
      out.push({ item: slot.item, x: p.x, y: p.y, alpha: read(slot.item.field, now) })
    }
    return out
  }

  /** The copy of a product in the tile nearest a world point that no other copy has claimed. */
  private freeCopyNear(band: Band, item: Item, wx: number, wy: number, taken: Set<string>) {
    const world = band.world
    let best: Copy | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < world.slots.length; index++) {
      const slot = world.slots[index]
      if (!slot || slot.item !== item) continue
      const at = this.placeIn(world, slot)
      const kx0 = Math.round((wx - at.x) / world.tile.w)
      const ky0 = Math.round((wy - at.y) / world.tile.h)
      for (let kx = kx0 - 1; kx <= kx0 + 1; kx++) {
        for (let ky = ky0 - 1; ky <= ky0 + 1; ky++) {
          const copy = { slot: index, kx, ky }
          if (taken.has(copyKey(copy))) continue
          const d = Math.hypot(at.x + kx * world.tile.w - wx, at.y + ky * world.tile.h - wy)
          if (d < bestDistance) {
            bestDistance = d
            best = copy
          }
        }
      }
    }
    return best
  }

  /** Where a gliding copy is now (world px). */
  private glideAt(world: World, g: Glide, now: number): Pt {
    const slot = world.slots[g.slot]
    const p = easeInOut(clamp01((now - g.start) / g.dur))
    if (!slot) return { x: g.fromX, y: g.fromY }
    const at = this.placeIn(world, slot)
    return {
      x: lerp(g.fromX, at.x + g.kx * world.tile.w, p),
      y: lerp(g.fromY, at.y + g.ky * world.tile.h, p),
    }
  }

  /** How far a copy of the tile has faded in after a regrouping (screen px, for the wave). */
  private enterOf(world: World, sx: number, sy: number, now: number) {
    if (world.entered < 0) return 1
    const t = (now - world.entered - REGROUP.enterAfter - this.rippleDelay(sx, sy)) / REGROUP.enter
    return easeOut(clamp01(t))
  }

  /**
   * The short list: when few products are left, they fly out of the field to a grid in the free
   * space, each shown once; the ones dropped fly back (or fade away). `from`: where the products
   * were on screen just before the field regrouped, to take off from; `held`: the copies a panel
   * opening onto the short list kept where they were (world px). Just come on screen, a world whose
   * free space is not known yet keeps its finalists waiting for it.
   */
  private updateSpot(
    band: Band,
    order: string[] | null,
    now: number,
    animate: boolean,
    from?: Map<string, Pt[]>,
    held?: Map<string, HeldCopy>,
  ) {
    const world = band.world
    if (!world.items.length) return
    const wanted = this.spotWanted(band, order)
    const layout = wanted.length ? this.spotLayout(world, wanted) : null
    if (wanted.length && !this.stage && this.arriving(band, now)) {
      this.awaitSpot(band, wanted, now, held)
      return
    }
    world.awaiting = null
    const keep = layout ? wanted : []
    const arrival = this.arriving(band, now) ? world.arrival : null

    for (const s of [...world.spot]) {
      if (s.leaving || keep.includes(s.item.slug)) continue
      this.dropFromSpot(band, s, now, animate)
    }

    keep.forEach((slug, i) => {
      const item = world.bySlug.get(slug)
      const to = layout?.positions[i]
      if (!item || !to || !layout) return
      const existing = world.spot.find((s) => s.item === item)
      if (existing?.wait) {
        // Its place is known at last: a finalist held on the panel glides there, rank by rank;
        // one that waited hidden comes in where it belongs.
        const hidden = existing.wait === 'hidden'
        const pose = this.spotPose(band, existing, now)
        // One still fading in where it took another product's place finishes doing so first.
        const ready = !hidden && existing.appear ? existing.start + ARRIVE.morph * 0.8 : now
        Object.assign(existing, {
          to,
          scale: layout.zoom,
          from: hidden ? { x: to.x, y: to.y + ARRIVE.rise } : { x: pose.x, y: pose.y },
          fromScale: hidden ? layout.zoom * 0.94 : pose.scale,
          start: Math.max(ready, now) + i * ARRIVE.stagger,
          dur: animate ? (hidden ? ARRIVE.appear : ARRIVE.glide) : 0,
          wait: null,
          appear: hidden,
        })
        return
      }
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
          appear: false,
        })
        aim(item.field, 0, now, animate ? 250 : 0)
        return
      }
      const kept = held?.get(slug)
      const t = this.transformOf(band)
      // Entering: it takes off from where it was on screen (or its nearest copy on the field),
      // which hands over to it; arriving on a canvas that was not on screen, it appears in place.
      const appear = !kept && !!arrival && arrival.kind !== 'open'
      const pose = kept
        ? { x: kept.x * t.scale + t.ox, y: kept.y * t.scale + t.oy, scale: t.scale }
        : appear
          ? { x: to.x, y: to.y + ARRIVE.rise, scale: layout.zoom * 0.94 }
          : this.takeOff(band, item, to, layout.zoom, from?.get(slug))
      world.spot.push({
        item,
        to,
        scale: layout.zoom,
        from: { x: pose.x, y: pose.y },
        fromScale: pose.scale,
        start: now + i * (arrival ? ARRIVE.stagger : 55),
        dur: animate ? (appear ? ARRIVE.appear : kept ? ARRIVE.glide : 950) : 0,
        leaving: false,
        land: null,
        landed: false,
        phase: hash01(slug) * Math.PI * 2,
        wait: null,
        appear,
      })
      aim(item.field, 0, now, animate && !appear ? 250 : 0)
    })
  }

  /**
   * The short list is wanted, but the page has not said yet where it gathers (it comes on screen
   * a moment after the scene starts moving). A finalist held on the panel stays where it is,
   * following the camera; the others wait hidden; their copies on the field step aside meanwhile.
   * Should the page never say (its results cover the canvas, a phone has no room), they go back to
   * the field (see `settle`).
   */
  private awaitSpot(band: Band, wanted: string[], now: number, held?: Map<string, HeldCopy>) {
    const world = band.world
    world.awaiting = { until: now + STAGE_WAIT_MS }
    const t = this.transformOf(band)
    for (const s of [...world.spot]) {
      if (!s.leaving && !s.wait && !wanted.includes(s.item.slug))
        this.dropFromSpot(band, s, now, true)
    }
    for (const slug of wanted) {
      const item = world.bySlug.get(slug)
      if (!item || world.spot.some((s) => s.item === item && !s.leaving)) continue
      const hold = held?.get(slug)
      const at = hold ? { x: hold.x * t.scale + t.ox, y: hold.y * t.scale + t.oy } : { x: 0, y: 0 }
      world.spot.push({
        item,
        to: at,
        scale: t.scale,
        from: at,
        fromScale: t.scale,
        // One taking another product's place fades in from when that one starts fading out.
        start: hold?.since ?? now,
        dur: 0,
        leaving: false,
        land: null,
        landed: false,
        phase: hash01(slug) * Math.PI * 2,
        wait: hold ? { x: hold.x, y: hold.y } : 'hidden',
        appear: hold?.since != null,
      })
      aim(item.field, 0, now, 0)
    }
  }

  /** A world gone out of sight forgets its short list at once: its products are back on its field. */
  private clearSpot(band: Band) {
    const world = band.world
    const now = performance.now()
    for (const s of world.spot)
      if (world.kept?.has(s.item.slug) ?? true) aim(s.item.field, 1, now, 0)
    world.spot = []
    world.awaiting = null
  }

  /** The finalists still waiting go back to the field: no short list will form after all. */
  private releaseSpot(band: Band, now: number) {
    const world = band.world
    world.awaiting = null
    for (const s of [...world.spot]) if (s.wait) this.dropFromSpot(band, s, now, true)
  }

  /**
   * A product leaves the short list: back to its nearest copy on the field while the answers keep
   * it, faded where it is otherwise; one that was waiting hidden simply gives its copies back.
   */
  private dropFromSpot(band: Band, s: SpotItem, now: number, animate: boolean) {
    const world = band.world
    const stillKept = world.kept?.has(s.item.slug) ?? true
    if (s.wait === 'hidden') {
      world.spot = world.spot.filter((x) => x !== s)
      if (stillKept) aim(s.item.field, 1, now, animate ? 420 : 0)
      return
    }
    const pose = this.spotPose(band, s, now)
    Object.assign(s, {
      leaving: true,
      wait: null,
      appear: false,
      from: { x: pose.x, y: pose.y },
      fromScale: pose.scale,
      start: now,
      dur: animate ? 820 : 0,
    })
    if (stillKept) {
      // Still kept (the list just grew too long, or never formed): to the nearest field copy.
      s.land = this.nearestCopy(band, s.item, pose)
    } else {
      // Ruled out: it fades where it is.
      s.land = null
      aim(s.item.field, 1, now, 0)
    }
  }

  /** The products the short list should hold: few enough, on this band's open canvas. */
  private spotWanted(band: Band, order: string[] | null) {
    return order && order.length > 0 && order.length <= SPOT_MAX && this.isOpen(band) ? order : []
  }

  /** Where a product joining the short list takes off from. */
  private takeOff(band: Band, item: Item, to: Pt, zoom: number, shown: Pt[] | undefined) {
    const t = this.transformOf(band)
    if (shown?.length) {
      let best = shown[0] as Pt
      for (const p of shown) {
        if (Math.hypot(p.x - to.x, p.y - to.y) < Math.hypot(best.x - to.x, best.y - to.y)) best = p
      }
      return { x: best.x, y: best.y, scale: t.scale }
    }
    const copy = this.nearestCopy(band, item, to)
    return copy ? this.copyPose(band, copy) : { x: to.x, y: to.y + 40, scale: zoom }
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

  /**
   * A grid of `items` in `stage`: the largest scale at which every product fits, with room around
   * each for its ring and above it for its badge, so neither ever meets a neighbour's.
   */
  private gridIn(stage: Rect, items: Item[]) {
    if (stage.w < 120 || stage.h < 80) return null
    const n = items.length
    const maxW = Math.max(...items.map((i) => i.w))
    const maxH = Math.max(...items.map((i) => Math.max(i.h, i.photo?.h ?? 0)))
    const compact = isCompact(this.vp)
    const pad = this.ringPad()
    const reach = pad + BADGE.h / 2
    const gapX = 2 * pad + (compact ? 10 : 18)
    const gapY = pad + reach + (compact ? 8 : 14)
    const roomW = stage.w - 2 * pad
    const roomH = stage.h - reach - pad
    const ceiling = compact ? SPOT_ZOOM.maxCompact : SPOT_ZOOM.max
    // The largest scale wins; among layouts that reach it, the one shaped most like the free space.
    const aspect = stage.w / stage.h
    let best = { cols: 1, rows: n, zoom: 0, fit: Number.POSITIVE_INFINITY }
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols)
      const zoom = Math.min(
        (roomW - gapX * (cols - 1)) / cols / maxW,
        (roomH - gapY * (rows - 1)) / rows / maxH,
        ceiling,
      )
      const gridW = cols * (maxW * zoom + gapX) - gapX
      const gridH = rows * (maxH * zoom + gapY) - gapY
      const fit = Math.abs(Math.log(gridW / gridH / aspect)) + (cols * rows - n) * 0.15
      if (zoom > best.zoom + 0.01 || (zoom > best.zoom - 0.01 && fit < best.fit)) {
        best = { cols, rows, zoom, fit }
      }
    }
    if (best.zoom < SPOT_ZOOM.min) return null
    const { cols, rows, zoom } = best
    const cw = maxW * zoom + gapX
    const ch = maxH * zoom + gapY
    const gridH = rows * ch - gapY
    const positions = items.map((_, i) => {
      const row = Math.floor(i / cols)
      const inRow = row < rows - 1 ? cols : n - cols * (rows - 1)
      const rowW = inRow * cw - gapX
      return {
        x: stage.x + (stage.w - rowW) / 2 + (i % cols) * cw + (maxW * zoom) / 2,
        y: stage.y + reach + (roomH - gridH) / 2 + row * ch + (maxH * zoom) / 2,
      }
    })
    return { zoom, positions }
  }

  /** Where a product of the short list is now: on its flight, then floating gently. */
  private spotPose(band: Band, s: SpotItem, now: number): Pose {
    if (s.wait === 'hidden') return { x: s.to.x, y: s.to.y, scale: s.scale, alpha: 0 }
    if (s.wait) {
      // Held where it was on the field, it moves with the field (the panel zooming in, the drift).
      const t = this.transformOf(band)
      const alpha = s.appear ? easeOut(clamp01((now - s.start) / ARRIVE.morph)) : 1
      return { x: s.wait.x * t.scale + t.ox, y: s.wait.y * t.scale + t.oy, scale: t.scale, alpha }
    }
    const raw = s.dur > 0 ? clamp01((now - s.start) / s.dur) : now >= s.start ? 1 : 0
    // One that appears in place eases out as it fades in; a flight eases both ways.
    const p = s.appear ? easeOut(raw) : easeInOut(raw)
    if (s.appear && !s.leaving) {
      const bob = this.reduce ? 0 : Math.sin(now / 1400 + s.phase) * 3 * p
      return {
        x: lerp(s.from.x, s.to.x, p),
        y: lerp(s.from.y, s.to.y, p) + bob,
        scale: lerp(s.fromScale, s.scale, p),
        alpha: raw,
      }
    }
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
    const t = this.transformOf(band)
    return this.freeCopyNear(
      band,
      item,
      (near.x - t.ox) / t.scale,
      (near.y - t.oy) / t.scale,
      new Set(),
    )
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
    const { item } = slot
    const jitter = JITTER[world.category]
    return {
      x: slot.cx + slot.jx * Math.max(0, world.cell.w - item.w) * jitter,
      y: slot.cy + slot.jy * Math.max(0, world.cell.h - item.h) * jitter,
    }
  }

  // ---- Pointer on the open canvas -------------------------------------------------------------

  /** The product under a screen point, on the open canvas only. */
  pick(p: Pt): Hit | null {
    const band = this.activeBand()
    if (!band || !this.pickable) return null
    const world = band.world
    const now = performance.now()
    // The short list sits in front of the field.
    for (let i = world.spot.length - 1; i >= 0; i--) {
      const s = world.spot[i]
      if (!s || s.leaving || s.wait) continue
      const pose = this.spotPose(band, s, now)
      const { w, h } = this.sizeOf(s.item)
      if (Math.abs(p.x - pose.x) <= (w * pose.scale) / 2 + 6) {
        if (Math.abs(p.y - pose.y) <= (h * pose.scale) / 2 + 6) {
          return { category: band.category, slug: s.item.slug, spot: true, slot: -1, kx: 0, ky: 0 }
        }
      }
    }
    // With a short list on show the field behind it is scenery: it never takes the pointer, so
    // only the products of the list open their card.
    if (world.spot.some((s) => !s.leaving)) return null
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
      const { w, h } = this.sizeOf(item)
      const at = this.placeIn(world, slot)
      const kx = Math.round((wx - at.x) / tw)
      const ky = Math.round((wy - at.y) / th)
      const dx = wx - (at.x + kx * tw)
      const dy = wy - (at.y + ky * th)
      if (Math.abs(dx) > w / 2 + 6 || Math.abs(dy) > h / 2 + 6) continue
      // A copy still gliding to its place takes the pointer once it is there.
      if (world.glides.has(copyKey({ slot: index, kx, ky }))) continue
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        best = { category: band.category, slug: item.slug, spot: false, slot: index, kx, ky }
      }
    }
    // One barely showing (in a corner, under the paper fading below the header, behind the
    // console) opens no card.
    return best && this.inSight(band, best) ? best : null
  }

  /** Whether most of a copy on the field is in sight, clear of the screen’s edges and widgets. */
  private inSight(band: Band, hit: Hit) {
    const slot = band.world.slots[hit.slot]
    if (!slot) return false
    const pose = this.copyPose(band, hit)
    const { w: iw, h: ih } = this.sizeOf(slot.item)
    const w = iw * pose.scale
    const h = ih * pose.scale
    const top = isCompact(this.vp) ? PICK.topCompact : topVeil(this.vp) * PICK.veil
    const x0 = Math.max(pose.x - w / 2, PICK.side)
    const x1 = Math.min(pose.x + w / 2, this.vp.w - PICK.side)
    const y0 = Math.max(pose.y - h / 2, top)
    const y1 = Math.min(pose.y + h / 2, this.vp.h - PICK.bottom)
    if (x1 <= x0 || y1 <= y0) return false
    let shown = (x1 - x0) * (y1 - y0)
    // What the widgets cover of it does not show either.
    for (const r of this.keepClear?.() ?? []) {
      shown -=
        Math.max(0, Math.min(x1, r.x + r.w) - Math.max(x0, r.x)) *
        Math.max(0, Math.min(y1, r.y + r.h) - Math.max(y0, r.y))
    }
    return shown >= PICK.share * w * h
  }

  /** Whether a product's sheet veils the canvas: it is then drawn one frame in two. */
  setVeiled(on: boolean) {
    this.veiled = on
  }

  /** Whether the products take the pointer: off while the finder's results cover the canvas. */
  setPickable(on: boolean) {
    this.pickable = on
    if (!on) this.dropFocus()
  }

  /** Lets go of the highlighted product without the pointer leaving it, and says so. */
  private dropFocus() {
    if (!this.focus) return
    this.setFocus(null)
    this.onFocusLost?.()
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
    return this.focus ? this.rectOf(this.focus.hit) : null
  }

  /** Screen box of a product on the open canvas; null once it has left the place it was hit at. */
  rectOf(hit: Hit): Rect | null {
    const band = this.activeBand()
    if (!band || band.category !== hit.category) return null
    const world = band.world
    if (hit.spot) {
      const s = world.spot.find((x) => x.item.slug === hit.slug && !x.leaving && !x.wait)
      if (!s) return null
      const pose = this.spotPose(band, s, performance.now())
      const { w: iw, h: ih } = this.sizeOf(s.item)
      const w = iw * pose.scale
      const h = ih * pose.scale
      return { x: pose.x - w / 2, y: pose.y - h / 2, w, h }
    }
    const slot = world.slots[hit.slot]
    // A product that just left the field (for the short list, or ruled out) has no popup here.
    if (!slot || slot.item.slug !== hit.slug || slot.item.field.to < 1) return null
    const pose = this.copyPose(band, hit)
    const { w: iw, h: ih } = this.sizeOf(slot.item)
    const w = iw * pose.scale
    const h = ih * pose.scale
    return { x: pose.x - w / 2, y: pose.y - h / 2, w, h }
  }

  beginDrag() {
    const band = this.activeBand()
    if (!band) return
    this.dragging = true
    this.dragVelocity = { x: 0, y: 0 }
    band.world.velocity = { x: 0, y: 0 }
    gsap.to(band.world, { pause: 0, duration: 0.25, overwrite: 'auto' })
  }

  /** Moves the canvas with the pointer (or a wheel), in screen px. */
  dragBy(dx: number, dy: number) {
    const band = this.activeBand()
    if (!band) return
    band.world.cam.x -= dx / band.world.zoom
    band.world.cam.y -= dy / band.world.zoom
    this.push.x += dx
    this.push.y += dy
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
    // Under a sheet's veil, half the frames: the blurred drift looks the same, for half the work.
    // The next frame moves everything by both frames' time.
    if (this.veiled) {
      this.skipped = !this.skipped
      if (this.skipped) return
    }
    const now = performance.now()
    frame(now - this.last)
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    // How fast the pointer (or a wheel) moves the canvas: where it is heading, for `around`.
    const k = 1 - Math.exp(-8 * dt)
    this.dragVelocity.x += (this.push.x / Math.max(dt, 0.001) - this.dragVelocity.x) * k
    this.dragVelocity.y += (this.push.y / Math.max(dt, 0.001) - this.dragVelocity.y) * k
    this.push = { x: 0, y: 0 }
    // The home's rows move with the page: its scroll, read once here, places the rows this frame
    // draws and the page's layer alike. Elsewhere it stays where the home was left.
    if (this.homeLayer && this.rows && this.target.mode === 'bands') this.scroll = window.scrollY
    for (const band of this.bands) {
      this.step(band, dt)
      this.settle(band, now)
    }
    this.plates = 0
    this.products = 0
    this.onScreen = 0
    this.onScreenPhotos = 0
    this.draw(now)
    this.applyScroll()
    this.lastFrame = {
      products: this.products,
      plates: this.plates,
      onScreen: this.onScreen,
      onScreenPhotos: this.onScreenPhotos,
    }
    if (this.products > 0 && this.plates === 0) mark('first-full-frame')
    this.drawings.pump()
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

  /** Runs the regrouping the answers asked for, and ends what has finished moving. */
  private settle(band: Band, now: number) {
    const world = band.world
    const pending = world.pending
    if (pending && now >= pending.at) {
      world.pending = null
      if (this.focus && !this.focus.hit.spot && this.activeBand() === band) this.dropFocus()
      const spot = new Set(this.spotWanted(band, pending.order))
      const { at } = this.regroup(band, pending.kept, spot, now)
      this.updateSpot(band, pending.order, now, true, at)
    }
    // A short list that never learnt where to gather: its finalists go back to the field.
    if (world.awaiting && now > world.awaiting.until) this.releaseSpot(band, now)
    if (world.leaving.length) world.leaving = world.leaving.filter((l) => now < l.start + l.dur)
    for (const [key, glide] of world.glides) {
      if (now >= glide.start + glide.dur) world.glides.delete(key)
    }
    if (world.entered >= 0 && now > world.entered + REGROUP.enterAfter + 420 + REGROUP.enter) {
      world.entered = -1
    }
    if (!world.spot.length) return
    // Products flying back to the field land, then let go.
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
    ctx.clearRect(0, 0, vp.w, this.paintH)
    const stacked = this.stack.flatMap((c) => this.band(c) ?? [])
    const order = [...this.bands.filter((b) => !stacked.includes(b)), ...stacked]
    // Nothing under a panel that already covers the screen needs drawing.
    let first = 0
    order.forEach((band, i) => {
      if (band.expand >= 1 && band.enter >= 1 && band.ground >= 1) first = i
    })
    for (const band of order.slice(first)) this.drawBand(band, now)
  }

  /** The shape a panel covers on screen now: its slot, grown towards the whole screen, lifted. */
  private quadOf(band: Band): Quad {
    const full = this.full()
    const base = this.slotOf(band) ?? full
    const quad = band.expand > 0 ? lerpQuad(base, full, band.expand) : base
    const lift = (1 - band.enter) * 56
    return lift ? (quad.map((p) => ({ x: p.x, y: p.y + lift })) as Quad) : quad
  }

  /** A panel's slot on screen: its place on the home page, moved by the page's scroll (rows). */
  private slotOf(band: Band): Quad | null {
    const base = this.quads[band.index]
    if (!base) return null
    const shift = this.rows ? this.scroll : 0
    return shift ? (base.map((p) => ({ x: p.x, y: p.y - shift })) as Quad) : base
  }

  /** The whole canvas, down to the bottom of the largest viewport. */
  private full(): Quad {
    return fullQuad({ w: this.vp.w, h: this.paintH })
  }

  /** Moves the home page's layer by the scroll the rows were drawn with. */
  private applyScroll() {
    const layer = this.homeLayer
    if (!layer) return
    const value = `translate3d(0, ${-this.scroll}px, 0)`
    if (layer.style.transform !== value) layer.style.transform = value
  }

  private drawBand(band: Band, now: number) {
    const { ctx, dpr } = this
    if (!this.quads[band.index] || band.enter <= 0) return
    const quad = this.quadOf(band)
    // A row scrolled out of sight is not drawn.
    const box = boundsOf(quad)
    if (box.y1 < 0 || box.y0 > this.paintH) return
    const path = new Path2D()
    traceRounded(path, quad, frameOf(this.vp).radius * (1 - band.expand))
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
    if (world.alpha <= 0) return
    const alpha = bandAlpha * world.alpha
    const presenceAt = (sx: number, sy: number) =>
      read(world.presence, now, world.presence.ripple ? this.rippleDelay(sx, sy) : 0)

    // Copies of products an answer ruled out, fading where they were.
    for (const l of world.leaving) {
      const p = easeOut(clamp01((now - l.start) / l.dur))
      const sx = l.x * t.scale + t.ox
      const sy = l.y * t.scale + t.oy
      const a = alpha * l.alpha * (1 - p) * presenceAt(sx, sy)
      if (a <= 0.002) continue
      this.drawProduct(l.item, sx, sy, t.scale * (1 - 0.06 * p), a, now, 0, false, false)
    }
    if (!world.slots.length) return

    const b = boundsOf(quad)
    const wx0 = (b.x0 - t.ox) / t.scale
    const wx1 = (b.x1 - t.ox) / t.scale
    const wy0 = (b.y0 - t.oy) / t.scale
    const wy1 = (b.y1 - t.oy) / t.scale
    const { w: tw, h: th } = world.tile
    const { w: cw, h: ch } = world.cell
    const open = this.activeBand() === band
    const focus = open && this.focus && !this.focus.hit.spot ? this.focus : null
    const focusIn = this.focusIn(now)
    // With a short list on show, the podium badges ride on it rather than on the field.
    const ranked = open && !world.spot.some((s) => !s.leaving)
    const drawn = this.drawnIn(band.category)

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
          if (world.glides.size && world.glides.has(copyKey({ slot: index, kx, ky }))) continue
          const sx = (at.x + kx * tw) * t.scale + t.ox
          const sy = (at.y + ky * th) * t.scale + t.oy
          const presence = presenceAt(sx, sy)
          if (presence <= 0.002) continue
          const enter = this.enterOf(world, sx, sy, now)
          if (enter <= 0.002) continue
          seen(drawn, item.slug, t.scale, this.fromMiddle(sx, sy))
          const focused =
            !!focus && focus.hit.slot === index && focus.hit.kx === kx && focus.hit.ky === ky
          this.drawProduct(
            item,
            sx,
            sy,
            t.scale * (0.9 + 0.1 * presence) * (0.94 + 0.06 * enter),
            alpha * field * presence * enter,
            now,
            focused ? focusIn : 0,
            ranked,
            true,
          )
        }
      }
    })

    // Copies gliding to their new places, drawn wherever they are on their way.
    for (const glide of world.glides.values()) {
      const slot = world.slots[glide.slot]
      if (!slot) continue
      const field = read(slot.item.field, now)
      if (field <= 0.002) continue
      const p = this.glideAt(world, glide, now)
      const sx = p.x * t.scale + t.ox
      const sy = p.y * t.scale + t.oy
      seen(drawn, slot.item.slug, t.scale, this.fromMiddle(sx, sy))
      const a = alpha * field * presenceAt(sx, sy)
      this.drawProduct(slot.item, sx, sy, t.scale, a, now, 0, ranked, true)
    }
  }

  private drawSpot(band: Band, now: number, bandAlpha: number) {
    const world = band.world
    if (!world.spot.length || world.alpha <= 0) return
    const alpha = bandAlpha * world.alpha
    const focus = this.activeBand() === band && this.focus?.hit.spot ? this.focus : null
    const focusIn = this.focusIn(now)
    const drawn = this.drawnIn(band.category)
    for (const s of world.spot) {
      const pose = this.spotPose(band, s, now)
      seen(drawn, s.item.slug, pose.scale, this.fromMiddle(pose.x, pose.y))
      const delay = this.rippleDelay(pose.x, pose.y)
      const presence = read(world.presence, now, world.presence.ripple ? delay : 0)
      // A finalist waiting for its place wears no badge yet: it is still on its way.
      const placed = !s.leaving && !s.wait
      const focused = !!focus && placed && focus.hit.slug === s.item.slug
      this.drawProduct(
        s.item,
        pose.x,
        pose.y,
        pose.scale,
        alpha * pose.alpha * presence,
        now,
        focused ? focusIn : 0,
        placed,
        placed,
      )
    }
  }

  /**
   * One product: its photo or its drawing (a plate of its shape while the drawing is on its way),
   * and, when `decorated`, its ring, rank badge and focus marks.
   */
  private drawProduct(
    item: Item,
    x: number,
    y: number,
    base: number,
    alpha: number,
    now: number,
    focus: number,
    ranked: boolean,
    decorated: boolean,
  ) {
    const { ctx } = this
    const hot = read(item.hot, now)
    const dim = read(item.dim, now)
    // The ring and the badge hold to the product's resting size; only the drawing breathes.
    const scale = base * (1 + HOT_LIFT * hot) * (1 + 0.05 * focus)
    const a = alpha * (1 - 0.5 * dim)
    if (a <= 0.002) return
    this.products++
    if (x > 0 && x < this.vp.w && y > 0 && y < this.vp.h) {
      this.onScreen++
      if (item.photo) this.onScreenPhotos++
    }
    const drawing = this.drawings.get(item.key)
    if (!drawing) this.drawings.want(item.key)
    const appear = drawing ? easeOut(clamp01((now - drawing.at) / APPEAR_MS)) : 0
    if (!item.photo && appear < 1) {
      this.plates++
      this.drawPlate(item, x, y, scale, a * (1 - appear))
    }
    const current = item.photo ?? drawing?.sprite ?? null
    const swap = read(item.swap, now)
    const before = item.previous
    if (before && swap < 1) {
      const bw = (before.w + before.pad * 2) * scale
      const bh = (before.h + before.pad * 2) * scale
      // Held whole for the first half, so the paper never shows through the crossfade.
      ctx.globalAlpha = a * Math.min(1, 2 * (1 - swap))
      ctx.drawImage(before.image, x - bw / 2, y - bh / 2, bw, bh)
    } else if (before) {
      item.previous = null
    }
    if (current) {
      const dw = (current.w + current.pad * 2) * scale
      const dh = (current.h + current.pad * 2) * scale
      ctx.globalAlpha = a * swap * (item.photo ? 1 : appear)
      ctx.drawImage(current.image, x - dw / 2, y - dh / 2, dw, dh)
    }
    if (!decorated) return
    const size = this.sizeOf(item)
    const w = size.w * base
    const h = size.h * base
    const badge =
      ranked && item.rank != null && item.rank < 3
        ? this.badgeOf(item.rank, item.score, x, y, w, h)
        : null
    if (hot > 0.01) this.drawRing(x, y, w, h, a * hot, badge)
    if (badge) this.drawBadge(badge, a)
    if (focus > 0) this.drawBrackets(x, y, size.w * scale, size.h * scale, a * focus, focus)
  }

  /** A faint print of a product's shape, holding its place until its drawing is ready. */
  private drawPlate(item: Item, x: number, y: number, scale: number, alpha: number) {
    if (alpha <= 0.002) return
    const { ctx } = this
    const w = item.w * scale
    const h = item.h * scale
    ctx.globalAlpha = alpha
    ctx.fillStyle = PLATE
    ctx.beginPath()
    ctx.roundRect(x - w / 2, y - h / 2, w, h, Math.min(h * 0.12, 7 * scale))
    ctx.fill()
  }

  /** The size a product is drawn at (world px): its photo's, once it has one. */
  private sizeOf(item: Item) {
    return { w: item.w, h: item.photo?.h ?? item.h }
  }

  /** Room between a product and the ring that highlights it, in screen px. */
  private ringPad() {
    return isCompact(this.vp) ? 9 : 12
  }

  /**
   * The ring around a product the hovered option keeps. With a badge, its top edge opens around
   * it, like a legend on a technical drawing.
   */
  private drawRing(
    cx: number,
    cy: number,
    w: number,
    h: number,
    alpha: number,
    badge: Badge | null,
  ) {
    const { ctx } = this
    const pad = this.ringPad()
    const r = radii.card
    const x0 = cx - w / 2 - pad
    const x1 = cx + w / 2 + pad
    const y0 = cy - h / 2 - pad
    const y1 = cy + h / 2 + pad
    ctx.globalAlpha = alpha
    ctx.strokeStyle = SIGNAL
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (badge) {
      ctx.moveTo(Math.min(x1 - r, badge.right + BADGE_GAP), y0)
      ctx.arcTo(x1, y0, x1, y1, r)
      ctx.arcTo(x1, y1, x0, y1, r)
      ctx.arcTo(x0, y1, x0, y0, r)
      ctx.arcTo(x0, y0, x1, y0, r)
      ctx.lineTo(Math.max(x0 + r, badge.x - BADGE_GAP), y0)
    } else {
      ctx.roundRect(x0, y0, x1 - x0, y1 - y0, r)
    }
    ctx.stroke()
  }

  /** Where a product's rank badge goes: astride the top edge of its ring, its match beside it. */
  private badgeOf(
    rank: number,
    score: number | null,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ): Badge {
    const { ctx } = this
    const label = String(rank + 1)
    ctx.font = `500 10px ${MONO}`
    const pill = Math.max(BADGE.h, ctx.measureText(label).width + 10)
    const x = cx - w / 2 + BADGE.inset
    const match = score != null ? `${Math.round(score * 100)} %` : null
    ctx.font = `500 11px ${MONO}`
    const right = x + pill + (match ? 6 + ctx.measureText(match).width : 0)
    return { rank, label, match, x, y: cy - h / 2 - this.ringPad(), pill, right }
  }

  /** The podium's rank medal above a product, and its match beside it. */
  private drawBadge(b: Badge, alpha: number) {
    const { ctx } = this
    ctx.globalAlpha = alpha
    ctx.fillStyle = b.rank === 0 ? SIGNAL : INK
    ctx.beginPath()
    ctx.roundRect(b.x, b.y - BADGE.h / 2, b.pill, BADGE.h, BADGE.h / 2)
    ctx.fill()
    ctx.font = `500 10px ${MONO}`
    ctx.fillStyle = b.rank === 0 ? '#FFFFFF' : rgb(PAPER)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.label, b.x + b.pill / 2, b.y + 0.5)
    if (b.match) {
      ctx.textAlign = 'left'
      ctx.fillStyle = INK_MUTED
      ctx.font = `500 11px ${MONO}`
      ctx.fillText(b.match, b.x + b.pill + 6, b.y + 0.5)
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  /**
   * Corner marks around the product under the pointer, like a viewfinder locking on: they close
   * in from further out as `progress` reaches 1.
   */
  private drawBrackets(
    cx: number,
    cy: number,
    w: number,
    h: number,
    alpha: number,
    progress: number,
  ) {
    const { ctx } = this
    const pad = 12 + 14 * (1 - progress)
    const arm = 10 - 3 * (1 - progress)
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

  private drawnIn(category: Category) {
    let drawn = this.drawn.get(category)
    if (!drawn) {
      drawn = new Map<string, Drawn>()
      this.drawn.set(category, drawn)
    }
    return drawn
  }

  /** Screen px from the middle of the screen. */
  private fromMiddle(x: number, y: number) {
    return Math.hypot(x - this.vp.w / 2, y - this.vp.h / 2)
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
    if (this.rows) return ZOOM.bandRows
    return isCompact(this.vp) ? ZOOM.bandCompact : ZOOM.band
  }

  private zoomForCanvas() {
    return isCompact(this.vp) ? ZOOM.canvasCompact : ZOOM.canvas
  }

  /**
   * Along the panel: downwards, the direction of its tilted dividers; across a row, every other
   * row the other way.
   */
  private angleFor(band: Band) {
    if (this.isOpen(band)) return CANVAS_ANGLE
    if (this.rows) return band.index % 2 ? 0 : Math.PI
    return Math.PI / 2 + tiltFor(this.vp, this.bands.length)
  }

  /** A panel back at rest: home zoom, drifting along its tilt, every product on its field. */
  private rest(band: Band) {
    const world = band.world
    gsap.killTweensOf(world, MOTION)
    // A regrouping still waiting for the answers to settle happens at once: nobody watches.
    const pending = world.pending
    world.pending = null
    if (pending) this.layOut(band, pending.kept)
    Object.assign(world, {
      zoom: this.zoomFor(band),
      angle: this.angleFor(band),
      speed: this.isOpen(band) ? SPEED.canvas : SPEED.band,
      pause: 1,
      anchor: null,
      velocity: { x: 0, y: 0 },
      presence: channel(1),
      spot: [],
      awaiting: null,
      leaving: [],
      entered: -1,
    })
    world.glides.clear()
    // Back in its row (where it is out of sight), its world moves with the page again.
    band.scrolls = true
    const now = performance.now()
    for (const item of world.items) aim(item.field, 1, now, 0)
  }

  /**
   * World → screen: the camera, then the hover zoom around the panel's centre. A row's world also
   * moves with the page, as the row does.
   */
  private transformOf(band: Band): Transform {
    const world = band.world
    const cx = this.vp.w / 2
    const cy = this.vp.h / 2 - (band.scrolls && this.rows ? this.scroll : 0)
    const k = 1 + HOVER_ZOOM * band.hover
    const pivot = centroid(this.slotOf(band) ?? this.full())
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

  /**
   * Bakes the hover zoom and the page's scroll into the camera, so a panel can open without a
   * jump: from then on its world no longer moves with the page.
   */
  private foldHover(band: Band) {
    if (!band.hover && !band.scrolls) return
    const t = this.transformOf(band)
    band.world.zoom = t.scale
    band.world.cam = { x: (this.vp.w / 2 - t.ox) / t.scale, y: (this.vp.h / 2 - t.oy) / t.scale }
    band.hover = 0
    band.scrolls = false
  }

  /** Gives the page's scroll back to a panel folded into its row, without a jump. */
  private unfoldScroll(band: Band) {
    if (band.scrolls) return
    band.scrolls = true
    if (this.rows && this.scroll) band.world.cam.y -= this.scroll / band.world.zoom
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
