import { categoryFromSlug, categorySlugs, type Locale } from "@choose/catalog";
import { createFileRoute, getRouteApi, notFound } from "@tanstack/react-router";
import { Finder } from "~/features/finder/Finder";
import type { FinderSearch } from "~/features/finder/useFinder";
import { messages as m } from "~/i18n/messages";

export const Route = createFileRoute("/$lang/$category")({
  validateSearch: (search: Record<string, unknown>): FinderSearch =>
    Object.fromEntries(
      Object.entries(search).filter(([, v]) => typeof v === "string"),
    ) as FinderSearch,
  // The catalogue comes from the layout and does not depend on the answers: every answer is local.
  staleTime: Number.POSITIVE_INFINITY,
  shouldReload: false,
  // A category the site does not offer (no products yet, or its catalogue failed) has no page.
  loader: async ({ params, parentMatchPromise }) => {
    const category = categoryFromSlug(params.category, params.lang as Locale);
    if (!category) throw notFound();
    const { loaderData } = await parentMatchPromise;
    if (!loaderData?.shown.includes(category)) throw notFound();
    return { category };
  },
  head: ({ params, loaderData }) => {
    const lang = params.lang as Locale;
    if (!loaderData) return {};
    const name = m.category[loaderData.category][lang];
    const title =
      lang === "fr"
        ? `${name} : trouve le tien en quelques questions`
        : `${name}: find yours in a few questions`;
    const alternate = (other: Locale) =>
      `/${other}/${categorySlugs[loaderData.category][other]}`;
    return {
      meta: [
        { title: `${title} · choose-a-device` },
        { name: "description", content: m.homeLead[lang] },
        { property: "og:title", content: title },
      ],
      links: [
        { rel: "canonical", href: alternate(lang) },
        { rel: "alternate", hrefLang: "fr", href: alternate("fr") },
        { rel: "alternate", hrefLang: "en", href: alternate("en") },
      ],
    };
  },
  component: FinderPage,
});

const layout = getRouteApi("/$lang");

function FinderPage() {
  const { category } = Route.useLoaderData();
  const { catalogs } = layout.useLoaderData();
  const search = Route.useSearch();
  const { lang } = Route.useParams();
  return (
    <Finder
      key={category}
      category={category}
      items={catalogs[category]}
      search={search}
      locale={lang as Locale}
    />
  );
}
