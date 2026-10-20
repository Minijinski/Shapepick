import type { Category } from '@choose/catalog'
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

export type SceneTarget = { mode: 'bands' } | { mode: 'canvas'; category: Category }

/** What the finder wants each product of its category to look like. */
export type ItemTargets = {
  /** Products the current answers keep, draft included; null keeps everything. */
  matching: Set<string> | null
  /** Products the hovered option would keep, highlighted. */
  hot: Set<string> | null
  /** Podium position (0, 1, 2) of the best matches. */
  ranks: Map<string, number>
}

/** One product instance on the infinite canvas: the tile repeats, kx/ky say which copy. */
export type Hit = { category: Category; slug: string; slot: number; kx: number; ky: number }

export const sameHit = (a: Hit | null, b: Hit | null) =>
  a === b ||
  (!!a && !!b && a.category === b.category && a.slot === b.slot && a.kx === b.kx && a.ky === b.ky)

// ==== Tuning ===================================================================================

/** Room per product in the repeating tile, in world px. */
const CELL: Record<Category, { w: number; h: number }> = {
  keyboard: { w: 330, h: 178 },
  monitor: { w: 520, h: 330 },
}
const ZOOM = { band: 0.5, canvas: 1, bandCompact: 0.4, canvasCompact: 0.56 }
/** On-screen drift in px/s: along the panel on the home page, a calmer diagonal on the canvas. */
const SPEED = { band: 36, canvas: 18 }
/** Direction products travel on the canvas: from the top-right corner towards the bottom-left. */
const CANVAS_ANGLE = (145 * Math.PI) / 180
const HOVER_ZOOM = 0.07
/** A small catalogue is laid out several times per tile, so its repetition is far apart. */
const MIN_SLOTS = 60
/** A ruled-out product turns into a sketch, then gives its place to a kept one. */
const SWAP_DELAY_MS = 260
const SWAP_MS = 720
const RIPPLE_MAX_MS = 420
/** Seconds a panel takes to open over the others, and to fold back. */
export const OPEN_S = 1.25
export const CLOSE_S = 1.1
const MASK_EASE = 'expo.inOut'
/** The world properties a transition animates; the sprites' fade-in is left alone. */
const MOTION = 'zoom,angle,speed,pause'
const DOT_STEP = 28

const PAPER = [243, 241, 236] as const
const PANEL = [234, 231, 224] as const
const PANEL_HOVER = [248, 247, 244] as const
const SIGNAL = '#FF5A1F'
const INK = '#141414'
const MONO = '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace'

/** Device px per world px the sprites need: device pixel ratio times the canvas zoom. */
export const spriteResolution = (vp: Viewport, dpr: number) =>
  dpr * (isCompact(vp) ? ZOOM.canvasCompact : ZOOM.canvas)

// ==== Per-product animation channels ===========================================================

// Products change state in bulk (an answer can grey out half the canvas), so they are not GSAP
// tweens: each channel stores where it comes from, where it goes and when it started, and the
// drawing reads it. That also lets every on-screen copy of a product start late by its distance
// from the console, which makes a new answer ripple across the canvas.

type Channel = { from: number; to: number; start: number; dur: number; ripple: boolean }

const channel = (v: number): Channel => ({ from: v, to: v, start: 0, dur: 0, ripple: false })
const easeOut = (t: number) => 1 - (1 - t) ** 3
const backOut = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function read(c: Channel, now: number, delay = 0) {
  if (c.dur <= 0) return c.to
  const t = (now - c.start - delay) / c.dur
  if (t >= 1) return c.to
  if (t <= 0) return c.from
  return c.from + (c.to - c.from) * easeOut(t)
}

function aim(c: Channel, to: number, now: number, dur: number, ripple = false) {
  if (c.to === to) return
  c.from = read(c, now)
  c.to = to
  c.start = now
  c.dur = dur
  c.ripple = ripple
}

/** One product: its bitmaps and its state, shared by every place it appears in the tile. */
type Item = {
  slug: string
  sprite: Sprite
  /** 1 kept by the answers (drawn in colour), 0 ruled out (drawn as a sketch). */
  on: Channel
  /** 1 kept by the option under the pointer. */
  hot: Channel
  /** 1 while another option is previewed. */
  dim: Channel
  rank: number | null
}

/**
 * A place in the tile. It belongs to one product (`original`); while the answers rule that
 * product out, a kept product stands in, so the canvas only ever shows what still fits.
 */
type Slot = {
  /** Cell centre in tile coordinates, and a -1..1 jitter scaled by the room the product leaves. */
  cx: number
  cy: number
  jx: number
  jy: number
  original: Item
  occupant: Item
  /** The product giving way to `occupant` while `swap` runs from 0 to 1. */
  prev: Item | null
  swap: Channel
  seed: number
}

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
  /** Drift multiplier: eased to 0 while a product is hovered or the canvas dragged. */
  pause = 1
  /** Fades the products in once their sprites exist. */
  alpha = 0
  /** Fling after a drag, screen px/s. */
  velocity: Pt = { x: 0, y: 0 }
  /** During a zoom, the world point that stays under a screen point (the click). */
  anchor: { screen: Pt; world: Pt } | null = null

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
}

type Transform = { scale: number; ox: number; oy: number }

/** One product drawn in one copy of a slot. */
type DrawProduct = {
  world: World
  t: Transform
  now: number
  alpha: number
  slot: Slot
  item: Item
  kx: number
  ky: number
  /** Ripple delay of this copy, ms. */
  delay: number
  /** Swap fade (0..1) and scale. */
  fade: number
  grow: number
  focused: boolean
  focusIn: number
  ranked: boolean
}

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
  private dots: CanvasPattern | null = null
  private focus: { hit: Hit; since: number } | null = null
  private dragging = false
  private ripple: Pt = { x: 0, y: 0 }
  private last = performance.now()
  private readonly reduce: boolean
  /** Called after every frame, for overlays that follow a product (the popup). */
  onFrame: (() => void) | null = null
  private readonly record = {} as DrawProduct

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
      hot: channel(0),
      dim: channel(0),
      rank: null,
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
    world.slots = layout.cells.flatMap((c, i) => {
      const item = world.bySlug.get(c.id)
      if (!item) return []
      const seed = Math.floor(hash01(`${c.id}:${i}`) * 997)
      return [{ ...c, original: item, occupant: item, prev: null, swap: channel(1), seed }]
    })
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
    if (intro) {
      return target.mode === 'bands' ? this.introBands() : this.introCanvas(target.category)
    }
    if (target.mode === 'bands') {
      return from.mode === 'canvas' ? this.close(from.category) : this.introBands()
    }
    return this.open(target.category, focal)
  }

  private introBands() {
    this.stack = []
    this.bands.forEach((band, i) => {
      gsap.killTweensOf(band)
      Object.assign(band, { expand: 0, hover: 0, veil: 0 })
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
      gsap.killTweensOf(other)
      Object.assign(other, { enter: 1, expand: other === band ? 1 : 0, hover: 0, veil: 0 })
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
    gsap.killTweensOf(band)
    gsap.killTweensOf(world, MOTION)
    this.foldHover(band)
    band.enter = 1
    band.veil = 0
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
        Object.assign(other, { expand: 0, veil: 0, hover: 0, enter: 1 })
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
    gsap.killTweensOf(band)
    gsap.killTweensOf(world, MOTION)
    this.stack = [category]
    for (const other of this.bands) {
      if (other === band) continue
      gsap.killTweensOf(other)
      Object.assign(other, { enter: 1, expand: 0, hover: 0, veil: 1 })
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

  private applyTargets(band: Band, t: ItemTargets | null, animate: boolean) {
    const now = performance.now()
    const slow = animate ? 560 : 0
    const fast = animate ? 240 : 0
    for (const item of band.world.items) {
      const hot = !!t?.hot?.has(item.slug)
      const kept = !t?.matching || t.matching.has(item.slug)
      // A preview lights up at once; an answer ripples out from the console.
      const previewing = hot || item.hot.to === 1
      aim(item.on, kept || hot ? 1 : 0, now, slow, !previewing)
      aim(item.hot, hot ? 1 : 0, now, fast)
      aim(item.dim, t?.hot && !hot ? 1 : 0, now, fast)
      item.rank = t?.ranks.get(item.slug) ?? null
    }
    this.assign(band.world, t?.matching ?? null, now, animate)
  }

  /**
   * Gives the places of ruled-out products to kept ones (each place picks its stand-in from its
   * seed, so neighbours differ), and hands places back as soon as their own product fits again.
   * With nothing kept, every place shows its own product as a sketch.
   */
  private assign(world: World, kept: Set<string> | null, now: number, animate: boolean) {
    const pool = kept ? world.items.filter((item) => kept.has(item.slug)) : []
    world.slots.forEach((slot, index) => {
      const own = !kept || !pool.length || kept.has(slot.original.slug)
      const next = own ? slot.original : (pool[(index * 7 + slot.seed) % pool.length] as Item)
      if (next === slot.occupant) return
      slot.prev = animate ? slot.occupant : null
      slot.swap = animate
        ? { from: 0, to: 1, start: now + SWAP_DELAY_MS, dur: SWAP_MS, ripple: true }
        : channel(1)
      slot.occupant = next
    })
  }

  /** Where a product sits in a slot: its cell centre, nudged as far as its size allows. */
  private placeIn(world: World, slot: Slot, item: Item): Pt {
    return {
      x: slot.cx + slot.jx * Math.max(0, world.cell.w - item.sprite.w) * 0.42,
      y: slot.cy + slot.jy * Math.max(0, world.cell.h - item.sprite.h) * 0.42,
    }
  }

  // ---- Pointer on the open canvas -------------------------------------------------------------

  /** The product under a screen point, on the open canvas only. */
  pick(p: Pt): Hit | null {
    const band = this.activeBand()
    if (!band) return null
    const t = this.transformOf(band)
    const wx = (p.x - t.ox) / t.scale
    const wy = (p.y - t.oy) / t.scale
    const { w: tw, h: th } = band.world.tile
    let best: Hit | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    band.world.slots.forEach((slot, index) => {
      const item = slot.occupant
      const at = this.placeIn(band.world, slot, item)
      const kx = Math.round((wx - at.x) / tw)
      const ky = Math.round((wy - at.y) / th)
      const dx = wx - (at.x + kx * tw)
      const dy = wy - (at.y + ky * th)
      if (Math.abs(dx) > item.sprite.w / 2 + 6 || Math.abs(dy) > item.sprite.h / 2 + 6) return
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        best = { category: band.category, slug: item.slug, slot: index, kx, ky }
      }
    })
    return best
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
    const slot = band.world.slots[focus.hit.slot]
    // A product that just gave its place away no longer has a popup.
    if (!slot || slot.occupant.slug !== focus.hit.slug) return null
    const t = this.transformOf(band)
    const at = this.placeIn(band.world, slot, slot.occupant)
    const w = slot.occupant.sprite.w * t.scale
    const h = slot.occupant.sprite.h * t.scale
    const cx = (at.x + focus.hit.kx * band.world.tile.w) * t.scale + t.ox
    const cy = (at.y + focus.hit.ky * band.world.tile.h) * t.scale + t.oy
    return { x: cx - w / 2, y: cy - h / 2, w, h }
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
    for (const band of this.bands) this.step(band, dt)
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

  private draw(now: number) {
    const { ctx, vp, dpr } = this
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vp.w, vp.h)
    const stacked = this.stack.flatMap((c) => this.band(c) ?? [])
    const order = [...this.bands.filter((b) => !stacked.includes(b)), ...stacked]
    // Nothing under a panel that already covers the screen needs drawing.
    let first = 0
    order.forEach((band, i) => {
      if (band.expand >= 1 && band.enter >= 1) first = i
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

    ctx.save()
    ctx.globalAlpha = band.enter
    if (band.expand > 0 && band.expand < 1) {
      // A sheet sliding over the others casts a shadow while it moves.
      ctx.shadowColor = `rgba(20, 20, 20, ${0.2 * Math.sin(Math.PI * band.expand)})`
      ctx.shadowBlur = 64 * dpr
      ctx.shadowOffsetY = 20 * dpr
    }
    ctx.fillStyle = rgb(mix(mix(PANEL, PANEL_HOVER, band.hover), PAPER, band.expand))
    ctx.fill(path)
    ctx.shadowColor = 'transparent'
    ctx.clip(path)
    const t = this.transformOf(band)
    this.drawDots(t, quad)
    this.drawItems(band, t, quad, now)
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

  private drawItems(band: Band, t: Transform, quad: Quad, now: number) {
    const world = band.world
    if (!world.slots.length || world.alpha <= 0) return
    const b = boundsOf(quad)
    const wx0 = (b.x0 - t.ox) / t.scale
    const wx1 = (b.x1 - t.ox) / t.scale
    const wy0 = (b.y0 - t.oy) / t.scale
    const wy1 = (b.y1 - t.oy) / t.scale
    const { w: tw, h: th } = world.tile
    const { w: cw, h: ch } = world.cell
    const bandAlpha = this.ctx.globalAlpha
    const open = this.activeBand() === band
    const focus = open && this.focus?.hit.category === band.category ? this.focus : null
    const focusIn = focus ? easeOut(Math.min(1, (now - focus.since) / 240)) : 0
    // One record reused for every product drawn this frame: this loop runs hundreds of times.
    const d = this.record
    d.world = world
    d.t = t
    d.now = now
    d.alpha = bandAlpha * world.alpha
    d.focusIn = focusIn

    world.slots.forEach((slot, index) => {
      if (slot.prev && now - slot.swap.start > slot.swap.dur + RIPPLE_MAX_MS) slot.prev = null
      const kx0 = Math.ceil((wx0 - cw - slot.cx) / tw)
      const kx1 = Math.floor((wx1 + cw - slot.cx) / tw)
      const ky0 = Math.ceil((wy0 - ch - slot.cy) / th)
      const ky1 = Math.floor((wy1 + ch - slot.cy) / th)
      for (let kx = kx0; kx <= kx1; kx++) {
        for (let ky = ky0; ky <= ky1; ky++) {
          // Every copy of a place starts late by its distance from the console: a ripple.
          const delay = this.rippleDelay(
            (slot.cx + kx * tw) * t.scale + t.ox,
            (slot.cy + ky * th) * t.scale + t.oy,
          )
          const swap = slot.prev ? read(slot.swap, now, delay) : 1
          d.slot = slot
          d.kx = kx
          d.ky = ky
          d.delay = delay
          d.focused = false
          d.ranked = false
          if (slot.prev && swap < 1) {
            d.item = slot.prev
            d.fade = 1 - smooth(0.2, 0.65, swap)
            d.grow = 1 - 0.12 * swap
            this.drawProduct(d)
            const arrive = smooth(0.4, 1, swap)
            d.item = slot.occupant
            d.fade = arrive
            d.grow = 0.8 + 0.2 * backOut(arrive)
            this.drawProduct(d)
          } else {
            d.item = slot.occupant
            d.fade = 1
            d.grow = 1
            d.focused =
              !!focus && focus.hit.slot === index && focus.hit.kx === kx && focus.hit.ky === ky
            // The podium badge marks a product's own places, not its stand-ins.
            d.ranked = open && slot.occupant === slot.original
            this.drawProduct(d)
          }
        }
      }
    })
    this.ctx.globalAlpha = bandAlpha
  }

  private drawProduct(d: DrawProduct) {
    const { ctx } = this
    const { item, t } = d
    const s = item.sprite
    const at = this.placeIn(d.world, d.slot, item)
    const sx = (at.x + d.kx * d.world.tile.w) * t.scale + t.ox
    const sy = (at.y + d.ky * d.world.tile.h) * t.scale + t.oy
    const on = read(item.on, d.now, item.on.ripple ? d.delay : 0)
    const hot = read(item.hot, d.now)
    const dim = read(item.dim, d.now)
    const scale =
      t.scale *
      d.grow *
      (0.9 + 0.1 * on) *
      (1 + 0.04 * hot) *
      (d.focused ? 1 + 0.05 * d.focusIn : 1)
    const dw = (s.w + s.pad * 2) * scale
    const dh = (s.h + s.pad * 2) * scale
    const a = d.alpha * d.fade * (1 - 0.5 * dim)
    if (a <= 0.002) return
    if (on < 0.999) {
      ctx.globalAlpha = a * (1 - on)
      ctx.drawImage(s.ghost, sx - dw / 2, sy - dh / 2, dw, dh)
    }
    if (on > 0.001) {
      ctx.globalAlpha = a * on
      ctx.drawImage(s.color, sx - dw / 2, sy - dh / 2, dw, dh)
    }
    const w = s.w * scale
    const h = s.h * scale
    if (hot > 0.01) this.drawRing(sx, sy, w, h, a * hot)
    if (d.ranked && item.rank != null && on > 0.5) this.drawRank(item.rank, sx, sy, w, h, a * on)
    if (d.focused) this.drawBrackets(sx, sy, w, h, a * d.focusIn)
  }

  private drawRing(cx: number, cy: number, w: number, h: number, alpha: number) {
    const { ctx } = this
    const pad = 10
    ctx.globalAlpha = alpha
    ctx.strokeStyle = SIGNAL
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(cx - w / 2 - pad, cy - h / 2 - pad, w + pad * 2, h + pad * 2, 12)
    ctx.stroke()
  }

  private drawRank(rank: number, cx: number, cy: number, w: number, h: number, alpha: number) {
    const { ctx } = this
    const x = cx - w / 2
    const y = cy - h / 2 - 12
    ctx.globalAlpha = alpha
    ctx.fillStyle = rank === 0 ? SIGNAL : INK
    ctx.beginPath()
    ctx.arc(x + 3, y - 4, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = `500 11px ${MONO}`
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(String(rank + 1).padStart(2, '0'), x + 11, y)
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

  private zoomFor(band: Band) {
    const compact = isCompact(this.vp)
    if (this.isOpen(band)) return compact ? ZOOM.canvasCompact : ZOOM.canvas
    return compact ? ZOOM.bandCompact : ZOOM.band
  }

  /** Along the panel, downwards: the direction of its tilted dividers. */
  private angleFor(band: Band) {
    return this.isOpen(band) ? CANVAS_ANGLE : Math.PI / 2 + tiltFor(this.vp, this.bands.length)
  }

  /** A panel back at rest: home zoom, drifting along its tilt. */
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
    })
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
