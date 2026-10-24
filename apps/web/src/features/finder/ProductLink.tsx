import { Link } from '@tanstack/react-router'
import type { ComponentProps } from 'react'

// A product's sheet as a link: the finder's own page with the product in its path
// (/fr/claviers/<slug>), the answers kept, so that a middle click, a new tab or a shared link opens
// the same sheet over the same journey, and search engines find every product from the others.
// Opened from the finder, the sheet takes an entry of its own in the history, marked as such:
// Back folds it away. From an open sheet (`swap`: a similar model), the product takes the place of
// the one shown in that same entry, so Back still closes the sheet rather than walking back
// through every product seen.

const PAGE = '/$lang/$category/{-$product}'

type Props = Omit<ComponentProps<'a'>, 'href'> & {
  slug: string
  /** From an open sheet: this product replaces the one it shows. */
  swap?: boolean
}

export function ProductLink({ slug, swap = false, children, ...rest }: Props) {
  return (
    <Link
      from={PAGE}
      to={PAGE}
      params={(prev) => ({ ...prev, product: slug })}
      search={(prev) => prev}
      replace={swap}
      state={swap ? (prev) => ({ sheet: prev.sheet }) : { sheet: true }}
      resetScroll={false}
      draggable={false}
      {...rest}
    >
      {children}
    </Link>
  )
}
