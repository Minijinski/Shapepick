import type { CatalogItem, Category, Photo } from '@choose/catalog'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { ProductGlyph } from '../product/glyphs'
import { type Cutout, cutout, photoWidthFor } from '../product/photo'

// Products as bitmaps for the canvas. Every glyph is rendered once in a detached React root,
// serialised and rasterised at the size the canvas will draw it (device pixels included): in
// colour with a soft contact shadow, and as an outline "ghost" for products the answers rule out.
// Products that have a photo get it once the canvas draws them, cut out, in place of the coloured
// drawing, if it shows them the way the canvas draws them. Drawing a bitmap per frame is what keeps
// a field of moving products cheap.

export type Sprite = {
  /** Size of the product itself in world px (CSS px at zoom 1), shadow padding excluded. */
  w: number
  h: number
  /** Padding baked around the product for its shadow, in world px. */
  pad: number
  color: HTMLCanvasElement
  ghost: HTMLCanvasElement
}

/**
 * World px per glyph unit. Keyboards are drawn in key units (1u ≈ 19 mm), monitors in inches;
 * each category has its own canvas, so only the proportions inside a category matter.
 */
const PX_PER_UNIT: Record<Category, number> = { keyboard: 11, monitor: 7.4 }
const PAD = 16
/** Photos loading at once: enough to fill the canvas fast, few enough to spread the cutting out. */
const PHOTO_LOADS = 4
/**
 * How far a photo's proportions may stray from its drawing's (photo over drawing). Measured on the
 * shops' photos: top views land within 0.7–1.15; shots from a low angle, or with a mouse alongside,
 * beyond. Split and Alice drawings only sketch their shape, so their proportions are not checked.
 */
const PROPORTIONS = { min: 0.7, max: 1.15 }
/** Share of its box a keyboard seen from above covers at least: a tilted one leaves its corners. */
const MIN_FILL = 0.8

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

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

function renderGlyphs(items: CatalogItem[]) {
  const host = document.createElement('div')
  const root = createRoot(host)
  flushSync(() => {
    root.render(
      items.map((item) => (
        <div key={item.slug} data-slug={item.slug}>
          <ProductGlyph item={item} />
          <ProductGlyph item={item} ghost />
        </div>
      )),
    )
  })
  const glyphs = new Map<string, [SVGSVGElement, SVGSVGElement]>()
  for (const div of Array.from(host.children)) {
    const [color, ghost] = Array.from(div.querySelectorAll('svg'))
    const slug = (div as HTMLElement).dataset.slug
    if (slug && color && ghost) glyphs.set(slug, [color, ghost])
  }
  return { glyphs, dispose: () => root.unmount() }
}

async function rasterize(svg: SVGSVGElement, size: Size, shadow: boolean) {
  svg.setAttribute('width', String(size.w))
  svg.setAttribute('height', String(size.h))
  const markup = new XMLSerializer().serializeToString(svg)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return bake(img, size, shadow)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Rasterises a category's products. `resolution` is device px per world px: the device pixel
 * ratio times the largest zoom the canvas will draw them at.
 */
export async function buildSprites(
  category: Category,
  items: CatalogItem[],
  resolution: number,
): Promise<Map<string, Sprite>> {
  await nextTask()
  const { glyphs, dispose } = renderGlyphs(items)
  const sprites = new Map<string, Sprite>()
  try {
    await Promise.all(
      [...glyphs].map(async ([slug, [color, ghost]]) => {
        const [, , vw = 1, vh = 1] = (color.getAttribute('viewBox') ?? '0 0 1 1')
          .split(/\s+/)
          .map(Number)
        const w = vw * PX_PER_UNIT[category]
        const h = vh * PX_PER_UNIT[category]
        const size = { w: w * resolution, h: h * resolution, pad: PAD * resolution }
        const [colorBitmap, ghostBitmap] = await Promise.all([
          rasterize(color, size, true),
          rasterize(ghost, size, false),
        ])
        sprites.set(slug, { w, h, pad: PAD, color: colorBitmap, ghost: ghostBitmap })
      }),
    )
  } finally {
    dispose()
  }
  return sprites
}

/**
 * Whether a photo shows its product as the canvas draws products, square on (a keyboard from above,
 * a monitor from the front), with nothing alongside. Other shots keep the drawing.
 */
function squareOn(item: CatalogItem, cut: Cutout, drawn: Sprite) {
  if (item.category === 'keyboard') {
    if (cut.fill < MIN_FILL) return false
    if (item.specs.formFactor === 'split' || item.specs.formFactor === 'alice') return true
  }
  const ratio = cut.canvas.width / cut.canvas.height / (drawn.w / drawn.h)
  return ratio >= PROPORTIONS.min && ratio <= PROPORTIONS.max
}

export type PhotoLoader = {
  /** Asks for a product's photo (once; a product without one is ignored). */
  want: (category: Category, item: CatalogItem, drawn: Sprite) => void
  dispose: () => void
}

/**
 * Fetches photos as the canvas asks for them, a few at a time, in the order asked. Each product's
 * photo becomes a bitmap, cut out, as wide as its drawing and as tall as the photo says, handed
 * over through `onSprite` to replace the drawing. A ruled-out product keeps its drawing's outline
 * as its sketch; without a readable, square-on photo, the drawing stays.
 */
export function photoLoader(
  resolution: number,
  onSprite: (category: Category, slug: string, sprite: Sprite) => void,
): PhotoLoader {
  const asked = new Set<string>()
  const queue: { category: Category; item: CatalogItem; photo: Photo; drawn: Sprite }[] = []
  let running = 0
  let disposed = false
  const pump = () => {
    while (!disposed && running < PHOTO_LOADS) {
      const job = queue.shift()
      if (!job) return
      running++
      const { category, item, photo, drawn } = job
      void cutout(photo, photoWidthFor(photo, drawn.w * resolution)).then((cut) => {
        running--
        if (cut && !disposed && squareOn(item, cut, drawn)) {
          const h = (drawn.w * cut.canvas.height) / cut.canvas.width
          const size = { w: drawn.w * resolution, h: h * resolution, pad: drawn.pad * resolution }
          onSprite(category, item.slug, { ...drawn, h, color: bake(cut.canvas, size, true) })
        }
        pump()
      })
    }
  }
  return {
    want(category, item, drawn) {
      const key = `${category}:${item.slug}`
      if (!item.photo || asked.has(key)) return
      asked.add(key)
      queue.push({ category, item, photo: item.photo, drawn })
      pump()
    },
    dispose() {
      disposed = true
      queue.length = 0
    },
  }
}
