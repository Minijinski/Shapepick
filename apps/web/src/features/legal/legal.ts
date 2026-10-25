import type { Locale } from '@choose/catalog'
import { deployCache } from '~/cdn'

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

/** Kept a day by the CDN: only a deploy changes it, and a deploy empties the CDN (src/cdn.ts). */
export const legalHeaders = deployCache
