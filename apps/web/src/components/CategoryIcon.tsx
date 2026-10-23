import type { Category } from '@choose/catalog'
import type { ReactNode } from 'react'

// One line icon per category, for the site header: drawn on a 24 px grid with the colour of the
// text around it, so hover and the active page simply recolour it. A new category draws its own.

const shapes: Record<Category, ReactNode> = {
  // A board, a row of keys and the space bar.
  keyboard: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="3" />
      <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M8 14h8" />
    </>
  ),
  // A screen on its stand.
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16v3.5M8.5 20h7" />
    </>
  ),
  // A shell seen from above, and its wheel.
  mouse: (
    <>
      <rect x="6.5" y="3" width="11" height="18" rx="5.5" />
      <path d="M12 7v2.5" />
    </>
  ),
}

export function CategoryIcon({ category, size = 22 }: { category: Category; size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[category]}
    </svg>
  )
}
