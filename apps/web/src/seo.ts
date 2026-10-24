import { type Category, categorySlugs, type Locale, locales, type Text } from '@choose/catalog'
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

/** A product page's path in each locale: the same slug under its category's name. */
export const productPaths = (category: Category, slug: string) =>
  inEachLocale((locale) => `/${locale}/${categorySlugs[category][locale]}/${slug}`)

/**
 * A category's catalogue in each locale: every product, A to Z (/fr/claviers/catalogue). The same
 * word in both languages, which no product's slug takes.
 */
export const cataloguePaths = (category: Category) =>
  inEachLocale((locale) => `/${locale}/${categorySlugs[category][locale]}/catalogue`)

/** A collection's page in each locale, under its category's catalogue. */
export const collectionPaths = (collection: { category: Category; slug: Text }) =>
  inEachLocale(
    (locale) => `${cataloguePaths(collection.category)[locale]}/${collection.slug[locale]}`,
  )

/** Where the home page sends a language the site does not speak: "/" picks one of its own. */
export const HOME_FALLBACK = '/'

/** Structured data as a script's text: nothing in it can close the tag. */
const jsonLd = (data: Schema) => JSON.stringify(data).replace(/</g, '\\u003c')

/** A page's own share picture (a product's photo), as a full address; its size when known. */
export type ShareImage = { url: string; width?: number; height?: number; alt: string }

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
  /** The page's own share picture; the site's card otherwise. */
  image?: ShareImage
  schema?: Schema[]
}

export function pageHead({
  locale,
  paths,
  fallback = paths.en,
  title,
  brandFirst = false,
  description,
  image,
  schema = [],
}: PageHead) {
  const url = absolute(paths[locale])
  // The same picture for every page of a locale, without the site's name on it: the card shows
  // the name beside it (og:site_name), so renaming the site leaves it as it is.
  const card = image ?? {
    url: absolute(`/og/default-${locale}-v2.png`),
    width: 1200,
    height: 630,
    alt: m.shareImageAlt[locale],
  }
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
      { property: 'og:image', content: card.url },
      ...(card.width && card.height
        ? [
            { property: 'og:image:width', content: String(card.width) },
            { property: 'og:image:height', content: String(card.height) },
          ]
        : []),
      { property: 'og:image:alt', content: card.alt },
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
 * The site itself, on its home pages: the name search results show for it, and the one it went
 * by before (`alternateName`), kept for a while after a renaming.
 */
export const websiteSchema = (locale: Locale): Schema => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  alternateName: SITE.formerName,
  url: absolute('/'),
  inLanguage: locale,
})

/**
 * A product, on its own page: what it is and who makes it, its photo, and the products its sheet
 * suggests beside it. No offer: its price is a typical public one, not a price anyone sells it at
 * here, so search results show it without a price or a rating.
 */
export const productSchema = ({
  name,
  brand,
  model,
  description,
  url,
  image,
  category,
  similar,
}: {
  name: string
  brand: string
  /** The maker's reference, when known. */
  model?: string
  description: string
  url: string
  image?: string
  category: string
  similar: { name: string; url: string }[]
}): Schema => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name,
  brand: { '@type': 'Brand', name: brand },
  ...(model ? { mpn: model } : {}),
  description,
  url,
  ...(image ? { image } : {}),
  category,
  ...(similar.length > 0
    ? { isSimilarTo: similar.map((other) => ({ '@type': 'Product', ...other })) }
    : {}),
})

/**
 * A ranked list of products, on a collection's page: each one by its own page, in the page's
 * order, as search engines read a summary page that links to detail pages.
 */
export const itemListSchema = ({
  name,
  url,
  items,
}: {
  name: string
  url: string
  items: { name: string; url: string }[]
}): Schema => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  url,
  numberOfItems: items.length,
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: item.url,
    name: item.name,
  })),
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
