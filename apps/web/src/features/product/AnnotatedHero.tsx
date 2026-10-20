import type { CatalogItem, Locale } from '@choose/catalog'
import { css } from 'styled-system/css'
import { ProductGlyph } from './glyphs'
import { keySpecs } from './specs'

// A product drawn like a spec drawing. Given room (40rem and more), its key specs sit on either
// side, joined to points on the drawing by leader lines; narrower (a phone, the product sheet),
// the points are numbered and the specs follow as a numbered legend. The width that counts is
// the hero's own, not the screen's. Dots, lines and callouts carry data attributes so the parent
// can draw them in.

/** Anchor points on the drawing (in % of its box) and the side their callout sits on. */
const anchors = [
  { x: 24, y: 30, side: 'left' },
  { x: 34, y: 74, side: 'left' },
  { x: 76, y: 26, side: 'right' },
  { x: 66, y: 70, side: 'right' },
] as const

const label = css({
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

export function AnnotatedHero({ item, locale }: { item: CatalogItem; locale: Locale }) {
  const specs = keySpecs(item, locale)
  const callout = (side: 'left' | 'right') =>
    specs.map((spec, i) => {
      const a = anchors[i]
      if (!a || a.side !== side) return null
      return (
        <figcaption
          key={spec.label}
          data-callout
          className={css({
            position: 'absolute',
            insetInline: '0',
            display: 'grid',
            gap: '0.5',
            fontSize: 'sm',
            transform: 'translateY(-100%)',
            pb: '1.5',
          })}
          style={{ top: `${a.y - 8}%`, textAlign: side === 'left' ? 'left' : 'right' }}
        >
          <span className={label}>{spec.label}</span>
          <span className={css({ fontWeight: '600', lineHeight: '1.25' })}>{spec.value}</span>
        </figcaption>
      )
    })
  const column = css({
    position: 'relative',
    display: 'none',
    '@container (min-width: 40rem)': { display: 'block' },
  })

  return (
    <div className={css({ containerType: 'inline-size' })}>
      <div className={css({ display: 'grid', gap: '4' })}>
        <figure
          className={css({
            display: 'grid',
            gridTemplateColumns: '1fr',
            h: '44',
            '@container (min-width: 40rem)': { gridTemplateColumns: '11rem 1fr 11rem', h: '64' },
          })}
        >
          <div className={column}>{callout('left')}</div>
          <div className={css({ position: 'relative' })}>
            <div
              className={css({
                position: 'absolute',
                inset: '0',
                display: 'grid',
                placeItems: 'center',
                p: '4',
              })}
            >
              <ProductGlyph item={item} className={css({ w: '100%', h: '100%' })} />
            </div>
            {/* Percent coordinates without a viewBox keep the strokes one pixel wide at any size. */}
            <svg
              className={css({
                position: 'absolute',
                inset: '0',
                w: '100%',
                h: '100%',
                overflow: 'visible',
                display: 'none',
                '@container (min-width: 40rem)': { display: 'block' },
              })}
              aria-hidden
            >
              {specs.map((spec, i) => {
                const a = anchors[i]
                if (!a) return null
                const elbow = a.side === 'left' ? a.x - 6 : a.x + 6
                const edge = a.side === 'left' ? 0 : 100
                return (
                  <g key={spec.label} stroke="#141414" strokeWidth={1}>
                    <line
                      data-leader
                      pathLength={1}
                      strokeDasharray={1}
                      x1={`${a.x}%`}
                      y1={`${a.y}%`}
                      x2={`${elbow}%`}
                      y2={`${a.y - 8}%`}
                    />
                    <line
                      data-leader
                      pathLength={1}
                      strokeDasharray={1}
                      x1={`${elbow}%`}
                      y1={`${a.y - 8}%`}
                      x2={`${edge}%`}
                      y2={`${a.y - 8}%`}
                    />
                  </g>
                )
              })}
            </svg>
            {specs.map((spec, i) => {
              const a = anchors[i]
              return a ? (
                <span
                  key={spec.label}
                  data-leader-dot
                  className={css({
                    position: 'absolute',
                    w: '2',
                    h: '2',
                    ml: '-1',
                    mt: '-1',
                    borderRadius: 'full',
                    bg: 'signal',
                    boxShadow: '0 0 0 3px rgba(255, 90, 31, 0.18)',
                  })}
                  style={{ left: `${a.x}%`, top: `${a.y}%` }}
                >
                  <span
                    aria-hidden
                    className={css({
                      position: 'absolute',
                      left: '3',
                      bottom: '2',
                      px: '1',
                      py: '0.5',
                      borderRadius: 'pill',
                      bg: 'surface.raised',
                      boxShadow: '0 0 0 1px token(colors.line)',
                      fontFamily: 'mono',
                      fontSize: '2xs',
                      lineHeight: '1',
                      color: 'ink',
                      '@container (min-width: 40rem)': { display: 'none' },
                    })}
                  >
                    {i + 1}
                  </span>
                </span>
              ) : null
            })}
          </div>
          <div className={column}>{callout('right')}</div>
        </figure>
        <dl
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            columnGap: '4',
            rowGap: '3',
            '@container (min-width: 40rem)': { display: 'none' },
          })}
        >
          {specs.map((spec, i) => (
            <div key={spec.label} className={css({ display: 'grid', gap: '0.5' })}>
              <dt className={css({ display: 'flex', gap: '1.5' })}>
                <span className={css({ fontFamily: 'mono', fontSize: '2xs', color: 'signal' })}>
                  {i + 1}
                </span>
                <span className={label}>{spec.label}</span>
              </dt>
              <dd className={css({ fontSize: 'sm', fontWeight: '600', lineHeight: '1.3' })}>
                {spec.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
