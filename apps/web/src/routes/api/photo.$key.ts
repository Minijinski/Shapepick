import { createFileRoute } from '@tanstack/react-router'
import { isShopPhoto, urlOfKey } from '~/features/product/hosts'

// A shop's photo, served from our own domain for the image CDN (see features/product/hosts.ts):
// fetched once from the shop, then marked as never changing, so Netlify keeps it, and every size
// the image CDN cuts from it, instead of asking the brand again for each visitor. Only the photo
// sources the image CDN may fetch from are fetched, and a redirection is followed only to another
// of them; nothing is sent to them but the request itself. What comes back is a photo or nothing:
// no SVG (it can carry a script), and a policy that would keep anything in it from running on our
// domain anyway.

/** Longest the shops may take to answer, redirections included, and the most a photo may weigh. */
const TIMEOUT_MS = 20_000
const MAX_BYTES = 10_000_000
/** Redirections followed, each to a photo source. */
const MAX_HOPS = 2
/** What a photo may be: pictures made of pixels. */
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])

const refuse = (status: number, reason: string) =>
  new Response(reason, { status, headers: { 'cache-control': 'no-store' } })

export const Route = createFileRoute('/api/photo/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        let url = urlOfKey(params.key)
        if (!url || !isShopPhoto(url)) return refuse(403, 'Not a shop photo')
        const signal = AbortSignal.timeout(TIMEOUT_MS)
        let upstream: Response
        for (let hops = 0; ; hops++) {
          try {
            upstream = await fetch(url, {
              headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/*' },
              redirect: 'manual',
              signal,
            })
          } catch {
            return refuse(504, 'The shop did not answer')
          }
          const location = upstream.headers.get('location')
          if (upstream.status < 300 || upstream.status > 399 || !location) break
          if (hops === MAX_HOPS) return refuse(502, 'Too many redirections')
          url = new URL(location, url).href
          if (!isShopPhoto(url)) return refuse(403, 'Redirected away from the shop')
        }
        if (!upstream.ok) return refuse(upstream.status, 'The shop refused the photo')
        const type = upstream.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
        if (!PHOTO_TYPES.has(type)) return refuse(415, 'Not a photo')
        if (Number(upstream.headers.get('content-length') ?? 0) > MAX_BYTES) {
          return refuse(413, 'Photo too large')
        }
        const body = await upstream.arrayBuffer()
        if (body.byteLength > MAX_BYTES) return refuse(413, 'Photo too large')
        return new Response(body, {
          headers: {
            'content-type': type,
            'cache-control': 'public, max-age=31536000, immutable',
            'netlify-cdn-cache-control': 'public, durable, max-age=31536000, immutable',
            'content-security-policy': "default-src 'none'; sandbox",
            'x-content-type-options': 'nosniff',
          },
        })
      },
    },
  },
})
