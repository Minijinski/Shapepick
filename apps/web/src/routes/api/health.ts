import { categories } from '@choose/catalog'
import { createFileRoute } from '@tanstack/react-router'

// For an uptime monitor: whether each category's catalogue loads and holds products. A category
// whose catalogue fails leaves the site without a word (server/catalog.ts hides it); here it turns
// the answer into a 503. A good answer is kept ten minutes by the CDN, so that a monitor checking
// every few minutes does not keep the database awake; a bad one is never kept.

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        const { snapshotOf } = await import('~/server/snapshot.server')
        const counts = Object.fromEntries(
          await Promise.all(
            categories.map(async (category) => {
              try {
                return [category, (await snapshotOf(category)).items.length] as const
              } catch {
                return [category, null] as const
              }
            }),
          ),
        )
        const ok = Object.values(counts).every((count) => count != null && count > 0)
        return Response.json(
          { ok, counts },
          {
            status: ok ? 200 : 503,
            headers: {
              'cache-control': 'no-store',
              'netlify-cdn-cache-control': ok ? 'public, s-maxage=600' : 'no-store',
            },
          },
        )
      },
    },
  },
})
