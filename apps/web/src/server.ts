import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { SITE } from './site'

// Every request the site answers comes through here (on Netlify, one function serves every path).
// The site's first address, its Netlify subdomain, keeps working once the site has its own domain:
// from then on (the build's address, SITE.url, being that domain), a page asked for there is sent
// to the same page on the domain for good (301), so that links and search results still pointing
// at it follow. What pages call rather than show is answered wherever it is asked: the photo relay
// the image CDN reads its sources from, the catalogue, the server functions of a page still open
// at the old address. Netlify applies its redirect rules (netlify.toml) only after its functions,
// which is why this is not one of them. Deploy previews have other subdomains and stay put.
// A page's address never ends with a slash either: one asked for with it moves for good to the
// address without it (the router would answer a temporary 307), in the same single redirect.

/** The site's first address. */
const FIRST_HOST = 'choose-a-device.netlify.app'
/** Paths that are no pages, never moved: `/_serverFn/` is where TanStack Start serves functions. */
const NOT_PAGES = ['/api/', '/_serverFn/']

export default createServerEntry({
  fetch(request, opts) {
    const url = new URL(request.url)
    const home = new URL(SITE.url)
    const page = !NOT_PAGES.some((prefix) => url.pathname.startsWith(prefix))
    const moved = url.hostname === FIRST_HOST && home.hostname !== FIRST_HOST && page
    const path = page ? url.pathname.replace(/(.)\/+$/, '$1') : url.pathname
    if (moved || path !== url.pathname) {
      return new Response(null, {
        status: moved ? 301 : 308,
        headers: {
          location: `${moved ? home.origin : ''}${path}${url.search}`,
          'cache-control': 'public, max-age=86400',
        },
      })
    }
    return handler.fetch(request, opts)
  },
})
