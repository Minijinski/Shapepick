import { createFileRoute } from '@tanstack/react-router'
import { isShopPhoto, urlOfKey } from '~/features/product/hosts'

// A shop's photo, served from our own domain for the image CDN (see features/product/hosts.ts):
// fetched once from the shop, then marked as never changing, so Netlify keeps it, and every size
// the image CDN cuts from it, instead of asking the brand again for each visitor. Only the shops
// the image CDN may fetch from are fetched; nothing is sent to them but the request itself.

/** Longest a shop may take to answer, and the most a photo may weigh. */
const TIMEOUT_MS = 20_000
const MAX_BYTES = 10_000_000

const refuse = (status: number, reason: string) =>
  new Response(reason, { status, headers: { 'cache-control': 'no-store' } })

export const Route = createFileRoute('/api/photo/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const url = urlOfKey(params.key)
        if (!url || !isShopPhoto(url)) return refuse(403, 'Not a shop photo')
        let upstream: Response
        try {
          upstream = await fetch(url, {
            headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/*' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          })
        } catch {
          return refuse(504, 'The shop did not answer')
        }
        if (!upstream.ok) return refuse(upstream.status, 'The shop refused the photo')
        const type = upstream.headers.get('content-type') ?? ''
        if (!type.startsWith('image/')) return refuse(415, 'Not an image')
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
          },
        })
      },
    },
  },
})
