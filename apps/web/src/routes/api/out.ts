import { categories, isLocale } from '@choose/catalog'
import { createFileRoute } from '@tanstack/react-router'
import { PLACEMENTS } from '~/features/product/clicks'

// Where clicks on buy links are counted: features/product/clicks.ts sends each one as a beacon. A
// click names a product of the catalogue, where its link sat and whether it opened the product's
// page or a search. The country comes from the CDN's geolocation, the kind of device from the user
// agent, and crawlers are not counted. Nothing else is kept: no address, no cookie, no identifier.

const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse/i
const MOBILE = /mobi|android|iphone|ipad/i

/** Netlify's request context (its functions runtime), with the visitor's country. */
type NetlifyGlobal = { context?: { geo?: { country?: { code?: string } } } | null }

const countryOf = (request: Request) =>
  (globalThis as { Netlify?: NetlifyGlobal }).Netlify?.context?.geo?.country?.code ??
  request.headers.get('x-country') ??
  null

const answer = (status: number) =>
  new Response(null, { status, headers: { 'cache-control': 'no-store' } })

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  (values as readonly unknown[]).includes(value)

export const Route = createFileRoute('/api/out')({
  server: {
    handlers: {
      // Nothing to show: the route only takes clicks.
      GET: () =>
        new Response(null, {
          status: 405,
          headers: { allow: 'POST', 'cache-control': 'no-store' },
        }),
      POST: async ({ request }) => {
        const agent = request.headers.get('user-agent') ?? ''
        if (BOTS.test(agent)) return answer(204)
        // A browser always says where a beacon comes from: without that, or from another site, it
        // is no click of a visitor of ours (a script posting by hand, another site's page).
        const origin = request.headers.get('origin')
        if (!origin || URL.parse(origin)?.host !== new URL(request.url).host) return answer(403)
        let click: Record<string, unknown>
        try {
          click = await request.json()
        } catch {
          return answer(400)
        }
        const { slug, category, placement, link, locale, page } = click
        if (
          typeof slug !== 'string' ||
          !oneOf(categories, category) ||
          !oneOf(PLACEMENTS, placement) ||
          !oneOf(['page', 'search'] as const, link) ||
          !isLocale(locale)
        )
          return answer(400)
        const { snapshotOf } = await import('~/server/snapshot.server')
        const { items } = await snapshotOf(category)
        if (!items.some((item) => item.slug === slug)) return answer(400)
        const { recordClick } = await import('~/server/clicks.server')
        try {
          await recordClick({
            shop: 'amazon',
            productSlug: slug,
            category,
            placement,
            link,
            locale,
            page: typeof page === 'string' ? page.slice(0, 200) : null,
            country: countryOf(request),
            device: MOBILE.test(agent) ? 'mobile' : 'desktop',
          })
        } catch (error) {
          const cause = error instanceof Error ? (error.cause ?? error) : error
          console.error(
            'A click could not be recorded:',
            cause instanceof Error ? cause.message : cause,
          )
          return answer(503)
        }
        return answer(204)
      },
    },
  },
})
