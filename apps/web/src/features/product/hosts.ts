// The shops whose product photos the site shows, and how each one lets them be kept. The image CDN
// (`/.netlify/images`) copies the cache header of the photo it resizes: a CDN that answers
// `private` or `max-age=0` (Samsung, Dell, LG, ASUS, BenQ, Philips, Corsair, Logitech) leaves
// nothing to keep, so every visitor waited for the brand again, up to ten seconds a photo. Those
// photos go through our own route (`/api/photo/…`), which says they never change.

/** The shops the image CDN may fetch from: keep in step with `remote_images` in netlify.toml. */
const ALLOWED = [
  /^https:\/\/cdn\.shopify\.com\//,
  /^https:\/\/assets3\.razerzone\.com\//,
  /^https:\/\/medias-p1\.phoenix\.razer\.com\//,
  /^https:\/\/assets\.corsair\.com\//,
  /^https:\/\/res\.cloudinary\.com\//,
  /^https:\/\/resource\.logitech\.com\//,
  /^https:\/\/resource\.logitechg\.com\//,
  /^https:\/\/images\.ctfassets\.net\//,
  /^https:\/\/images\.samsung\.com\//,
  /^https:\/\/www\.lg\.com\/content\/dam\//,
  /^https:\/\/i\.dell\.com\//,
  /^https:\/\/fr-store\.msi\.com\/cdn\/shop\//,
  /^https:\/\/cdn\.sanity\.io\//,
  /^https:\/\/dlcdnwebimgs\.asus\.com\//,
  /^https:\/\/images\.philips\.com\//,
  /^https:\/\/image\.benq\.com\//,
  // Akko's own shop.
  /^https:\/\/en\.akkogear\.com\/wp-content\/uploads\//,
  // Mice and keyboards from brands' own sites outside Shopify: Kensington (its group's CDN), Cooler
  // Master (its Storyblok space), CHERRY XTRFY and Skyloong (WordPress), Wooting (its bucket).
  /^https:\/\/media\.accobrands\.com\//,
  /^https:\/\/a\.storyblok\.com\/f\/281110\//,
  /^https:\/\/cherryxtrfy\.com\/wp\/wp-content\/uploads\//,
  /^https:\/\/skyloongtech\.com\/wp-content\/uploads\//,
  /^https:\/\/wooting-website\.ams3\.cdn\.digitaloceanspaces\.com\//,
  // Retailers' copies of a brand's photo, for products their brand shows only at an angle or in a
  // scene: Mercular and MakeWebEasy (Thailand), Euro RTV AGD (Poland).
  /^https:\/\/mercular\.s3\.ap-southeast-1\.amazonaws\.com\//,
  /^https:\/\/image\.makewebeasy\.net\//,
  /^https:\/\/f00\.esfr\.pl\//,
]

/**
 * Shops whose CDN forbids keeping their photos (measured 2026-10-23), or says nothing about it
 * (Mercular's bucket sends no cache header): relayed by our route.
 */
const UNCACHED =
  /^https:\/\/(images\.samsung\.com|i\.dell\.com|www\.lg\.com|dlcdnwebimgs\.asus\.com|image\.benq\.com|images\.philips\.com|assets\.corsair\.com|res\.cloudinary\.com|resource\.logitechg?\.com|mercular\.s3\.ap-southeast-1\.amazonaws\.com)\//

export const isShopPhoto = (url: string) => ALLOWED.some((pattern) => pattern.test(url))

export const isUncached = (url: string) => UNCACHED.test(url)

/** A photo's URL as a path segment: base64url of its UTF-8 bytes. */
export function photoKey(url: string) {
  let binary = ''
  for (const byte of new TextEncoder().encode(url)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The URL a key stands for, or null when it is not one. */
export function urlOfKey(key: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return null
  try {
    const binary = atob(key.replace(/-/g, '+').replace(/_/g, '/'))
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
  } catch {
    return null
  }
}

/** A shop's photo through our route. */
export const relayOf = (url: string) => `/api/photo/${photoKey(url)}`

/** Where the image CDN fetches a shop's photo from: our route for a shop that forbids keeping it. */
export const relayed = (url: string) => (isUncached(url) ? relayOf(url) : null)
