import {
  type Category,
  categories,
  isLocale,
  type Locale,
} from "@choose/catalog";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { catalogueCache, noStore } from "~/cdn";
import { SiteHeader } from "~/components/SiteHeader";
import { FINDER_VARY } from "~/features/finder/params";
import { Preloader } from "~/features/scene/Preloader";
import { Scene } from "~/features/scene/Scene";
import { getCatalogs, shownCategories } from "~/server/catalog";

export const Route = createFileRoute("/$lang")({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.lang)) throw notFound();
  },
  // Loaded once per visit: the scene draws every category, and the catalogue does not depend on
  // the answers, so moving between pages never refetches it. Only the categories with products
  // are shown (`shown`): one that is empty (not seeded yet) or failed to load has no panel, no
  // link and no page, rather than an empty panel or an error on every page.
  loader: async () => {
    const { catalogs, failed } = await getCatalogs();
    return { catalogs, shown: shownCategories(catalogs), failed };
  },
  // A page is the same for every visitor (answers live in the URL, the journey in the browser):
  // Netlify's CDN keeps it a day (src/cdn.ts), so most visits never wait for a function or the
  // database; a deploy or a seed empties it. One copy per combination of the parameters a finder
  // reads (features/finder/params.ts): others share it.
  // The preloader holds the page's entrances (html[data-loading]): should the page never wake up,
  // the hold ends after five seconds anyway.
  head: () => ({
    scripts: [
      {
        children:
          "setTimeout(function(){document.documentElement.removeAttribute('data-loading')},5000)",
      },
    ],
  }),
  // A page missing a category that failed to load is not kept: the next visit tries again.
  headers: ({ loaderData }): Record<string, string> =>
    loaderData?.failed.length
      ? noStore
      : { ...catalogueCache, "Netlify-Vary": FINDER_VARY },
  staleTime: Number.POSITIVE_INFINITY,
  shouldReload: false,
  component: LocaleLayout,
});

function LocaleLayout() {
  const { catalogs, shown } = Route.useLoaderData();
  const counts = Object.fromEntries(
    categories.map((c) => [c, catalogs[c].length]),
  ) as Record<Category, number>;
  const { lang } = Route.useParams();
  return (
    <>
      {/* First, so that it holds the page's entrances before any of them starts. */}
      <Preloader shown={shown} counts={counts} locale={lang as Locale} />
      {/* One canvas for every page of the locale, so the home panels and a category's canvas
          are the same drawing and the transition between them never remounts anything. */}
      <Scene catalogs={catalogs} shown={shown} locale={lang as Locale} />
      <SiteHeader shown={shown} />
      <Outlet />
    </>
  );
}
