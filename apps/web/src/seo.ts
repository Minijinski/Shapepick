import { type Category, categorySlugs, type Locale, locales } from '@choose/catalog'
import { messages as m } from '~/i18n/messages'
import { absolute, SITE } from './site'

// What a page tells search engines and link previews, in one place: its title and description,
// its address and its other language's (canonical, hreflang), its share card (Open Graph, which
// X and the messaging apps read as well) and its structured data (schema.org, as JSON-LD).

/** A schema.org object, written into the page as JSON-LD. */
export type Schema = Record<string, unknown>

const inEachLocale = (path: (locale: Locale) => string) =>
  Object.fromEntries(locales.map((locale) => [locale, path(locale)])) as Record<Locale, string>

/** The home page's path in each locale. */
export const homePaths = inEachLocale((locale) => `/${locale}`)

/** A category page's path in each locale. */
export const categoryPaths = (category: Category) =>
  inEachLocale((locale) => `/${locale}/${categorySlugs[category][locale]}`)

/** Where the home page sends a language the site does not speak: "/" picks one of its own. */
export const HOME_FALLBACK = '/'

/** Structured data as a script's text: nothing in it can close the tag. */
const jsonLd = (data: Schema) => JSON.stringify(data).replace(/</g, '\\u003c')

type PageHead = {
  locale: Locale
  /** The page's path in each locale: /fr/claviers, /en/keyboards. */
  paths: Record<Locale, string>
  /**
   * Where visitors whose language the site does not speak go (`x-default`): the page in English
   * unless said otherwise.
   */
  fallback?: string
  /** What the page is, without the site's name: the share card's title. */
  title: string
  /** The site's name before the title rather than after it (the home page). */
  brandFirst?: boolean
  description: string
  schema?: Schema[]
}

export function pageHead({
  locale,
  paths,
  fallback = paths.en,
  title,
  brandFirst = false,
  description,
  schema = [],
}: PageHead) {
  const url = absolute(paths[locale])
  return {
    meta: [
      { title: brandFirst ? `${SITE.name} · ${title}` : `${title} · ${SITE.name}` },
      { name: 'description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE.name },
      { property: 'og:url', content: url },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:locale', content: SITE.ogLocale[locale] },
      ...locales
        .filter((other) => other !== locale)
        .map((other) => ({ property: 'og:locale:alternate', content: SITE.ogLocale[other] })),
      // The same picture for every page of a locale, without the site's name on it: the card
      // shows the name beside it (og:site_name), so renaming the site leaves it as it is.
      { property: 'og:image', content: absolute(`/og/default-${locale}.png`) },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: m.shareImageAlt[locale] },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'canonical', href: url },
      ...locales.map((other) => ({
        rel: 'alternate',
        hrefLang: other,
        href: absolute(paths[other]),
      })),
      { rel: 'alternate', hrefLang: 'x-default', href: absolute(fallback) },
    ],
    // Data, not code: the router renders these scripts without running them.
    scripts: schema.map((data) => ({ type: 'application/ld+json', children: jsonLd(data) })),
  }
}

/**
 * The site itself, on its home pages: the name search results show for it. On renaming, the old
 * name goes into `alternateName` for a while.
 */
export const websiteSchema = (locale: Locale): Schema => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  url: absolute('/'),
  inLanguage: locale,
})

/** Where a page sits, from the home page down, as search results show it. */
export const breadcrumbSchema = (crumbs: { name: string; path: string }[]): Schema => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: crumb.name,
    item: absolute(crumb.path),
  })),
})
