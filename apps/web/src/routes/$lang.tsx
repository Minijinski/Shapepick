import { categoryFromSlug, isLocale, type Locale } from "@choose/catalog";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { ensureCatalog, useCatalogs } from "~/catalogs";
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
  // Loaded once per visit, the catalogue not depending on the answers: moving between pages never
  // asks for it again. The page comes with the catalogue it shows: a category's page or a
  // product's, that category's; the home page, every category's (its panels draw them all). The
  // browser fetches the others once the page has settled (src/catalogs.ts). Only the categories
  // with products are shown (`shown`): one that is empty (not seeded yet) or failed to load has no
  // panel, no link and no page, rather than an empty panel or an error on every page.
  loader: async ({ params, location }) => {
    const slug = location.pathname.split("/")[2];
    const only = slug ? categoryFromSlug(slug, params.lang as Locale) : null;
    const { catalogs, counts, versions, failed } = await getCatalogs({
      data: only,
    });
    return { catalogs, counts, versions, shown: shownCategories(counts), failed };
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
  const served = Route.useLoaderData();
  const { counts, shown } = served;
  const catalogs = useCatalogs(served);
  const { lang } = Route.useParams();
  // The catalogues the page came without, once it has settled: switching category or going home
  // then never waits for them.
  useEffect(() => {
    const later = (run: () => void) =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(run, { timeout: 4000 })
        : window.setTimeout(run, 1500);
    const id = later(() => {
      for (const category of shown) void ensureCatalog(served, category).catch(() => {});
    });
    return () => {
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [served, shown]);
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
