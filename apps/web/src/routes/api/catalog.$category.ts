import { type Category, categories } from '@choose/catalog'
import { createFileRoute } from '@tanstack/react-router'

// The catalogue snapshot as JSON, for CDN caching and for anything outside the app (scripts,
// a future mobile client). The ETag changes whenever a product of the category is updated.
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
        return Response.json(snapshot, {
          headers: { etag, 'cache-control': 'public, max-age=60, stale-while-revalidate=600' },
        })
      },
    },
  },
})
