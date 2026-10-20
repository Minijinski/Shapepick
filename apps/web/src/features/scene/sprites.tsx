import type { CatalogItem, Category } from '@choose/catalog'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { ProductGlyph } from '../product/glyphs'

// Product silhouettes as bitmaps for the canvas. Every glyph is rendered once in a detached React
// root, serialised and rasterised at the size the canvas will draw it (device pixels included):
// in colour with a soft contact shadow, and as an outline "ghost" for products the answers rule
// out. Drawing a bitmap per frame is what keeps a field of moving products cheap.

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
const PX_PER_UNIT: Record<Category, number> = { keyboard: 11, monitor: 8.6 }
const PAD = 16

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

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

async function rasterize(
  svg: SVGSVGElement,
  size: { w: number; h: number; pad: number },
  shadow: boolean,
) {
  svg.setAttribute('width', String(size.w))
  svg.setAttribute('height', String(size.h))
  const markup = new XMLSerializer().serializeToString(svg)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
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
    ctx.drawImage(img, size.pad, size.pad, size.w, size.h)
    return canvas
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
