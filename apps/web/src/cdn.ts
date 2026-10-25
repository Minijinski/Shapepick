// How long Netlify's CDN keeps what the site serves. A page only changes with a deploy (the code)
// or a seed (the catalogue): a deploy empties the CDN, so a seed of production is followed by one
// (a push, or Trigger deploy); whatever is built from the catalogue is also tagged `catalogue`, which
// packages/db/src/purge-cdn.ts can have the CDN drop alone, given a Netlify token.
// So pages are kept a day, not five minutes: past five minutes, a page few people visit was rendered
// again by the function for nearly every visit, and its visitor waited for it (up to 4 s, the
// function in Ohio, the database in Frankfurt). Browsers ask again every time (`max-age=0`), so a
// deploy or a seed shows at once.

/** Tells Netlify which cached answers a seed changes. */
export const CATALOGUE_TAG = 'catalogue'

/** What Netlify's CDN keeps a day, then serves while it fetches a fresh one. */
const DAY = 'public, durable, s-maxage=86400, stale-while-revalidate=604800'

/** Pages and data built from the catalogue. */
export const catalogueCache: Record<string, string> = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': DAY,
  'Netlify-Cache-Tag': CATALOGUE_TAG,
}

/** Pages that change only with a deploy (the legal pages). */
export const deployCache: Record<string, string> = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': DAY,
}

/** A page missing a category that failed to load is not kept: the next visit tries again. */
export const noStore: Record<string, string> = {
  'Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'no-store',
}
