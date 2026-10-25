import { catalogueCache, noStore } from '~/cdn'

// How long the catalogue's pages are kept: as the site's pages are (src/cdn.ts). A page missing a
// category that failed to load is not kept: the next visit tries again.

export const catalogueHeaders = (failed: boolean): Record<string, string> =>
  failed ? noStore : catalogueCache
