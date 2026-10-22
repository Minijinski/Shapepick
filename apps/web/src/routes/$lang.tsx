import { isLocale, type Locale } from "@choose/catalog";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "~/components/SiteHeader";
import { Preloader } from "~/features/scene/Preloader";
import { Scene } from "~/features/scene/Scene";
import { getCatalogs } from "~/server/catalog";

export const Route = createFileRoute("/$lang")({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.lang)) throw notFound();
  },
  // Loaded once per visit: the scene draws every category, and the catalogue does not depend on
  // the answers, so moving between pages never refetches it.
  loader: async () => ({ catalogs: await getCatalogs() }),
  // A page is the same for every visitor (answers live in the URL, the journey in the browser):
  // Netlify's CDN keeps it five minutes, then serves it while it fetches a fresh one, so most
  // visits never wait for a function or the database. A deploy empties the cache.
  headers: () => ({
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control":
      "public, durable, s-maxage=300, stale-while-revalidate=604800",
  }),
  staleTime: Number.POSITIVE_INFINITY,
  shouldReload: false,
  component: LocaleLayout,
});

function LocaleLayout() {
  const { catalogs } = Route.useLoaderData();
  const { lang } = Route.useParams();
  return (
    <>
      {/* First, so that it holds the page's entrances before any of them starts. */}
      <Preloader
        counts={{
          keyboard: catalogs.keyboard.length,
          monitor: catalogs.monitor.length,
        }}
        locale={lang as Locale}
      />
      {/* One canvas for every page of the locale, so the home panels and a category's canvas
          are the same drawing and the transition between them never remounts anything. */}
      <Scene catalogs={catalogs} locale={lang as Locale} />
      <SiteHeader />
      <Outlet />
    </>
  );
}
