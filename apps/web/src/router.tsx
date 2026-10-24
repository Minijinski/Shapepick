import { createRouter } from '@tanstack/react-router'
import { NotFound } from './components/NotFound'
import { routeTree } from './routeTree.gen'
import { parseSearch, stringifySearch } from './search'

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
