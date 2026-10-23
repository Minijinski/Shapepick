import { isolate } from '@choose/catalog/media'

// Photos are fetched, decoded and cut out here, off the main thread: a large photo takes a flood
// fill over millions of pixels, which would otherwise stall the canvas's drift. The product comes
// back as a bitmap, cropped to it, handed over without a copy. The bytes stay here a while: the
// canvas asks for photos ahead of the camera (`warm`), and asks again for one whose bitmap it let
// go, and neither should wait on the network twice.

/** `warm`: only fetch the bytes and keep them, for a cut-out asked for later. */
export type CutoutAsk = { id: number; url: string; warm?: boolean }

export type CutoutAnswer =
  | {
      id: number
      status: 'ok'
      image: ImageBitmap
      source: number
      fill: number
      parts: number
      detail: number
      symmetry: number
    }
  /** The bytes are in, kept for later. */
  | { id: number; status: 'warm' }
  /** Read, but nothing to cut out (shot in a scene, on a colour). */
  | { id: number; status: 'none' }
  /** The server answered with an error status. */
  | { id: number; status: 'http'; code: number }
  /** No answer (offline, timed out) or unreadable bytes: worth another try later. */
  | { id: number; status: 'error' }

/** Longest a photo may take to arrive before its slot goes to the next one. */
const TIMEOUT_MS = 15_000
/** Bytes of photos kept for later, the ones used longest ago going first. */
const KEPT_BYTES = 24_000_000

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<CutoutAsk>) => void) | null
  postMessage: (message: CutoutAnswer, transfer?: Transferable[]) => void
}

const kept = new Map<string, Blob>()
let keptBytes = 0
/** Fetches under way, so a cut-out asked for while its warm-up runs shares it. */
const fetching = new Map<string, Promise<Blob | number>>()

function keep(url: string, blob: Blob) {
  const before = kept.get(url)
  if (before) keptBytes -= before.size
  kept.delete(url)
  kept.set(url, blob)
  keptBytes += blob.size
  for (const [key, old] of kept) {
    if (keptBytes <= KEPT_BYTES) break
    kept.delete(key)
    keptBytes -= old.size
  }
}

/** The photo's bytes, kept or fetched; a number is the server's error status. */
function bytesOf(url: string): Promise<Blob | number> {
  const known = kept.get(url)
  if (known) {
    // Used again: last to go.
    kept.delete(url)
    kept.set(url, known)
    return Promise.resolve(known)
  }
  let job = fetching.get(url)
  if (!job) {
    job = fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      .then(async (response) => {
        if (!response.ok) return response.status
        const blob = await response.blob()
        keep(url, blob)
        return blob
      })
      .finally(() => fetching.delete(url))
    fetching.set(url, job)
  }
  return job
}

async function cut({ id, url, warm }: CutoutAsk): Promise<CutoutAnswer> {
  const bytes = await bytesOf(url)
  if (typeof bytes === 'number') return { id, status: 'http', code: bytes }
  if (warm) return { id, status: 'warm' }
  const bitmap = await createImageBitmap(bytes)
  const { width: w, height: h } = bitmap
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { id, status: 'error' }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const pixels = ctx.getImageData(0, 0, w, h)
  const box = isolate(pixels)
  if (!box) return { id, status: 'none' }
  const out = new OffscreenCanvas(box.w, box.h)
  out.getContext('2d')?.putImageData(pixels, -box.x, -box.y, box.x, box.y, box.w, box.h)
  return {
    id,
    status: 'ok',
    image: out.transferToImageBitmap(),
    source: w,
    fill: box.area / (box.w * box.h),
    parts: box.parts,
    detail: box.detail,
    symmetry: box.symmetry,
  }
}

scope.onmessage = (event) => {
  const ask = event.data
  void cut(ask)
    .catch((): CutoutAnswer => ({ id: ask.id, status: 'error' }))
    .then((answer) =>
      answer.status === 'ok'
        ? scope.postMessage(answer, [answer.image])
        : scope.postMessage(answer),
    )
}
