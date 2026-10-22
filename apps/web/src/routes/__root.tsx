/// <reference types="vite/client" />
import { isLocale } from '@choose/catalog'
import { createRootRoute, HeadContent, Outlet, Scripts, useParams } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '~/styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#F3F1EC' },
      { title: 'choose-a-device' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
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
