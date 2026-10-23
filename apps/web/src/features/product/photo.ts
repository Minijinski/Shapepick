import type { Photo } from '@choose/catalog'
import { atWidth, isolate } from '@choose/catalog/media'
import type { CutoutAnswer, CutoutAsk } from './cutout.worker'
import { isShopPhoto, relayed, relayOf } from './hosts'

// Product photos, cut out in the browser. Shops shoot a product on white or a light grey (some
// publish it already cut out), often with company, and that white laid on our paper reads as a
// sheet stuck on another. So each photo is cut out as it comes (see `cutout.ts`), and cropped to
// the product: that is the frame the product's drawing fills, so the callouts and the canvas laid
// out for drawings hold for photos. A photo shot in a scene or on a colour leaves the drawing in
// place.
//
// Photos come through the image CDN on our own domain: it resizes every shop's photos to the size
// shown (some publish 4 MB PNGs), and serves them from our origin, so their pixels can be read
// whatever the shop's CDN allows. The cutting out runs in a worker, off the main thread.

export type Cutout = {
  /** The product on a transparent ground, cropped to it. */
  image: ImageBitmap | HTMLCanvasElement
  width: number
  height: number
  /** Width of the photo it was cut from: what a sharper request has to beat. */
  source: number
  /** Share of its box the product covers: close to 1 seen square on, much less at an angle. */
  fill: number
  /** Separate shapes that make it: two for a split board, more for several products. */
  parts: number
  /** Share of its pixels on an edge: keycaps give plenty, the underside of a case hardly any. */
  detail: number
  /** How much its mirror image covers it: about 1 for a monitor seen from the front. */
  symmetry: number
}

/** A cut-out as an image URL, for an `<img>`. */
export type Picture = { src: string; source: number }

/** A photo that could not be fetched this time (offline, timed out): a later try may work. */
export class PhotoUnavailable extends Error {}

/** Whether the image CDN answers here (not on a second dev server without Netlify's emulation). */
let proxied = true

/**
 * The photo straight from the shop, resized by its CDN where it can be (Shopify, Cloudinary, the
 * monitor brands' Scene7, Sanity, ASUS): a thumbnail's URL (Corsair's `w_96`) asked for at the
 * width shown, or the photo stays a blur however large it is drawn.
 */
const direct = (photo: Photo, width: number) => atWidth(photo.url, width)

/**
 * The shop's original photo where its CDN wraps it in its own URL (Razer's resizer carries the
 * original, encoded, in its path): the image CDN fetches the original directly. Where the shop's
 * CDN resizes, it is asked for the width wanted (an ASUS original weighs 3 MB).
 */
function original(url: string, width: number) {
  const wrapped = /^https:\/\/assets3\.razerzone\.com\/[^/]+\/\d+x\d+\/(https%3A%2F%2F.+)$/.exec(
    url,
  )
  return wrapped?.[1] ? decodeURIComponent(wrapped[1]) : atWidth(url, width)
}

/**
 * The photo at `width` px (never past its own width), from the image CDN on our domain. A shop
 * whose CDN forbids keeping its photos is fetched through our own route (see `hosts.ts`), which
 * also stands in for the image CDN where there is none (a second dev server): every shop's photo
 * then comes from our origin, so its pixels stay readable whatever the shop allows.
 */
export function photoSrc(photo: Photo, width: number, through = proxied) {
  const w = Math.min(width, photo.width ?? width)
  const source = original(photo.url, w)
  if (!through) return isShopPhoto(source) ? relayOf(source) : direct(photo, w)
  return `/.netlify/images?url=${encodeURIComponent(relayed(source) ?? source)}&w=${w}&fm=webp&q=90`
}

/**
 * The photo width to ask for so that the product, drawn `px` device pixels wide, stays sharp: shops
 * leave a margin around it. Rounded so that every size shares the CDN's cache.
 */
export function photoWidthFor(photo: Photo, px: number) {
  const width = Math.ceil(px / 0.75 / 200) * 200
  return Math.min(width, photo.width ?? width)
}

// ---- Where the cutting out happens -------------------------------------------------------------

type Answer =
  | CutoutAnswer
  | {
      id: number
      status: 'ok'
      image: HTMLCanvasElement
      source: number
      fill: number
      parts: number
      detail: number
      symmetry: number
    }

let worker: Worker | null | undefined
let asked = 0
const waiting = new Map<number, (answer: Answer) => void>()

/** The cut-out worker, started on first use; null where workers cannot draw (main thread then). */
function workerOf() {
  if (worker !== undefined) return worker
  worker = null
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return worker
  try {
    const started = new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module' })
    started.onmessage = (event: MessageEvent<CutoutAnswer>) => {
      const resolve = waiting.get(event.data.id)
      waiting.delete(event.data.id)
      resolve?.(event.data)
    }
    // A worker that cannot start or draw: everything waiting is retried on the main thread.
    started.onerror = () => giveUpWorker()
    worker = started
  } catch {
    worker = null
  }
  return worker
}

function giveUpWorker() {
  worker?.terminate()
  worker = null
  for (const [id, resolve] of waiting) resolve({ id, status: 'error' })
  waiting.clear()
}

function ask(src: string): Promise<Answer> {
  const w = workerOf()
  if (!w) return cutHere(src)
  const id = ++asked
  return new Promise((resolve) => {
    waiting.set(id, resolve)
    w.postMessage({ id, url: src } satisfies CutoutAsk)
  })
}

/** Photos whose bytes the worker was asked to fetch ahead, at a given width. */
const warmed = new Set<string>()

/**
 * Fetches a photo's bytes ahead of time, before its product comes into view: the worker keeps
 * them, so cutting it out then needs no network. Resolves once done, whatever the outcome; does
 * nothing without a worker (the main thread has enough to do).
 */
export function warm(photo: Photo, width: number): Promise<void> {
  const key = `${photo.url}@${width}`
  const w = workerOf()
  if (!w || warmed.has(key) || unusable.has(photo.url)) return Promise.resolve()
  warmed.add(key)
  const id = ++asked
  return new Promise((resolve) => {
    waiting.set(id, () => resolve())
    w.postMessage({ id, url: photoSrc(photo, width), warm: true } satisfies CutoutAsk)
  })
}

// The load event rather than decode(): a page that is not being drawn (a background tab) can leave
// decode() pending for good.
function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    const timer = window.setTimeout(() => reject(new Error('timeout')), 15_000)
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error(`Cannot load ${src}`))
    }
    img.src = src
  })
}

/** The same work on the main thread, where workers cannot draw. */
async function cutHere(src: string): Promise<Answer> {
  let img: HTMLImageElement
  try {
    img = await load(src)
  } catch {
    return { id: 0, status: 'error' }
  }
  const { naturalWidth: w, naturalHeight: h } = img
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { id: 0, status: 'error' }
  ctx.drawImage(img, 0, 0)
  let pixels: ImageData
  try {
    pixels = ctx.getImageData(0, 0, w, h)
  } catch {
    // A CDN that keeps its pixels to itself: nothing to cut out from here.
    return { id: 0, status: 'none' }
  }
  const box = isolate(pixels)
  if (!box) return { id: 0, status: 'none' }
  const out = document.createElement('canvas')
  out.width = box.w
  out.height = box.h
  out.getContext('2d')?.putImageData(pixels, -box.x, -box.y, box.x, box.y, box.w, box.h)
  return {
    id: 0,
    status: 'ok',
    image: out,
    source: w,
    fill: box.area / (box.w * box.h),
    parts: box.parts,
    detail: box.detail,
    symmetry: box.symmetry,
  }
}

// ---- Cut-outs ----------------------------------------------------------------------------------

/** Photos being cut out, so that two requests for one share the work. */
const cutting = new Map<string, Promise<Cutout | null>>()
/** Photos that turned out not to be cut-outs: not worth another try this session. */
const unusable = new Set<string>()

async function cutFrom(photo: Photo, width: number, through: boolean): Promise<Cutout | null> {
  const answer = await ask(photoSrc(photo, width, through))
  if (answer.status === 'ok') {
    const { image, source, fill, parts, detail, symmetry } = answer
    return {
      image,
      width: image.width,
      height: image.height,
      source,
      fill,
      parts,
      detail,
      symmetry,
    }
  }
  if (answer.status === 'none') {
    unusable.add(photo.url)
    return null
  }
  if (answer.status === 'http' && through && (answer.code === 403 || answer.code === 404)) {
    // No image CDN here (404: a second dev server), or a shop it is not allowed to fetch from
    // (403): straight from the shop, for every photo after a 404.
    if (answer.code === 404) proxied = false
    return cutFrom(photo, width, false)
  }
  if (answer.status === 'http' && answer.code >= 400 && answer.code < 500 && answer.code !== 429) {
    unusable.add(photo.url)
    return null
  }
  throw new PhotoUnavailable(photo.url)
}

/**
 * The photo at `width` px, cut out; null if there is nothing to cut out. Rejects with
 * `PhotoUnavailable` when it cannot be fetched this time. The bitmaps are not kept: whoever asks
 * keeps what it needs.
 */
export function cutout(photo: Photo, width: number): Promise<Cutout | null> {
  if (unusable.has(photo.url)) return Promise.resolve(null)
  const key = `${photo.url}@${width}`
  let job = cutting.get(key)
  if (!job) {
    job = cutFrom(photo, width, proxied).finally(() => cutting.delete(key))
    cutting.set(key, job)
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
  const key = `${photo.url}@${width}`
  let job = pictures.get(key)
  if (!job) {
    job = cutout(photo, width)
      .then(async (cut) => {
        if (!cut) return null
        let canvas: HTMLCanvasElement
        if (cut.image instanceof HTMLCanvasElement) {
          canvas = cut.image
        } else {
          canvas = document.createElement('canvas')
          canvas.width = cut.width
          canvas.height = cut.height
          canvas.getContext('2d')?.drawImage(cut.image, 0, 0)
        }
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/webp', 0.92),
        )
        if (!blob) return null
        const made = { src: URL.createObjectURL(blob), source: cut.source }
        const best = ready.get(photo.url)
        if (!best || best.source < made.source) ready.set(photo.url, made)
        return made
      })
      .catch(() => null)
      .then((made) => {
        // Nothing made (offline, not a cut-out): a later visit may ask again.
        if (!made) pictures.delete(key)
        return made
      })
    pictures.set(key, job)
  }
  return job
}
