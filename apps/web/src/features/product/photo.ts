import type { Photo } from '@choose/catalog'

// Product photos, cut out in the browser. Shops shoot a product on white or a light grey (some
// publish it already cut out), often with company (the switch it ships with, spare keycaps), and
// that white laid on our paper reads as a sheet stuck on another. So each photo is read as it
// comes: the ground reaching its edges becomes transparent, the largest shape left is the product
// (with any shape nearly as large: the other half of a split board), and the photo is cropped to
// it. That is the frame the product's drawing fills, so the callouts and the canvas laid out for
// drawings hold for photos. A photo shot in a scene or on a colour, or that the image CDN does not
// let us read (Shopify's does), leaves the drawing in place.

export type Cutout = {
  /** The product on a transparent ground, cropped to it. */
  canvas: HTMLCanvasElement
  /** Width of the photo it was cut from: what a sharper request has to beat. */
  source: number
  /** Share of its box the product covers: close to 1 seen square on, much less at an angle. */
  fill: number
}

/** A cut-out as an image URL, for an `<img>`. */
export type Picture = { src: string; source: number }

/** How far a channel may stray from the paper's colour and still be paper (JPEG noise). */
const TOLERANCE = 14
/** What passes for photo paper: every channel at least `light`, all within `tint` of each other. */
const PAPER = { light: 215, tint: 16 }
/** A shape at least this share of the largest one's area belongs to the product too. */
const PART = 0.35
/** Below this share of the photo, the largest shape is a speck: nothing to cut out. */
const MIN_SHARE = 0.01

/** The photo resized by the shop's image CDN where it can, never past its own width. */
export function photoSrc(photo: Photo, width: number) {
  const url = new URL(photo.url)
  if (url.hostname !== 'cdn.shopify.com') return photo.url
  url.searchParams.set('width', String(Math.min(width, photo.width ?? width)))
  return url.toString()
}

/**
 * The photo width to ask for so that the product, drawn `px` device pixels wide, stays sharp: shops
 * leave a margin around it. Rounded so that every size shares the CDN's cache.
 */
export function photoWidthFor(photo: Photo, px: number) {
  const width = Math.ceil(px / 0.75 / 200) * 200
  return Math.min(width, photo.width ?? width)
}

/** Photos being cut out, so that two requests for one share the work. */
const cutting = new Map<string, Promise<Cutout | null>>()
/** Photos that turned out not to be cut-outs: not worth another try this session. */
const unusable = new Set<string>()

/**
 * The photo at `width` px, cut out; null if there is nothing to cut out, or if it cannot be read
 * (offline, or a CDN that keeps its pixels to itself: the next request tries again). The bitmaps
 * are not kept: whoever asks keeps what it needs.
 */
export function cutout(photo: Photo, width: number): Promise<Cutout | null> {
  if (unusable.has(photo.url)) return Promise.resolve(null)
  const src = photoSrc(photo, width)
  let job = cutting.get(src)
  if (!job) {
    job = load(src)
      .then((img) => {
        const made = cut(img)
        if (!made) unusable.add(photo.url)
        return made
      })
      .catch(() => null)
      .finally(() => cutting.delete(src))
    cutting.set(src, job)
  }
  return job
}

const pictures = new Map<string, Promise<Picture | null>>()
/** The sharpest picture made so far for each photo, to show at once when it comes back. */
const ready = new Map<string, Picture>()

/** The sharpest cut-out of a photo made so far, if any. */
export const readyPicture = (photo: Photo) => ready.get(photo.url)

/** The photo at `width` px, cut out, as an image URL, once per session; null if it cannot be. */
export function picture(photo: Photo, width: number): Promise<Picture | null> {
  const src = photoSrc(photo, width)
  let job = pictures.get(src)
  if (!job) {
    job = cutout(photo, width).then(async (cut) => {
      const blob =
        cut &&
        (await new Promise<Blob | null>((resolve) =>
          cut.canvas.toBlob(resolve, 'image/webp', 0.92),
        ))
      if (!blob) {
        pictures.delete(src)
        return null
      }
      const made = { src: URL.createObjectURL(blob), source: cut.source }
      const best = ready.get(photo.url)
      if (!best || best.source < made.source) ready.set(photo.url, made)
      return made
    })
    pictures.set(src, job)
  }
  return job
}

// The load event rather than decode(): a page that is not being drawn (a background tab) can leave
// decode() pending for good.
function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Cannot load ${src}`))
    img.src = src
  })
}

function cut(img: HTMLImageElement): Cutout | null {
  const { naturalWidth: w, naturalHeight: h } = img
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  const pixels = ctx.getImageData(0, 0, w, h)
  const box = isolate(pixels)
  if (!box) return null
  const out = document.createElement('canvas')
  out.width = box.w
  out.height = box.h
  out.getContext('2d')?.putImageData(pixels, -box.x, -box.y, box.x, box.y, box.w, box.h)
  return { canvas: out, source: w, fill: box.area / (box.w * box.h) }
}

/** Where the product is in the photo, and how many pixels it covers. */
type Box = { x: number; y: number; w: number; h: number; area: number }

type Rgb = [number, number, number]

/**
 * What the photo was shot on, read on its edges: transparency (it comes cut out), a light neutral
 * colour (a studio white or grey), or anything else (null: a scene, a coloured backdrop).
 */
function paperOf(data: Uint8ClampedArray, w: number, h: number): Rgb | 'clear' | null {
  const reds: number[] = []
  const greens: number[] = []
  const blues: number[] = []
  let clear = 0
  const read = (i: number) => {
    const o = i * 4
    if ((data[o + 3] ?? 0) < 128) {
      clear++
      return
    }
    reds.push(data[o] ?? 0)
    greens.push(data[o + 1] ?? 0)
    blues.push(data[o + 2] ?? 0)
  }
  for (let x = 0; x < w; x++) {
    read(x)
    read((h - 1) * w + x)
  }
  for (let y = 1; y < h - 1; y++) {
    read(y * w)
    read(y * w + w - 1)
  }
  if (clear >= reds.length) return 'clear'
  const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1] ?? 0
  const paper: Rgb = [median(reds), median(greens), median(blues)]
  const light = Math.min(...paper)
  return light >= PAPER.light && Math.max(...paper) - light <= PAPER.tint ? paper : null
}

/**
 * Makes everything but the product transparent and returns its box. The ground is what the photo
 * was shot on, where it reaches the edges; the product, the largest shape left and any shape
 * nearly as large. Pixels on the product's rim are a blend of it and the paper: the paper is taken
 * back out of them, so the edge stays smooth on ours.
 */
function isolate({ data, width: w, height: h }: ImageData): Box | null {
  const paper = paperOf(data, w, h)
  if (!paper) return null
  const n = w * h
  const channel = (o: number) => data[o] ?? 0
  const onPaper = (i: number) => {
    const o = i * 4
    if (channel(o + 3) < 128) return true
    return (
      paper !== 'clear' &&
      Math.abs(channel(o) - paper[0]) <= TOLERANCE &&
      Math.abs(channel(o + 1) - paper[1]) <= TOLERANCE &&
      Math.abs(channel(o + 2) - paper[2]) <= TOLERANCE
    )
  }

  // The ground: a flood fill of the paper from the edges.
  const ground = new Uint8Array(n)
  const queue = new Int32Array(n)
  let head = 0
  let tail = 0
  const flood = (i: number) => {
    if (ground[i] || !onPaper(i)) return
    ground[i] = 1
    queue[tail++] = i
  }
  for (let x = 0; x < w; x++) {
    flood(x)
    flood((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    flood(y * w)
    flood(y * w + w - 1)
  }
  // Less than half of the edges on paper: the product fills the photo, nothing to cut out.
  if (tail < w + h) return null
  while (head < tail) {
    const i = queue[head++] ?? 0
    const x = i % w
    if (x > 0) flood(i - 1)
    if (x < w - 1) flood(i + 1)
    if (i >= w) flood(i - w)
    if (i < n - w) flood(i + w)
  }

  // The shapes left on it, each with its area and box.
  const label = new Int32Array(n)
  const shapes: { size: number; x0: number; y0: number; x1: number; y1: number }[] = []
  for (let start = 0; start < n; start++) {
    if (ground[start] || label[start]) continue
    const id = shapes.length + 1
    const shape = { size: 0, x0: w, y0: h, x1: 0, y1: 0 }
    head = 0
    tail = 0
    label[start] = id
    queue[tail++] = start
    const join = (i: number) => {
      if (ground[i] || label[i]) return
      label[i] = id
      queue[tail++] = i
    }
    while (head < tail) {
      const i = queue[head++] ?? 0
      const x = i % w
      const y = (i - x) / w
      shape.size++
      if (x < shape.x0) shape.x0 = x
      if (x > shape.x1) shape.x1 = x
      if (y < shape.y0) shape.y0 = y
      if (y > shape.y1) shape.y1 = y
      if (x > 0) join(i - 1)
      if (x < w - 1) join(i + 1)
      if (i >= w) join(i - w)
      if (i < n - w) join(i + w)
    }
    shapes.push(shape)
  }
  const largest = Math.max(0, ...shapes.map((s) => s.size))
  if (largest < n * MIN_SHARE) return null
  const kept = new Uint8Array(shapes.length + 1)
  let x0 = w
  let y0 = h
  let x1 = 0
  let y1 = 0
  let area = 0
  shapes.forEach((s, k) => {
    if (s.size < largest * PART) return
    kept[k + 1] = 1
    area += s.size
    x0 = Math.min(x0, s.x0)
    y0 = Math.min(y0, s.y0)
    x1 = Math.max(x1, s.x1)
    y1 = Math.max(y1, s.y1)
  })

  const product = (i: number) => kept[label[i] ?? 0] === 1
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x
      const o = i * 4
      if (!product(i)) {
        data[o + 3] = 0
        continue
      }
      const rim =
        (x > 0 && !product(i - 1)) ||
        (x < w - 1 && !product(i + 1)) ||
        (y > 0 && !product(i - w)) ||
        (y < h - 1 && !product(i + w))
      // A photo that comes cut out has its rim blended already.
      if (!rim || paper === 'clear' || channel(o + 3) < 255) continue
      // Over the paper, this pixel is its colour at some opacity: the lowest one that explains it.
      let a = 0
      for (let c = 0; c < 3; c++) {
        const p = channel(o + c)
        const q = paper[c] ?? 255
        a = Math.max(a, p < q ? (q - p) / q : p > q ? (p - q) / (255 - q) : 0)
      }
      data[o + 3] = a * 255
      if (!a) continue
      for (let c = 0; c < 3; c++) {
        const q = paper[c] ?? 255
        data[o + c] = q + (channel(o + c) - q) / a
      }
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, area }
}
