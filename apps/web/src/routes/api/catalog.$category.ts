import { type Category, categories } from '@choose/catalog'
import { createFileRoute } from '@tanstack/react-router'
import { CATALOGUE_TAG, catalogueCache } from '~/cdn'

// The catalogue snapshot as JSON: what the browser fetches of the categories a page came without
// (src/catalogs.ts), and what anything outside the app may read (scripts, a future mobile client).
// The ETag changes whenever a product of the category is updated. Asked for at its version
// (`?v=`, as the site does), the answer never changes: the browser keeps it for good, and the next
// seed asks for another address.
export const Route = createFileRoute('/api/catalog/$category')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!(categories as readonly string[]).includes(params.category)) {
          return new Response('Unknown category', { status: 404 })
        }
        const { snapshotOf } = await import('~/server/snapshot.server')
        const snapshot = await snapshotOf(params.category as Category)
        const etag = `"${snapshot.version}"`
        if (request.headers.get('if-none-match') === etag)
          return new Response(null, { status: 304 })
        const versioned = new URL(request.url).searchParams.get('v') === snapshot.version
        return Response.json(snapshot, {
          headers: {
            etag,
            'cache-control': versioned
              ? 'public, max-age=31536000, immutable'
              : 'public, max-age=60, stale-while-revalidate=600',
            // Netlify's CDN keeps it a day; a deploy or a seed empties it (src/cdn.ts).
            'netlify-cdn-cache-control': catalogueCache['Netlify-CDN-Cache-Control'] ?? '',
            'netlify-cache-tag': CATALOGUE_TAG,
          },
        })
      },
    },
  },
})
