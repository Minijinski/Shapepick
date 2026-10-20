import { isLocale } from '@choose/catalog'
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import { SiteHeader } from '~/components/SiteHeader'

export const Route = createFileRoute('/$lang')({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.lang)) throw notFound()
  },
  component: LocaleLayout,
})

function LocaleLayout() {
  return (
    <>
      <SiteHeader />
      <Outlet />
    </>
  )
}
