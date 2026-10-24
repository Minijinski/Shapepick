import { createRouter } from '@tanstack/react-router'
import { NotFound } from './components/NotFound'
import { routeTree } from './routeTree.gen'

// Search params stay plain strings (`?size=f75,f65&budget=0-150`): readable, shareable, and
// exactly what the finder engine expects. The default JSON encoding would quote every value.
const parseSearch = (search: string) => Object.fromEntries(new URLSearchParams(search))
const stringifySearch = (search: Record<string, unknown>) => {
  const query = Object.entries(search)
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v)).replace(/%2C/gi, ',')}`,
    )
    .join('&')
  return query ? `?${query}` : ''
}

export function getRouter() {
  return createRouter({
    routeTree,
    parseSearch,
    stringifySearch,
    defaultPreload: 'intent',
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
  interface HistoryState {
    /** A product's sheet opened over its finder (not reached directly): closing it goes back. */
    sheet?: boolean
  }
}
