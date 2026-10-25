import { type CatalogItem, type Category, categories, type Locale, locales } from '@choose/catalog'
import type { Snapshot } from '@choose/db'
import { createFileRoute } from '@tanstack/react-router'
import { CATALOGUE_TAG, catalogueCache } from '~/cdn'
import { livingCollections } from '~/features/catalogue/collections'
import {
  cataloguePaths,
  categoryPaths,
  collectionPaths,
  HOME_FALLBACK,
  homePaths,
  productPaths,
} from '~/seo'
import { shownCategories } from '~/server/catalog'
import { absolute } from '~/site'

// The pages search engines should know, in every locale: the home page, each category the site
// offers, its catalogue and the collections with a page, and each of its products, each with its
// other languages (hreflang, as in its head) and
// when its catalogue last changed (a product's own date would say no more: every seed stamps every
// product). A catalogue that fails to load would leave its pages out: no sitemap rather than a
// short one, and nothing kept by the CDN.

type Page = { paths: Record<Locale, string>; fallback: string; lastmod: string | null }

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function urlset(pages: Page[]) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ]
  for (const page of pages) {
    const link = (lang: string, path: string) =>
      `    <xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(absolute(path))}"/>`
    for (const locale of locales) {
      lines.push('  <url>', `    <loc>${escapeXml(absolute(page.paths[locale]))}</loc>`)
      if (page.lastmod) lines.push(`    <lastmod>${page.lastmod}</lastmod>`)
      for (const other of locales) lines.push(link(other, page.paths[other]))
      lines.push(link('x-default', page.fallback), '  </url>')
    }
  }
  lines.push('</urlset>', '')
  return lines.join('\n')
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const { snapshotOf } = await import('~/server/snapshot.server')
        let snapshots: Snapshot<Category>[]
        try {
          snapshots = await Promise.all(categories.map((category) => snapshotOf(category)))
        } catch {
          return new Response('Catalogue unavailable', {
            status: 503,
            headers: { 'cache-control': 'no-store', 'retry-after': '300' },
          })
        }
        const updated = new Map(categories.map((c, i) => [c, snapshots[i]?.updatedAt ?? null]))
        const catalogs = Object.fromEntries(
          categories.map((c, i) => [c, snapshots[i]?.items ?? []]),
        ) as Record<Category, CatalogItem[]>
        const shown = shownCategories(catalogs)
        const lastmods = shown.flatMap((c) => updated.get(c) ?? [])
        const pages: Page[] = [
          { paths: homePaths, fallback: HOME_FALLBACK, lastmod: lastmods.sort().at(-1) ?? null },
          ...shown.map((category) => {
            const paths = categoryPaths(category)
            return { paths, fallback: paths.en, lastmod: updated.get(category) ?? null }
          }),
          ...shown.map((category) => {
            const paths = cataloguePaths(category)
            return { paths, fallback: paths.en, lastmod: updated.get(category) ?? null }
          }),
          ...shown.flatMap((category) =>
            livingCollections(category, catalogs[category]).map((collection) => {
              const paths = collectionPaths(collection)
              return { paths, fallback: paths.en, lastmod: updated.get(category) ?? null }
            }),
          ),
          ...shown.flatMap((category) =>
            catalogs[category].map((item) => {
              const paths = productPaths(category, item.slug)
              return { paths, fallback: paths.en, lastmod: updated.get(category) ?? null }
            }),
          ),
        ]
        return new Response(urlset(pages), {
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=3600',
            // Netlify's CDN keeps it a day; a deploy or a seed empties it (src/cdn.ts).
            'netlify-cdn-cache-control': catalogueCache['Netlify-CDN-Cache-Control'] ?? '',
            'netlify-cache-tag': CATALOGUE_TAG,
          },
        })
      },
    },
  },
})
