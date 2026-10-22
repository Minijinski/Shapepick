import { isolate } from '@choose/catalog/media'

// Photos are fetched, decoded and cut out here, off the main thread: a large photo takes a flood
// fill over millions of pixels, which would otherwise stall the canvas's drift. The product comes
// back as a bitmap, cropped to it, handed over without a copy.

export type CutoutAsk = { id: number; url: string }

export type CutoutAnswer =
  | { id: number; status: 'ok'; image: ImageBitmap; source: number; fill: number }
  /** Read, but nothing to cut out (shot in a scene, on a colour). */
  | { id: number; status: 'none' }
  /** The server answered with an error status. */
  | { id: number; status: 'http'; code: number }
  /** No answer (offline, timed out) or unreadable bytes: worth another try later. */
  | { id: number; status: 'error' }

/** Longest a photo may take to arrive before its slot goes to the next one. */
const TIMEOUT_MS = 15_000

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<CutoutAsk>) => void) | null
  postMessage: (message: CutoutAnswer, transfer?: Transferable[]) => void
}

async function cut({ id, url }: CutoutAsk): Promise<CutoutAnswer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) return { id, status: 'http', code: response.status }
  const bitmap = await createImageBitmap(await response.blob())
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
