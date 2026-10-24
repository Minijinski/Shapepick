import { categoryFromSlug, finders, type Locale } from "@choose/catalog";
import { createFileRoute, getRouteApi, notFound } from "@tanstack/react-router";
import { Finder } from "~/features/finder/Finder";
import type { FinderSearch } from "~/features/finder/useFinder";
import { messages as m } from "~/i18n/messages";
import { breadcrumbSchema, categoryPaths, homePaths, pageHead } from "~/seo";
import { SITE } from "~/site";

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
    // How many models it holds, which its title and description tell.
    return { category, count: loaderData.catalogs[category].length };
  },
  head: ({ params, loaderData }) => {
    const lang = params.lang as Locale;
    if (!loaderData) return {};
    const { category, count } = loaderData;
    const name = m.category[category][lang];
    const questions = finders[category].steps.length;
    const paths = categoryPaths(category);
    return pageHead({
      locale: lang,
      paths,
      title: `${m.categoryQuestion[category][lang]} ${m.modelsCompared(count, questions, lang)}`,
      description: m.categoryDescription(
        m.categoryPitch[category][lang],
        name.toLocaleLowerCase(lang),
        count,
        questions,
        lang,
      ),
      schema: [
        breadcrumbSchema([
          { name: SITE.name, path: homePaths[lang] },
          { name, path: paths[lang] },
        ]),
      ],
    });
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
