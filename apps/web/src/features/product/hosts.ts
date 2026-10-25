import { isShopPhoto } from '@choose/catalog/media'

// The shops whose product photos the site shows, and how each one lets them be kept. Where photos
// may come from at all, down to each shop's account, is `isShopPhoto` (PHOTO_SOURCES in
// packages/catalog/src/media/hosts.ts, the image CDN's list in netlify.toml). The image CDN
// (`/.netlify/images`) copies the cache header of the photo it resizes: a CDN that answers
// `private` or `max-age=0` (Samsung, Dell, LG, ASUS, BenQ, Philips, Corsair, Logitech) leaves
// nothing to keep, so every visitor waited for the brand again, up to ten seconds a photo. Those
// photos go through our own route (`/api/photo/…`), which says they never change.

export { isShopPhoto }

/**
 * Shops whose CDN forbids keeping their photos (measured 2026-10-23), or says nothing about it
 * (Mercular's bucket sends no cache header): relayed by our route.
 */
const UNCACHED =
  /^https:\/\/(images\.samsung\.com|i\.dell\.com|www\.lg\.com|dlcdnwebimgs\.asus\.com|image\.benq\.com|images\.philips\.com|assets\.corsair\.com|res\.cloudinary\.com|resource\.logitechg?\.com|mercular\.s3\.ap-southeast-1\.amazonaws\.com)\//

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
