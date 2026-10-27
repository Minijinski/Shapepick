import type { CatalogItem, Locale } from '@choose/catalog'
import { type MouseEvent, useSyncExternalStore } from 'react'
import { css, cx } from 'styled-system/css'
import { button } from 'styled-system/recipes'
import { messages as m } from '~/i18n/messages'
import { countClick, type Placement } from './clicks'
import { amazonLink, type Store, storeOf } from './shops'

// A product's Amazon link, wherever the product shows: a button in its sheet and on the best
// match, a small pill on the runners-up, an arrow at the end of a row of the results. It sits above
// the button stretched over a card or a row, and a click on it never opens the sheet. Its arrow
// slides out under the pointer. Each click on it is counted (clicks.ts), with where it sat. The
// Amazon it opens is the visitor's (shops.ts): the served HTML guesses it from the page's language,
// the browser then reads the device's time zone.

type Props = {
  item: CatalogItem
  locale: Locale
  /** The visitor's layout answer (azerty, ansi, iso), which picks the listing or the search. */
  layouts?: readonly string[]
  /** Where it sits, which the count of its clicks keeps. */
  placement: Placement
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
  _coarse: { w: '10', h: '10' },
  borderRadius: 'full',
  color: 'ink.faint',
  transition: 'color 160ms, background 160ms',
  _hover: { color: 'ink', bg: 'ink/6' },
  _groupHover: { color: 'ink' },
  '@media (hover: none)': { color: 'ink.muted' },
  _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
})

let zone: string | undefined
const timeZone = () => (zone ??= Intl.DateTimeFormat().resolvedOptions().timeZone)
const steady = () => () => {}

/** The visitor's Amazon: the page's language's in the served HTML, the device's once awake. */
const useStore = (locale: Locale): Store =>
  useSyncExternalStore(
    steady,
    () => storeOf(timeZone(), locale),
    () => storeOf(undefined, locale),
  )

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

export function AmazonLink({
  item,
  locale,
  layouts,
  placement,
  variant = 'button',
  className,
}: Props) {
  const shop = amazonLink(item, locale, layouts, useStore(locale))
  const rel = shop.affiliate ? 'sponsored nofollow noopener' : 'nofollow noopener'
  /**
   * A click on the link opens Amazon, never the sheet of the card or row it sits on, and is
   * counted; so is a middle click, which opens it in a tab.
   */
  const opened = (e: MouseEvent) => {
    e.stopPropagation()
    if (e.type === 'auxclick' && e.button !== 1) return
    countClick({
      shop: shop.store,
      slug: item.slug,
      category: item.category,
      placement,
      link: shop.direct ? 'page' : 'search',
      locale,
      page: window.location.pathname,
    })
  }
  if (variant === 'button')
    return (
      <a
        href={shop.url}
        target="_blank"
        rel={rel}
        onClick={opened}
        onAuxClick={opened}
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
        onClick={opened}
        onAuxClick={opened}
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
      onClick={opened}
      onAuxClick={opened}
      aria-label={name}
      title={name}
      className={cx(icon, link, className)}
    >
      <Arrow size={16} />
    </a>
  )
}
