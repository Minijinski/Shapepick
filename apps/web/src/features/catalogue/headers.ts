// How long the catalogue's pages are kept: as the site's pages are (routes/$lang.tsx), five minutes
// by Netlify's CDN, then served while it fetches a fresh one; a deploy empties it. A page missing a
// category that failed to load is not kept: the next visit tries again.

export const catalogueHeaders = (failed: boolean): Record<string, string> =>
  failed
    ? { 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store' }
    : {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=300, stale-while-revalidate=604800',
      }
