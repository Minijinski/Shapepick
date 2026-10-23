// The shops' and brands' image CDNs, asked for a photo at a given width where they can resize
// (on the fly, from the URL): the site requests what it shows, the ingest what it judges, and the
// image CDN on our domain never has to fetch a 4 MB original for a 400 px tile.

/** Cloudinary (Corsair) names the width as a transformation step: `w_96`. */
const CLOUDINARY = /^https:\/\/(assets\.corsair\.com|res\.cloudinary\.com)\//
const CLOUDINARY_WIDTH = /(w_)\d+(?=,|%2C|\/)/i
/** Scene7 (Samsung, Dell, Philips, BenQ) serves `/is/image/…` at `wid` pixels. */
const SCENE7 = /^(images\.samsung\.com|i\.dell\.com|images\.philips\.com|image\.benq\.com)$/

/** The photo at `width` px from its CDN, or its URL as it is where the CDN cannot resize. */
export function atWidth(href: string, width: number): string {
  if (CLOUDINARY.test(href)) return href.replace(CLOUDINARY_WIDTH, (_, step) => `${step}${width}`)
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return href
  }
  const w = String(Math.round(width))
  // Shopify, on its own host or a store's (fr-store.msi.com/cdn/shop/…).
  if (url.hostname === 'cdn.shopify.com' || url.pathname.startsWith('/cdn/shop/')) {
    url.searchParams.set('width', w)
  } else if (SCENE7.test(url.hostname) && url.pathname.startsWith('/is/image/')) {
    // A preset ("?$ORIGIN_PNG$") fixes the size: replaced by a width, cut out kept.
    if (/^\?\$[^&]+\$$/.test(url.search)) url.search = '?fmt=png-alpha'
    url.searchParams.set('wid', w)
  } else if (url.hostname === 'cdn.sanity.io' || url.hostname === 'images.ctfassets.net') {
    url.searchParams.set('w', w)
  } else if (url.hostname === 'dlcdnwebimgs.asus.com') {
    // ASUS sizes by a path suffix: /gain/<id>/w800.
    url.pathname = `${url.pathname.replace(/\/[wh]\d+$/, '')}/w${w}`
  } else {
    return href
  }
  // Scene7 presets are written `$…$`: URLSearchParams would encode the dollars.
  return url.toString().replace(/%24/g, '$')
}
