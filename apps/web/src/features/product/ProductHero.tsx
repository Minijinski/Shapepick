import type { CatalogItem, Locale } from '@choose/catalog'
import { css } from 'styled-system/css'
import { ProductPicture } from './ProductPicture'
import { keySpecs } from './specs'

// A product, photographed or drawn, with its key specs set under it like the title block of a
// technical drawing: two columns where it is narrow (a phone, the product sheet), four given room
// (40rem and more). The width that counts is the hero's own, not the screen's.

const label = css({
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

/** The key specs alone, label over value: two columns, four from 40rem of their own width. */
export function KeySpecs({ item, locale }: { item: CatalogItem; locale: Locale }) {
  return (
    <div className={css({ containerType: 'inline-size' })}>
      <dl
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          columnGap: '4',
          rowGap: '3',
          '@container (min-width: 40rem)': { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
        })}
      >
        {keySpecs(item, locale).map((spec) => (
          <div
            key={spec.label}
            data-spec
            className={css({ display: 'grid', gap: '0.5', alignContent: 'start' })}
          >
            <dt className={label}>{spec.label}</dt>
            <dd className={css({ fontSize: 'sm', fontWeight: '600', lineHeight: '1.3' })}>
              {spec.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function ProductHero({ item, locale }: { item: CatalogItem; locale: Locale }) {
  return (
    <div className={css({ containerType: 'inline-size' })}>
      <div className={css({ display: 'grid', gap: '4' })}>
        <figure
          className={css({
            position: 'relative',
            h: '44',
            '@container (min-width: 40rem)': { h: '64' },
          })}
        >
          <div
            className={css({
              position: 'absolute',
              inset: '0',
              display: 'grid',
              // One cell the size of the box: a photo fills it rather than growing the row.
              gridTemplateColumns: 'minmax(0, 1fr)',
              gridTemplateRows: 'minmax(0, 1fr)',
              placeItems: 'center',
              p: '4',
            })}
          >
            <ProductPicture item={item} shadow="lg" className={css({ w: '100%', h: '100%' })} />
          </div>
        </figure>
        <KeySpecs item={item} locale={locale} />
      </div>
    </div>
  )
}
