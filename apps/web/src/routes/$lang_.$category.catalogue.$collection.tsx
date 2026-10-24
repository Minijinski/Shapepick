import { categoryFromSlug, isLocale, type Locale } from '@choose/catalog'
import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { CollectionView } from '~/features/catalogue/CollectionView'
import { collectionFromSlug, inSentence } from '~/features/catalogue/collections'
import { catalogueHeaders } from '~/features/catalogue/headers'
import { formatAmount } from '~/features/product/specs'
import { messages as m } from '~/i18n/messages'
import {
  breadcrumbSchema,
  cataloguePaths,
  categoryPaths,
  collectionPaths,
  homePaths,
  itemListSchema,
  pageHead,
  productPaths,
} from '~/seo'
import { getCollectionPage } from '~/server/catalogue'
import { absolute, SITE } from '~/site'

// A collection of the catalogue: the products a few of the questionnaire's answers keep, ranked
// (features/catalogue/CollectionView.tsx). Its address in the other language moves for good to its
// own; a collection with too few products has no page.

export const Route = createFileRoute('/$lang_/$category/catalogue/$collection')({
  loader: async ({ params }) => {
    if (!isLocale(params.lang)) throw notFound()
    const locale = params.lang
    const category = categoryFromSlug(params.category, locale)
    if (!category) throw notFound()
    const found = collectionFromSlug(category, params.collection, locale)
    if (!found) throw notFound()
    const { collection } = found
    if (found.elsewhere) {
      throw redirect({ href: collectionPaths(collection)[locale], statusCode: 301 })
    }
    const page = await getCollectionPage({ data: { category, locale, id: collection.id } })
    if (!page?.shown.includes(category)) throw notFound()
    return { collection, page }
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) return {}
    const locale = params.lang as Locale
    const { collection, page } = loaderData
    const { category } = collection
    const paths = collectionPaths(collection)
    const name = collection.name[locale]
    const leaders = page.rows.slice(0, 3).map((row) => `${row.brand} ${row.name}`)
    return pageHead({
      locale,
      paths,
      title: m.collectionTitle(name, page.total, locale),
      description: m.collectionDescription(
        leaders,
        page.total,
        inSentence(name),
        formatAmount(page.prices[0], locale),
        formatAmount(page.prices[1], locale),
        category,
        locale,
      ),
      schema: [
        itemListSchema({
          name,
          url: absolute(paths[locale]),
          items: page.rows.map((row) => ({
            name: `${row.brand} ${row.name}`,
            url: absolute(productPaths(category, row.slug)[locale]),
          })),
        }),
        breadcrumbSchema([
          { name: SITE.name, path: homePaths[locale] },
          { name: m.category[category][locale], path: categoryPaths(category)[locale] },
          { name: m.catalogue[locale], path: cataloguePaths(category)[locale] },
          { name, path: paths[locale] },
        ]),
      ],
    })
  },
  headers: ({ loaderData }) => catalogueHeaders(loaderData?.page.failed ?? true),
  component: CollectionRoute,
})

function CollectionRoute() {
  const { collection, page } = Route.useLoaderData()
  const { lang } = Route.useParams()
  return <CollectionView collection={collection} locale={lang as Locale} page={page} />
}
