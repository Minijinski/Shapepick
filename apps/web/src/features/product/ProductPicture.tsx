import type { CatalogItem, Photo } from '@choose/catalog'
import { useEffect, useRef, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { ProductGlyph } from './glyphs'
import { type Picture, photoSrc, photoWidthFor, picture, readyPicture } from './photo'

// A product as the visitor should see it: its photo, cut out, when it has one; the photo as the
// shop shot it when it cannot be cut out (a scene, a coloured backdrop): the product itself still
// beats its drawing. The drawing otherwise: sketched while the photo is on its way, in colour if
// the photo cannot be read at all. One element either way, sized by the same classes and centred
// at the largest size that fits, so any place that showed the drawing can show the photo.

type Props = {
  item: CatalogItem
  className?: string
  /** Larger pictures cast a larger shadow on the paper. */
  shadow?: 'sm' | 'lg'
  /**
   * Small pictures among others (an option's tile): a photo that cannot be cut out shows the
   * drawing rather than its backdrop, which would read as a sticker among cut-outs.
   */
  cutoutOnly?: boolean
}

export function ProductPicture({ item, className, shadow = 'sm', cutoutOnly = false }: Props) {
  if (!item.photo) return <ProductGlyph item={item} className={className} />
  // Another product's photo starts afresh, never on the previous one.
  return (
    <Photographed
      key={item.photo.url}
      item={item}
      photo={item.photo}
      className={className}
      shadow={shadow}
      cutoutOnly={cutoutOnly}
    />
  )
}

const shadows = {
  sm: css({ filter: 'drop-shadow(0 1px 1.5px rgba(20, 20, 20, 0.16))' }),
  lg: css({ filter: 'drop-shadow(0 6px 8px rgba(20, 20, 20, 0.14))' }),
}

function Photographed({
  item,
  photo,
  className,
  shadow = 'sm',
  cutoutOnly = false,
}: Props & { photo: Photo }) {
  const box = useRef<SVGSVGElement & HTMLImageElement>(null)
  // A photo already cut out this session shows at once.
  const [shown, setShown] = useState<Picture | null>(() =>
    typeof window === 'undefined' ? null : (readyPicture(photo) ?? null),
  )
  /** The photo uncut, once it turns out it cannot be cut out; '' if even that fails to load. */
  const [plain, setPlain] = useState<string | null>(null)

  // The photo is fetched at the size it is shown, once it is shown (a hidden one has no size yet).
  useEffect(() => {
    const el = box.current
    if (!el) return
    let live = true
    const request = (px: number) => {
      const width = photoWidthFor(photo, px * Math.min(2, window.devicePixelRatio || 1))
      const best = readyPicture(photo)
      if (best) setShown(best)
      if (best && best.source >= width) return
      void picture(photo, width).then((made) => {
        if (!live) return
        if (made) setShown(made)
        else if (!best) setPlain(cutoutOnly ? '' : photoSrc(photo, width))
      })
    }
    const sized = new ResizeObserver(([entry]) => {
      const px = entry?.contentRect.width ?? 0
      if (!px) return
      sized.disconnect()
      request(px)
    })
    sized.observe(el)
    return () => {
      live = false
      sized.disconnect()
    }
  }, [photo, cutoutOnly])

  if (!shown && plain)
    return (
      <img
        src={plain}
        alt={`${item.brand.name} ${item.name}`}
        draggable={false}
        onError={() => setPlain('')}
        className={cx(
          className,
          shadows[shadow],
          css({
            objectFit: 'contain',
            animation: 'fadeIn 0.4s ease backwards',
            _motionReduce: { animation: 'none' },
          }),
        )}
      />
    )
  if (!shown)
    return <ProductGlyph ref={box} item={item} ghost={plain === null} className={className} />
  return (
    <img
      ref={box}
      src={shown.src}
      alt={`${item.brand.name} ${item.name}`}
      draggable={false}
      className={cx(
        className,
        shadows[shadow],
        css({
          objectFit: 'contain',
          animation: 'fadeIn 0.4s ease backwards',
          _motionReduce: { animation: 'none' },
        }),
      )}
    />
  )
}
