import {
  categoryFromSlug,
  finderOf,
  finders,
  type Locale,
  similar,
} from "@choose/catalog";
import { createFileRoute, getRouteApi, notFound } from "@tanstack/react-router";
import { ensureCatalog, useCatalogs } from "~/catalogs";
import { Finder } from "~/features/finder/Finder";
import type { FinderSearch } from "~/features/finder/useFinder";
import { sharedPhoto } from "~/features/product/photo";
import {
  formatAmount,
  productKind,
  productSummary,
} from "~/features/product/specs";
import { messages as m } from "~/i18n/messages";
import {
  breadcrumbSchema,
  categoryPaths,
  homePaths,
  pageHead,
  productPaths,
  productSchema,
} from "~/seo";
import { absolute, SITE } from "~/site";

// A category's finder, and each of its products: /fr/claviers is the questionnaire, and
// /fr/claviers/<slug> the same page with that product's sheet open over it. One route for both, so
// opening or closing a sheet never remounts the finder; the head is the product's when a sheet is
// open.

export const Route = createFileRoute("/$lang/$category/{-$product}")({
  validateSearch: (search: Record<string, unknown>): FinderSearch =>
    Object.fromEntries(
      Object.entries(search).filter(([, v]) => typeof v === "string"),
    ) as FinderSearch,
  // The catalogue comes from the layout and does not depend on the answers: every answer is local.
  staleTime: Number.POSITIVE_INFINITY,
  shouldReload: false,
  // A category the site does not offer (no products yet, or its catalogue failed) has no page, nor
  // does a product the category does not hold.
  loader: async ({ params, parentMatchPromise }) => {
    const category = categoryFromSlug(params.category, params.lang as Locale);
    if (!category) throw notFound();
    const { loaderData } = await parentMatchPromise;
    if (!loaderData?.shown.includes(category)) throw notFound();
    // Served with the page when it is this category's; fetched when moving here from another.
    const items = await ensureCatalog(loaderData, category);
    const product = params.product
      ? items.find((item) => item.slug === params.product)
      : undefined;
    if (params.product && !product) throw notFound();
    // How many models it holds, which its title and description tell; for a product, the ones its
    // sheet suggests beside it, which its structured data names.
    return {
      category,
      count: items.length,
      product: product ?? null,
      similar: product
        ? similar(finderOf(category), items, product).map((other) => ({
            slug: other.slug,
            name: `${other.brand.name} ${other.name}`,
            price: other.priceEur,
          }))
        : [],
    };
  },
  head: ({ params, loaderData }) => {
    const lang = params.lang as Locale;
    if (!loaderData) return {};
    const { category, count, product } = loaderData;
    const name = m.category[category][lang];
    if (product) {
      const paths = productPaths(category, product.slug);
      const title = `${product.brand.name} ${product.name}`;
      const description = m.productDescription(
        title,
        productSummary(product, lang),
        formatAmount(product.priceEur, lang),
        lang,
      );
      const photo = product.photo ? sharedPhoto(product.photo) : null;
      const image = photo && {
        url: absolute(photo.src),
        width: photo.width,
        height: photo.height,
        alt: title,
      };
      return pageHead({
        locale: lang,
        paths,
        title: m.productTitle(title, productKind(product, lang)),
        description,
        image: image ?? undefined,
        schema: [
          productSchema({
            name: title,
            brand: product.brand.name,
            model: product.modelNumber,
            description,
            url: absolute(paths[lang]),
            image: image?.url,
            category: name,
            price: product.priceEur,
            similar: loaderData.similar.map((other) => ({
              name: other.name,
              url: absolute(productPaths(category, other.slug)[lang]),
              price: other.price,
            })),
          }),
          breadcrumbSchema([
            { name: SITE.name, path: homePaths[lang] },
            { name, path: categoryPaths(category)[lang] },
            { name: title, path: paths[lang] },
          ]),
        ],
      });
    }
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
  const catalogs = useCatalogs(layout.useLoaderData());
  const search = Route.useSearch();
  const { lang, product } = Route.useParams();
  return (
    <Finder
      key={category}
      category={category}
      items={catalogs[category] ?? []}
      search={search}
      product={product ?? null}
      locale={lang as Locale}
    />
  );
}
