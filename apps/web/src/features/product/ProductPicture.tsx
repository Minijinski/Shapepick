import type { CatalogItem, Photo } from '@choose/catalog'
import { useEffect, useRef, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { ProductGlyph } from './glyphs'
import {
  type Picture,
  photoSrc,
  photoSrcSet,
  photoWidthFor,
  picture,
  readyPicture,
  widthOfSrc,
} from './photo'

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
  /**
   * The page's main picture (a product's sheet): its photo starts downloading with the page's
   * HTML, before the scripts wake up, and is cut out ahead of the canvas's photos.
   */
  preload?: boolean
}

export function ProductPicture({
  item,
  className,
  shadow = 'sm',
  cutoutOnly = false,
  preload = false,
}: Props) {
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
      preload={preload}
    />
  )
}

/**
 * How wide a sheet's picture is, as `sizes` says it, over the share of a shop's photo a product
 * fills (0.75, as `photoWidthFor`): 470 px beside the canvas (a 34rem sheet), the screen's width
 * less 82 px on a phone (ProductDrawer, ProductHero). The browser picks from `photoSrcSet` the
 * file the cut-out will be made from.
 */
const SHEET_SIZES = '(min-width: 48rem) 627px, calc((100vw - 82px) * 1.334)'

/** The photo downloading for the cut-out: there, never seen, never counted as the page's picture. */
const unseen = css({
  position: 'absolute',
  w: '1px',
  h: '1px',
  opacity: 0,
  pointerEvents: 'none',
})

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
  preload = false,
}: Props & { photo: Photo }) {
  const box = useRef<SVGSVGElement & HTMLImageElement>(null)
  const early = useRef<HTMLImageElement>(null)
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
    // The file the page downloads early (a sheet), when it is about as sharp as needed: the cut-out
    // waits for it and reads it from the browser's cache, rather than downloading it a second time.
    const hint = early.current
    const preloaded = hint ? widthOfSrc(hint.currentSrc) : null
    const downloaded =
      hint && !hint.complete
        ? new Promise<void>((resolve) => {
            hint.addEventListener('load', () => resolve(), { once: true })
            hint.addEventListener('error', () => resolve(), { once: true })
          })
        : Promise.resolve()
    const request = (px: number) => {
      const wanted = photoWidthFor(photo, px * Math.min(2, window.devicePixelRatio || 1))
      const width = preloaded && preloaded >= wanted * 0.75 ? preloaded : wanted
      const best = readyPicture(photo)
      if (best) setShown(best)
      if (best && best.source >= width) return
      const bytes = width === preloaded ? downloaded : Promise.resolve()
      void bytes
        .then(() => picture(photo, width, preload))
        .then((made) => {
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
  }, [photo, cutoutOnly, preload])

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
  if (!shown && preload)
    return (
      <>
        <ProductGlyph ref={box} item={item} ghost={plain === null} className={className} />
        <img
          ref={early}
          src={photoSrc(photo, 800, true)}
          srcSet={photoSrcSet(photo)}
          sizes={SHEET_SIZES}
          alt=""
          aria-hidden
          fetchPriority="low"
          decoding="async"
          className={unseen}
        />
      </>
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
