import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { SITE } from './site'

// Every request the site answers comes through here (on Netlify, one function serves every path).
// The site's first address, its Netlify subdomain, keeps working once the site has its own domain:
// from then on (the build's address, SITE.url, being that domain), a request there is sent to the
// same page on the domain for good (301), so that links and search results still pointing at it
// follow. Netlify applies its redirect rules (netlify.toml) only after its functions, which is why
// this is not one of them. Deploy previews have other subdomains and stay where they are.

/** The site's first address. */
const FIRST_HOST = 'choose-a-device.netlify.app'

export default createServerEntry({
  fetch(request, opts) {
    const url = new URL(request.url)
    const home = new URL(SITE.url)
    if (url.hostname === FIRST_HOST && home.hostname !== FIRST_HOST) {
      return new Response(null, {
        status: 301,
        headers: {
          location: `${home.origin}${url.pathname}${url.search}`,
          'cache-control': 'public, max-age=86400',
        },
      })
    }
    return handler.fetch(request, opts)
  },
})
