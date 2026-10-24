/// <reference types="vite/client" />
import { isLocale } from '@choose/catalog'
import { createRootRoute, HeadContent, Outlet, Scripts, useParams } from '@tanstack/react-router'
import type { JSX, ReactNode } from 'react'
import { SITE, UMAMI_WEBSITE_ID } from '~/site'
import appCss from '~/styles.css?url'

// React hydrates the whole document, <head> included. On *.netlify.app, Netlify's edge writes a
// line break and a comment of its own after the charset meta: nodes React did not render, which
// fail the hydration (error #418), so React threw the server's HTML away and rendered every page
// again in the browser. Run while the head is parsed, long before hydration, this takes out what
// React never writes there: whitespace between tags and worded comments (its own markers have no
// spaces).
const TIDY_HEAD =
  'for(var n=document.head.firstChild,x;n;n=x){x=n.nextSibling;if((n.nodeType===3&&!n.data.trim())||(n.nodeType===8&&/\\s/.test(n.data)))n.remove()}'

// Umami's tracker, without cookies, once the site has its id (site.ts). It counts a page view at
// each new path and none when only the query changes: the finder's answers live there, so a
// journey through the questions is one view, and opening a product's sheet is a view of it. Its
// own domain filter keeps local builds and deploy previews out.
const tracker =
  UMAMI_WEBSITE_ID && SITE.url.startsWith('https://')
    ? ({
        src: 'https://cloud.umami.is/script.js',
        defer: true,
        'data-website-id': UMAMI_WEBSITE_ID,
        'data-domains': new URL(SITE.url).hostname,
        'data-exclude-search': 'true',
      } as JSX.IntrinsicElements['script'])
    : undefined

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#F3F1EC' },
      { title: SITE.name },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
    scripts: [{ children: TIDY_HEAD }, tracker],
  }),
  shellComponent: RootDocument,
  component: Outlet,
})

// A locale's pages open under the preloader (features/scene/Preloader.tsx), with their entrances
// on hold until it lifts (the layout's head ends the hold anyway should the page never wake up).
// A product's page reached straight (from a search engine, a shared link) opens at once, without
// it: its sheet is what the visit came for. Without JavaScript, there is no preloader and no hold.
const NO_HOLD =
  '<style>html[data-loading] *{animation-play-state:running!important}[data-preloader]{display:none!important}</style>'

function RootDocument({ children }: { children: ReactNode }) {
  const { lang, product } = useParams({ strict: false }) as { lang?: string; product?: string }
  const localized = isLocale(lang)
  const held = localized && !product
  return (
    <html lang={localized ? lang : 'fr'} data-loading={held ? '' : undefined}>
      <head>
        <HeadContent />
        {held && (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed rule of our own
          <noscript dangerouslySetInnerHTML={{ __html: NO_HOLD }} />
        )}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
