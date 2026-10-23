import type { CatalogItem, Category, Photo } from '@choose/catalog'
import { drawingBox, squareOn } from '@choose/catalog/media'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { glyphKey, ProductGlyph } from '../product/glyphs'
import { cutout, photoWidthFor, warm } from '../product/photo'

// Products as bitmaps for the canvas. The canvas lays products out from their shape alone (the
// size their specs give their drawing), so it can place hundreds of them at once and draw only
// what the camera sees. Drawings are made from a handful of specs, so products drawn alike share
// one bitmap: 523 keyboards make 77 drawings. Each is rendered once in a detached React root,
// serialised and rasterised at the size the canvas draws it (device pixels included), with a soft
// contact shadow, when the canvas first needs it. Products that have a photo get it once the
// canvas draws them, cut out, in place of the drawing, if it shows them the way the canvas draws
// them. Drawing a bitmap per frame is what keeps a field of moving products cheap.

export type Sprite = {
  /** Size of the product itself in world px (CSS px at zoom 1), shadow padding excluded. */
  w: number
  h: number
  /** Padding baked around the product for its shadow, in world px. */
  pad: number
  image: HTMLCanvasElement
  /** What the bitmap weighs in memory. */
  bytes: number
}

/** What the canvas knows of a product before any bitmap: its size and the drawing it shares. */
export type Shape = {
  slug: string
  /** Size of the drawing in world px. */
  w: number
  h: number
  /** The drawing, shared by every product drawn alike. */
  key: string
}

/**
 * World px per glyph unit. Keyboards are drawn in key units (1u ≈ 19 mm), monitors in inches, mice
 * in mm; each category has its own canvas, so only the proportions inside a category matter.
 */
const PX_PER_UNIT: Record<Category, number> = { keyboard: 11, monitor: 7.4, mouse: 1.3 }
const PAD = 16
/** Drawings being rasterised at once: enough to fill a screen in a few frames. */
const DRAWING_LOADS = 3
/**
 * Photos loading at once: enough to fill the canvas fast (a shop's CDN takes up to a second a
 * photo, little of it transfer), few enough to spread the cutting out.
 */
const PHOTO_LOADS = 6
/** Photos fetched at once ahead of the camera, bytes only, on top of those. */
const AHEAD_LOADS = 4

export const shapeOf = (item: CatalogItem): Shape => {
  const box = drawingBox(item)
  const unit = PX_PER_UNIT[item.category]
  return { slug: item.slug, w: box.w * unit, h: box.h * unit, key: glyphKey(item) }
}

type Size = { w: number; h: number; pad: number }

/** `source` drawn at `size` (device px), in a bitmap padded for its shadow. */
function bake(source: CanvasImageSource, size: Size, shadow: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(size.w + size.pad * 2)
  canvas.height = Math.ceil(size.h + size.pad * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  if (shadow) {
    // Shadow parameters ignore the transform: they are in device pixels already.
    ctx.shadowColor = 'rgba(20, 20, 20, 0.16)'
    ctx.shadowBlur = size.pad * 0.75
    ctx.shadowOffsetY = size.pad * 0.3
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, size.pad, size.pad, size.w, size.h)
  return canvas
}

const spriteOf = (w: number, h: number, pad: number, image: HTMLCanvasElement): Sprite => ({
  w,
  h,
  pad,
  image,
  bytes: image.width * image.height * 4,
})

// The load event rather than decode(): a page that is not being drawn (a background tab) can leave
// decode() pending for good.
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Cannot load a drawing'))
    img.src = src
  })
}

/**
 * The canvas's drawings: one bitmap per drawing, shared by every product drawn alike, rasterised
 * when the canvas first draws one of them (two at a time, from the frame loop), then the rest
 * while the page is idle. `resolution` is device px per world px: the device pixel ratio times
 * the largest zoom the canvas draws them at.
 */
export class Drawings {
  private readonly ready = new Map<string, { sprite: Sprite; at: number }>()
  /** A product to draw for each drawing, and its shape. */
  private readonly models = new Map<string, { item: CatalogItem; shape: Shape }>()
  private readonly queue: string[] = []
  private readonly asked = new Set<string>()
  private running = 0
  private idle: number | null = null
  private host: { div: HTMLDivElement; root: Root } | null = null
  private pumping = false
  private disposed = false

  constructor(private readonly resolution: number) {}

  /** Makes a catalogue's drawings available, and shapes its products. */
  register(items: CatalogItem[]): Shape[] {
    return items.map((item) => {
      const shape = shapeOf(item)
      if (!this.models.has(shape.key)) this.models.set(shape.key, { item, shape })
      return shape
    })
  }

  /** The drawing and when it became ready, if it is. */
  get(key: string) {
    return this.ready.get(key)
  }

  /** Asks for a drawing (once): the canvas is about to draw it. */
  want(key: string) {
    if (this.asked.has(key) || !this.models.has(key)) return
    this.asked.add(key)
    this.queue.push(key)
  }

  /**
   * Starts the next rasterisations: called every frame, and as each one ends, so the queue never
   * waits on a frame. Between asks, the rest fills in while the page is idle.
   */
  pump() {
    // In a microtask: a drawing is rendered with flushSync, which React refuses from inside its
    // own work (an effect may be what asks).
    if (this.disposed || this.pumping) return
    this.pumping = true
    queueMicrotask(() => {
      this.pumping = false
      if (this.disposed) return
      while (this.running < DRAWING_LOADS) {
        const key = this.queue.shift()
        if (!key) break
        this.start(key)
      }
      if (!this.queue.length && !this.running) this.prefetch()
    })
  }

  get stats() {
    let bytes = 0
    for (const { sprite } of this.ready.values()) bytes += sprite.bytes
    return { drawings: this.ready.size, of: this.models.size, bytes, queued: this.queue.length }
  }

  /** Every asked drawing is ready. */
  get settled() {
    return !this.queue.length && !this.running
  }

  dispose() {
    this.disposed = true
    if (this.idle != null) cancelIdle(this.idle)
    // Unmounted after React's current work: the canvas goes away inside an effect's cleanup.
    const host = this.host
    this.host = null
    if (host) queueMicrotask(() => host.root.unmount())
  }

  /** Drawings nobody asked for yet, one at a time, while the page has nothing else to do. */
  private prefetch() {
    if (this.idle != null || this.asked.size >= this.models.size) return
    this.idle = onIdle(() => {
      this.idle = null
      for (const key of this.models.keys()) {
        if (this.asked.has(key)) continue
        this.want(key)
        break
      }
      this.pump()
    })
  }

  private start(key: string) {
    const model = this.models.get(key)
    if (!model) return
    this.running++
    const { shape } = model
    const markup = this.markup(model.item, shape)
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
    const r = this.resolution
    void loadImage(url)
      .then((img) => {
        if (this.disposed) return
        const image = bake(img, { w: shape.w * r, h: shape.h * r, pad: PAD * r }, true)
        this.ready.set(key, {
          sprite: spriteOf(shape.w, shape.h, PAD, image),
          at: performance.now(),
        })
      })
      .catch(() => {})
      .finally(() => {
        URL.revokeObjectURL(url)
        this.running--
        this.pump()
      })
  }

  /** The drawing as SVG markup, sized in device px. */
  private markup(item: CatalogItem, shape: Shape) {
    if (!this.host) {
      const div = document.createElement('div')
      this.host = { div, root: createRoot(div) }
    }
    const { div, root } = this.host
    const r = this.resolution
    flushSync(() => {
      root.render(<ProductGlyph item={item} width={shape.w * r} height={shape.h * r} />)
    })
    const svg = div.querySelector('svg')
    return svg ? new XMLSerializer().serializeToString(svg) : ''
  }
}

const onIdle = (run: () => void): number =>
  typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(run, { timeout: 1500 })
    : window.setTimeout(run, 120)

const cancelIdle = (id: number) => {
  if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(id)
  else window.clearTimeout(id)
}

/** Bytes of photo bitmaps the canvas may hold: phones and plain screens get less. */
export const photoBudget = (compact: boolean, dpr: number) => (compact || dpr < 1.5 ? 32e6 : 64e6)

/** How long a photo stays wanted after the canvas last drew its product (ms). */
const WANTED_MS = 4000
/** How long a photo fetched ahead stays wanted after the canvas last neared its product (ms). */
const AHEAD_MS = 1500
/** A photo the canvas has not drawn for this long may be let go when memory runs short (ms). */
const UNSEEN_MS = 2000

type PhotoJob = {
  category: Category
  item: CatalogItem
  photo: Photo
  shape: Shape
  /** The photo width to ask for: the sharpest any drawing of the product needs. */
  width: number
  /** On screen, in px from the middle of it, when last seen: the nearest go first. */
  distance: number
  seen: number
  running: boolean
  attempts: number
  notBefore: number
}

/** A photo fetched ahead of its product coming into view: its bytes only, kept by the worker. */
type AheadJob = Omit<PhotoJob, 'attempts' | 'notBefore'>

type Held = { category: Category; slug: string; sprite: Sprite; width: number; seen: number }

/** A visitor who asked to save data, or on a slow network, gets no photo it has not seen yet. */
function frugal() {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection
  return !!connection && (!!connection.saveData || /2g|3g/.test(connection.effectiveType ?? ''))
}

/**
 * The canvas's photos: fetched for the products it draws (on screen, or a cell away), the nearest
 * the middle of the screen first, at the sharpness they are drawn at (half on the home panels,
 * whole on a canvas), cut out and handed over through `onPhoto` in place of the drawing. Products
 * about to come into view (`ahead`) have their photo's bytes fetched beforehand, so it shows as
 * soon as they do. Those the canvas has stopped drawing are let go once they weigh more than the
 * budget: their product falls back to its drawing and asks again when it comes back. A photo that
 * cannot be fetched is tried twice more; one that is not a square-on cut-out is never asked for
 * again.
 */
export class Photos {
  private readonly jobs = new Map<string, PhotoJob>()
  private readonly aheadJobs = new Map<string, AheadJob>()
  /** Photos whose bytes are in, at the width fetched (`key@width`). */
  private readonly fetched = new Set<string>()
  private readonly held = new Map<string, Held>()
  private readonly unusable = new Set<string>()
  private running = 0
  private fetching = 0
  private bytes = 0
  private disposed = false
  private readonly frugal = frugal()

  constructor(
    private readonly resolution: number,
    private readonly dpr: number,
    private readonly budget: number,
    private readonly onPhoto: (category: Category, slug: string, sprite: Sprite | null) => void,
  ) {}

  /**
   * The canvas drew a product at `scale` screen px per world px, `distance` px from the middle of
   * the screen: its photo is worth having.
   */
  see(category: Category, item: CatalogItem, shape: Shape, scale: number, distance = 0) {
    if (!item.photo) return
    const key = `${category}:${item.slug}`
    if (this.unusable.has(key)) return
    const now = performance.now()
    const width = photoWidthFor(item.photo, shape.w * scale * this.dpr)
    const held = this.held.get(key)
    if (held) {
      held.seen = now
      if (held.width >= width) return
    }
    const job = this.jobs.get(key)
    if (job) {
      job.seen = now
      job.distance = distance
      if (!job.running) job.width = Math.max(job.width, width)
      return
    }
    this.jobs.set(key, {
      category,
      item,
      photo: item.photo,
      shape,
      width,
      distance,
      seen: now,
      running: false,
      attempts: 0,
      notBefore: 0,
    })
  }

  /**
   * A product about to come into view, `distance` px from the middle of the screen: its photo's
   * bytes are fetched now, at the width it will be drawn at, unless the canvas has it already.
   */
  ahead(category: Category, item: CatalogItem, shape: Shape, scale: number, distance: number) {
    if (!item.photo || this.frugal) return
    const key = `${category}:${item.slug}`
    if (this.unusable.has(key) || this.jobs.has(key)) return
    const width = photoWidthFor(item.photo, shape.w * scale * this.dpr)
    if ((this.held.get(key)?.width ?? 0) >= width || this.fetched.has(`${key}@${width}`)) return
    const now = performance.now()
    const job = this.aheadJobs.get(key)
    if (job) {
      job.seen = now
      job.distance = distance
      if (!job.running) job.width = Math.max(job.width, width)
      return
    }
    this.aheadJobs.set(key, {
      category,
      item,
      photo: item.photo,
      shape,
      width,
      distance,
      seen: now,
      running: false,
    })
  }

  /** Starts the next photos, the nearest first, then the ones ahead; lets old ones go if needed. */
  pump() {
    if (this.disposed) return
    const now = performance.now()
    for (const [key, job] of this.jobs) {
      if (!job.running && now - job.seen > WANTED_MS) this.jobs.delete(key)
    }
    for (const [key, job] of this.aheadJobs) {
      if (!job.running && now - job.seen > AHEAD_MS) this.aheadJobs.delete(key)
    }
    while (this.running < PHOTO_LOADS) {
      const next = nearest(this.jobs, (job) => job.notBefore <= now)
      if (!next) break
      void this.run(next[0], next[1])
    }
    while (this.fetching < AHEAD_LOADS) {
      const next = nearest(this.aheadJobs, () => true)
      if (!next) break
      void this.fetch(next[0], next[1])
    }
    this.evict(now)
  }

  /** A product's photo is in, or will not come (none, not square on, unreachable, not wanted). */
  settled(category: Category, slug: string) {
    const key = `${category}:${slug}`
    return this.held.has(key) || this.unusable.has(key) || !this.jobs.has(key)
  }

  get stats() {
    return {
      held: this.held.size,
      bytes: this.bytes,
      budget: this.budget,
      queued: this.jobs.size,
      running: this.running,
      ahead: this.aheadJobs.size,
      fetching: this.fetching,
      fetched: this.fetched.size,
      unusable: this.unusable.size,
    }
  }

  dispose() {
    this.disposed = true
    this.jobs.clear()
    this.aheadJobs.clear()
  }

  private async run(key: string, job: PhotoJob) {
    job.running = true
    this.running++
    try {
      const cut = await cutout(job.photo, job.width)
      this.jobs.delete(key)
      if (this.disposed) return
      if (!cut || !squareOn(job.item, cut)) {
        this.unusable.add(key)
        return
      }
      const { shape } = job
      const h = (shape.w * cut.height) / cut.width
      // No more pixels than the photo has: a photo asked for the home panels stays light.
      const density = Math.min(this.resolution, cut.width / shape.w)
      const size = { w: shape.w * density, h: h * density, pad: PAD * density }
      const sprite = spriteOf(shape.w, h, PAD, bake(cut.image, size, true))
      const before = this.held.get(key)
      this.bytes += sprite.bytes - (before?.sprite.bytes ?? 0)
      this.held.set(key, {
        category: job.category,
        slug: job.item.slug,
        sprite,
        width: job.width,
        seen: job.seen,
      })
      this.onPhoto(job.category, job.item.slug, sprite)
    } catch {
      // Not reachable this time: again a little later, twice at most.
      job.running = false
      job.attempts++
      if (job.attempts > 2) {
        this.jobs.delete(key)
        this.unusable.add(key)
      } else {
        job.notBefore = performance.now() + 2000 * job.attempts
      }
    } finally {
      this.running--
      this.pump()
    }
  }

  /** Fetches the bytes of a photo ahead of its product; the worker keeps them. */
  private async fetch(key: string, job: AheadJob) {
    job.running = true
    this.fetching++
    try {
      await warm(job.photo, job.width)
      this.fetched.add(`${key}@${job.width}`)
    } finally {
      this.aheadJobs.delete(key)
      this.fetching--
      this.pump()
    }
  }

  /** Over budget: the photos drawn longest ago go, and their products show their drawing. */
  private evict(now: number) {
    if (this.bytes <= this.budget) return
    const victims = [...this.held.entries()]
      .filter(([, held]) => now - held.seen > UNSEEN_MS)
      .sort((a, b) => a[1].seen - b[1].seen)
    for (const [key, held] of victims) {
      if (this.bytes <= this.budget * 0.85) break
      this.held.delete(key)
      this.bytes -= held.sprite.bytes
      this.onPhoto(held.category, held.slug, null)
      // Out of sight, so nothing crossfades from it: its memory goes now rather than at the next
      // garbage collection.
      held.sprite.image.width = 0
      held.sprite.image.height = 0
    }
  }
}

/** The job nearest the middle of the screen, among those not running that `ready` lets start. */
function nearest<J extends { running: boolean; distance: number; seen: number }>(
  jobs: Map<string, J>,
  ready: (job: J) => boolean,
): [string, J] | null {
  let next: [string, J] | null = null
  for (const entry of jobs) {
    const job = entry[1]
    if (job.running || !ready(job)) continue
    const best = next?.[1]
    if (
      !best ||
      job.distance < best.distance ||
      (job.distance === best.distance && job.seen > best.seen)
    ) {
      next = entry
    }
  }
  return next
}
