import type { Locale } from '@choose/catalog'

// Who the site is and where it lives, written once: the header, the titles, the share cards, the
// structured data and the sitemap all read it from here, so renaming the site is one line. Its
// address comes from the build (vite.config.ts): SITE_URL, else the main address Netlify gives
// the site, which becomes its custom domain once it has one.

declare const __SITE_URL__: string

export const SITE = {
  name: 'shapepick',
  /** The name it went by before, which search engines may still know it by for a while. */
  formerName: 'choose-a-device',
  /** The public address, without a trailing slash. */
  url: __SITE_URL__,
  /** Each locale as Open Graph names it. */
  ogLocale: { fr: 'fr_FR', en: 'en_GB' } satisfies Record<Locale, string>,
}

/** A path of the site as a full address, as canonical links, sitemaps and share cards want it. */
export const absolute = (path: string) => `${SITE.url}${path}`
