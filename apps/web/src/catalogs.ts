import type { CatalogItem, Category } from '@choose/catalog'
import { useMemo, useSyncExternalStore } from 'react'

// The categories' catalogues in the browser. A page comes with the catalogue it shows (a category's
// page or a product's, that category's; the home page, every category's, which its panels draw):
// the others no longer weigh on every page (1.6 MB of a 1.8 MB page, the three catalogues). They
// come from /api/catalog/<category>?v=<version> once the page has settled, or when the scene or a
// page needs them first; the browser and the CDN keep that address, which each seed changes.

/** What the layout's loader serves (routes/$lang.tsx): some catalogues, every version. */
export type Served = {
  catalogs: Partial<Record<Category, CatalogItem[]>>
  versions: Record<Category, string>
}

const fetched = new Map<Category, CatalogItem[]>()
const pending = new Map<Category, Promise<CatalogItem[]>>()
const listeners = new Set<() => void>()
const NONE: Partial<Record<Category, CatalogItem[]>> = {}
/** The catalogues fetched so far, a new object each time one comes in. */
let loaded = NONE

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** A category's catalogue if the page has it already. */
export const catalogOf = (served: Served, category: Category): CatalogItem[] | undefined =>
  served.catalogs[category] ?? fetched.get(category)

/** A category's catalogue, fetched once if the page came without it. */
export function ensureCatalog(served: Served, category: Category): Promise<CatalogItem[]> {
  const ready = catalogOf(served, category)
  if (ready) return Promise.resolve(ready)
  // The server always serves what its page shows: nothing to fetch there.
  if (typeof window === 'undefined') {
    return Promise.reject(new Error(`The ${category} catalogue was not served with the page`))
  }
  let request = pending.get(category)
  if (!request) {
    const version = encodeURIComponent(served.versions[category] ?? '')
    request = fetch(`/api/catalog/${category}?v=${version}`)
      .then((response) => {
        if (!response.ok) throw new Error(`The ${category} catalogue answered ${response.status}`)
        return response.json() as Promise<{ items: CatalogItem[] }>
      })
      .then(({ items }) => {
        fetched.set(category, items)
        loaded = { ...loaded, [category]: items }
        for (const listener of listeners) listener()
        return items
      })
      .finally(() => pending.delete(category))
    pending.set(category, request)
  }
  return request
}

/** Every catalogue the browser has: the page's, then those fetched since. */
export function useCatalogs(served: Served): Partial<Record<Category, CatalogItem[]>> {
  const since = useSyncExternalStore(
    subscribe,
    () => loaded,
    () => NONE,
  )
  return useMemo(() => ({ ...since, ...served.catalogs }), [since, served.catalogs])
}
