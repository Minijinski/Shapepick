import type { CatalogItem, Category } from '@choose/catalog'
import { drawingBox } from '@choose/catalog/media'
import { css } from 'styled-system/css'
import { ProductPicture } from '../product/ProductPicture'
import { photoWidthFor, picture, readyPicture } from '../product/photo'

// The product an option brings forward, pictured in its tile: the best match it keeps given the
// other answers, so the tiles show real devices and change as the answers do. It sits at the
// tile's right without making the tile any taller (see `[data-pictured]` in styles.css). Where the
// question is about size (a keyboard's format, a monitor's diagonal), the pictures keep the
// products' real proportions to one another, as the drawings they replace did. The photos of the
// next question's tiles are cut out ahead (`warmExamples`), so a tile shows its photo from its
// first frame rather than its drawing while the photo comes.

/** The question of each category whose tiles compare sizes: its pictures stay to scale. */
const SCALED: Partial<Record<Category, string>> = { keyboard: 'size', monitor: 'format' }
/** The smallest a picture to scale may get, as a share of the widest one: it stays readable. */
const MIN_SCALE = 0.4

/** How wide each option's picture is drawn (0 … 1 of its place): all 1 but on a size question. */
export function examplesScale(
  category: Category,
  stepKey: string,
  examples: Map<string, CatalogItem> | null,
): Map<string, number> {
  const scale = new Map<string, number>()
  if (!examples || SCALED[category] !== stepKey) return scale
  const widths = new Map([...examples].map(([id, item]) => [id, drawingBox(item).w]))
  const widest = Math.max(...widths.values())
  for (const [id, w] of widths) scale.set(id, Math.max(MIN_SCALE, w / widest))
  return scale
}

/**
 * How wide an option's picture is drawn at most (CSS px), as styles.css lays tiles out
 * (`[data-pictured]`): a phone's row, a card (two or three answers), or a tile.
 */
const tileWidth = (card: boolean) => (window.innerWidth < 768 ? 56 : card ? 208 : 112)

/**
 * Has these products' photos fetched and cut out now, as sharp as a tile draws them (`card`: two
 * or three answers, each a card), for tiles about to show them.
 */
export function warmExamples(items: readonly CatalogItem[], card: boolean) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  for (const item of items) {
    if (!item.photo) continue
    const width = photoWidthFor(item.photo, tileWidth(card) * dpr)
    if ((readyPicture(item.photo)?.source ?? 0) >= width) continue
    void picture(item.photo, width)
  }
}

const fit = css({ w: '100%', h: '100%' })

export function OptionExample({ item, scale = 1 }: { item: CatalogItem; scale?: number }) {
  return (
    <span aria-hidden data-example>
      <span
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          h: '100%',
        })}
        style={{ width: `${Math.round(scale * 100)}%` }}
      >
        <ProductPicture item={item} className={fit} cutoutOnly />
      </span>
    </span>
  )
}
