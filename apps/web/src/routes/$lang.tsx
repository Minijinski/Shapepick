import { isLocale, type Locale } from '@choose/catalog'
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import { SiteHeader } from '~/components/SiteHeader'
import { Scene } from '~/features/scene/Scene'
import { getCatalogs } from '~/server/catalog'

export const Route = createFileRoute('/$lang')({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.lang)) throw notFound()
  },
  // Loaded once per visit: the scene draws every category, and the catalogue does not depend on
  // the answers, so moving between pages never refetches it.
  loader: async () => ({ catalogs: await getCatalogs() }),
  staleTime: Number.POSITIVE_INFINITY,
  shouldReload: false,
  component: LocaleLayout,
})

function LocaleLayout() {
  const { catalogs } = Route.useLoaderData()
  const { lang } = Route.useParams()
  return (
    <>
      {/* One canvas for every page of the locale, so the home panels and a category's canvas
          are the same drawing and the transition between them never remounts anything. */}
      <Scene catalogs={catalogs} locale={lang as Locale} />
      <SiteHeader />
      <Outlet />
    </>
  )
}
