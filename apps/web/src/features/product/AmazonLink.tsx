import type { CatalogItem, Locale } from '@choose/catalog'
import type { MouseEvent } from 'react'
import { css, cx } from 'styled-system/css'
import { button } from 'styled-system/recipes'
import { messages as m } from '~/i18n/messages'
import { amazonLink } from './shops'

// A product's Amazon.fr link, wherever the product shows: a button in its sheet and on the best
// match, a small pill on the runners-up, an arrow at the end of a row of the results. Keyboards
// only: the monitors are still a demo catalogue. It sits above the button stretched over a card or
// a row, and a click on it never opens the sheet. Its arrow slides out under the pointer.

type Props = {
  item: CatalogItem
  locale: Locale
  /** The visitor's layout answer (azerty, ansi, iso), which picks the listing or the search. */
  layouts?: readonly string[]
  variant?: 'button' | 'pill' | 'icon'
  className?: string
}

const link = css({
  position: 'relative',
  zIndex: '1',
  '& [data-arrow]': { flexShrink: '0', transition: 'transform 220ms token(easings.signal)' },
  '&:is(:hover, :focus-visible) [data-arrow]': { transform: 'translate(2px, -2px)' },
  _motionReduce: { '& [data-arrow]': { transition: 'none' } },
})

const pill = css({ h: '7', px: '2.5', gap: '1', fontSize: 'xs' })

const icon = css({
  display: 'grid',
  placeItems: 'center',
  w: '8',
  h: '8',
  borderRadius: 'full',
  color: 'ink.faint',
  transition: 'color 160ms, background 160ms',
  _hover: { color: 'ink', bg: 'ink/6' },
  _groupHover: { color: 'ink' },
  '@media (hover: none)': { color: 'ink.muted' },
  _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
})

const Arrow = ({ size }: { size: number }) => (
  <svg
    data-arrow
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
)

/** A click on the link opens Amazon, never the sheet of the card or row it sits on. */
const keepToItself = (e: MouseEvent) => e.stopPropagation()

export function AmazonLink({ item, locale, layouts, variant = 'button', className }: Props) {
  if (item.category !== 'keyboard') return null
  const shop = amazonLink(item, locale, layouts)
  const rel = shop.affiliate ? 'sponsored nofollow noopener' : 'nofollow noopener'
  if (variant === 'button')
    return (
      <a
        href={shop.url}
        target="_blank"
        rel={rel}
        onClick={keepToItself}
        className={cx(button({ tone: 'ink', size: 'md' }), link, className)}
      >
        {shop.direct ? m.viewOnAmazon[locale] : m.searchOnAmazon[locale]}
        <Arrow size={18} />
      </a>
    )
  const name = m.amazonOf(`${item.brand.name} ${item.name}`, shop.direct, locale)
  if (variant === 'pill')
    return (
      <a
        href={shop.url}
        target="_blank"
        rel={rel}
        onClick={keepToItself}
        aria-label={name}
        className={cx(button({ tone: 'line', size: 'sm' }), pill, link, className)}
      >
        {m.amazon[locale]}
        <Arrow size={14} />
      </a>
    )
  return (
    <a
      href={shop.url}
      target="_blank"
      rel={rel}
      onClick={keepToItself}
      aria-label={name}
      title={name}
      className={cx(icon, link, className)}
    >
      <Arrow size={16} />
    </a>
  )
}
