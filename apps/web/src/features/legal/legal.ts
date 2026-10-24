import type { Locale } from '@choose/catalog'

// What the routes of the legal page and the links to it need, apart from the page itself
// (LegalPage.tsx): a link to it, or its route's own options, carry nothing of the page.

/**
 * The legal notice and privacy page in each locale, under its own name in each language
 * (routes/$lang_.mentions-legales.tsx, routes/$lang_.legal.tsx).
 */
export const legalPaths: Record<Locale, string> = {
  fr: '/fr/mentions-legales',
  en: '/en/legal',
}

/** Kept by the CDN as the site's pages are (routes/$lang.tsx): a deploy empties it. */
export const legalHeaders = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=300, stale-while-revalidate=604800',
}
