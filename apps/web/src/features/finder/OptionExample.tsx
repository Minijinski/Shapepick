import type { CatalogItem, Category } from '@choose/catalog'
import { drawingBox } from '@choose/catalog/media'
import { css } from 'styled-system/css'
import { ProductPicture } from '../product/ProductPicture'

// The product an option brings forward, pictured in its tile: the best match it keeps given the
// other answers, so the tiles show real devices and change as the answers do. It sits at the
// tile's right without making the tile any taller (see `[data-pictured]` in styles.css). Where the
// question is about size (a keyboard's format, a monitor's diagonal), the pictures keep the
// products' real proportions to one another, as the drawings they replace did.

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
