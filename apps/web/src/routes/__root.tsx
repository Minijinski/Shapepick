/// <reference types="vite/client" />
import { isLocale } from '@choose/catalog'
import { createRootRoute, HeadContent, Outlet, Scripts, useParams } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SITE } from '~/site'
import appCss from '~/styles.css?url'

// React hydrates the whole document, <head> included. On *.netlify.app, Netlify's edge writes a
// line break and a comment of its own after the charset meta: nodes React did not render, which
// fail the hydration (error #418), so React threw the server's HTML away and rendered every page
// again in the browser. Run while the head is parsed, long before hydration, this takes out what
// React never writes there: whitespace between tags and worded comments (its own markers have no
// spaces).
const TIDY_HEAD =
  'for(var n=document.head.firstChild,x;n;n=x){x=n.nextSibling;if((n.nodeType===3&&!n.data.trim())||(n.nodeType===8&&/\\s/.test(n.data)))n.remove()}'

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
    scripts: [{ children: TIDY_HEAD }],
  }),
  shellComponent: RootDocument,
  component: Outlet,
})

// A locale's pages open under the preloader (features/scene/Preloader.tsx), with their entrances
// on hold until it lifts (the layout's head ends the hold anyway should the page never wake up).
// Without JavaScript, there is no preloader and no hold at all.
const NO_HOLD =
  '<style>html[data-loading] *{animation-play-state:running!important}[data-preloader]{display:none!important}</style>'

function RootDocument({ children }: { children: ReactNode }) {
  const { lang } = useParams({ strict: false }) as { lang?: string }
  const localized = isLocale(lang)
  return (
    <html lang={localized ? lang : 'fr'} data-loading={localized ? '' : undefined}>
      <head>
        <HeadContent />
        {localized && (
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
