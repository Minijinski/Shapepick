import type { CatalogItem, Locale, Ranked } from '@choose/catalog'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { Match } from '../product/Match'
import { ProductPicture } from '../product/ProductPicture'
import { formatPrice } from '../product/specs'
import { ProductLink } from './ProductLink'

// The best match so far, above a phone's console, where the podium has no room: one line that
// changes as the answers do. A tap opens its sheet (a link to it), whose arrows go on to the next
// ones.

const card = css({
  display: 'grid',
  gridTemplateColumns: '2.75rem minmax(0, 1fr) auto auto',
  alignItems: 'center',
  columnGap: '3',
  w: '100%',
  minH: '14',
  px: '3',
  py: '2',
  textAlign: 'left',
  bg: 'surface.raised/90',
  backdropFilter: 'blur(8px)',
  borderWidth: '1px',
  borderColor: 'signal',
  borderRadius: 'card',
  cursor: 'pointer',
  transition: 'background 160ms, box-shadow 300ms',
  _hover: { bg: 'surface.raised', boxShadow: '0 12px 28px -18px rgba(20,20,20,0.35)' },
  _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
})

export function TopPick({ entry, locale }: { entry: Ranked<CatalogItem>; locale: Locale }) {
  const { item } = entry
  return (
    <ProductLink
      slug={item.slug}
      className={card}
      aria-label={m.sheetOf(`${item.brand.name} ${item.name}`, locale)}
    >
      {/* A new best match comes in on its own. */}
      <span
        key={item.slug}
        className={css({
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          h: '10',
          animation: 'cardIn 0.4s token(easings.signal) backwards',
          _motionReduce: { animation: 'none' },
        })}
      >
        <ProductPicture
          item={item}
          className={css({ maxH: '10', maxW: '100%', w: '100%', h: 'auto' })}
        />
        <span
          className={css({
            position: 'absolute',
            top: '-1.5',
            left: '-1.5',
            display: 'grid',
            placeItems: 'center',
            minW: '4.5',
            h: '4.5',
            px: '1',
            borderRadius: 'pill',
            fontFamily: 'mono',
            fontSize: '2xs',
            lineHeight: '1',
            bg: 'signal',
            color: 'white',
            boxShadow: '0 0 0 2px token(colors.surface.raised)',
          })}
        >
          <span className={css({ srOnly: true })}>n° </span>1
        </span>
      </span>
      <span
        key={`${item.slug}-name`}
        className={css({
          minW: '0',
          display: 'grid',
          gap: '0.5',
          lineHeight: '1.2',
          animation: 'fadeIn 0.4s ease backwards',
          _motionReduce: { animation: 'none' },
        })}
      >
        <span className={css({ fontSize: '2xs', color: 'ink.muted' })}>
          {item.brand.name} · {formatPrice(item.priceEur, locale)}
        </span>
        <span className={css({ fontSize: 'sm', fontWeight: '600', overflowWrap: 'anywhere' })}>
          {item.name}
        </span>
      </span>
      <Match score={entry.score} locale={locale} size="sm" accent label={false} />
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={css({ color: 'ink.muted' })}
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </ProductLink>
  )
}
