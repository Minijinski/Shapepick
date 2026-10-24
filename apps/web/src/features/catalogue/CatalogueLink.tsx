import type { Category, Locale } from '@choose/catalog'
import { css } from 'styled-system/css'
import { cataloguePaths } from '~/seo'

// The finder's way to its category's catalogue (every product, A to Z), beside the brands under the
// counter: a chip worded as the brand chip is, its name then what it shows. A page of its own
// outside the finder, so an ordinary link, as the legal page's: it is also the one path search
// engines take from the category's page to every product.

const chip = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1.5',
  h: '7',
  pl: '2.5',
  pr: '2',
  borderRadius: 'pill',
  fontSize: 'xs',
  whiteSpace: 'nowrap',
  bg: 'surface/80',
  backdropFilter: 'blur(8px)',
  borderWidth: '1px',
  borderColor: 'line.strong',
  color: 'ink',
  pointerEvents: 'auto',
  transition: 'border-color 160ms, background 160ms',
  _hover: { borderColor: 'ink', bg: 'surface.raised' },
  _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
})

const caption = css({
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

export function CatalogueLink({
  category,
  label,
  locale,
}: {
  category: Category
  /** "Catalogue": what the chip leads to, before what it shows. */
  label: string
  locale: Locale
}) {
  return (
    <a href={cataloguePaths(category)[locale]} className={chip}>
      <span className={caption}>{label}</span>
      <span>A–Z</span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={css({ color: 'ink.muted' })}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </a>
  )
}
