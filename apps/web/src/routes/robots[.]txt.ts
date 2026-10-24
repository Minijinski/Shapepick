import { createFileRoute } from '@tanstack/react-router'
import { absolute } from '~/site'

// What crawlers may visit: every page but the API (catalogue JSON, photo relay), and where the
// sitemap is. Written from the site's address, so it follows the domain.
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [
            'User-agent: *',
            'Allow: /',
            'Disallow: /api/',
            '',
            `Sitemap: ${absolute('/sitemap.xml')}`,
            '',
          ].join('\n'),
          {
            headers: {
              'content-type': 'text/plain; charset=utf-8',
              'cache-control': 'public, max-age=3600',
              // Netlify's CDN keeps it a day; a deploy empties it.
              'netlify-cdn-cache-control': 'public, durable, s-maxage=86400',
            },
          },
        ),
    },
  },
})
