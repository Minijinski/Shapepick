import { categoryFromSlug, isLocale, type Locale } from '@choose/catalog'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { CatalogueIndex } from '~/features/catalogue/CatalogueIndex'
import { catalogueHeaders } from '~/features/catalogue/headers'
import { messages as m } from '~/i18n/messages'
import { breadcrumbSchema, cataloguePaths, categoryPaths, homePaths, pageHead } from '~/seo'
import { getCatalogueIndex } from '~/server/catalogue'
import { SITE } from '~/site'

// A category's catalogue: every product, brand by brand (features/catalogue/CatalogueIndex.tsx).
// A page of text rendered by the server, outside the locale's layout, in both languages under the
// same word: /fr/claviers/catalogue, /en/keyboards/catalogue.

export const Route = createFileRoute('/$lang_/$category/catalogue/')({
  loader: async ({ params }) => {
    if (!isLocale(params.lang)) throw notFound()
    const category = categoryFromSlug(params.category, params.lang)
    if (!category) throw notFound()
    const page = await getCatalogueIndex({ data: { category, locale: params.lang } })
    // A category the site does not offer yet (no products) has no catalogue.
    if (!page.shown.includes(category)) throw notFound()
    return { category, page }
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return {}
    const locale = params.lang as Locale
    const { category, page } = loaderData
    const paths = cataloguePaths(category)
    const name = m.category[category][locale]
    return pageHead({
      locale,
      paths,
      title: m.catalogueHeadTitle(m.catalogueTitle[category][locale], page.total, locale),
      description: m.catalogueDescription(
        page.total,
        name.toLocaleLowerCase(locale),
        m.catalogueSpecs[category][locale],
        locale,
      ),
      schema: [
        breadcrumbSchema([
          { name: SITE.name, path: homePaths[locale] },
          { name, path: categoryPaths(category)[locale] },
          { name: m.catalogue[locale], path: paths[locale] },
        ]),
      ],
    })
  },
  headers: ({ loaderData }) => catalogueHeaders(loaderData?.page.failed ?? true),
  component: CataloguePage,
})

function CataloguePage() {
  const { category, page } = Route.useLoaderData()
  const { lang } = Route.useParams()
  return <CatalogueIndex category={category} locale={lang as Locale} page={page} />
}
