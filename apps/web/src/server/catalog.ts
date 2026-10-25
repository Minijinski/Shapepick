import { type CatalogItem, type Category, categories } from "@choose/catalog";
import { createServerFn } from "@tanstack/react-start";

// The categories' catalogues for the layout, from one snapshot per category. Every category's size
// and version go with every page (the header, the home panels, the preloader); the products only
// with the page that shows them (`only`: a category's page or a product's), or with the home page,
// whose panels draw every category. The browser fetches the others later (src/catalogs.ts).
// A category whose snapshot fails (a table its migration has not created yet, a database hiccup)
// comes back empty and is named in `failed`, instead of failing every page of the site.
export const getCatalogs = createServerFn({ method: "GET" })
  .validator((only: Category | null) =>
    only && categories.includes(only) ? only : null,
  )
  .handler(async ({ data: only }) => {
    const { snapshotOf } = await import("./snapshot.server");
    const failed: Category[] = [];
    const snapshots = await Promise.all(
      categories.map(async (category) => {
        try {
          return [category, await snapshotOf(category)] as const;
        } catch (error) {
          const cause = error instanceof Error ? (error.cause ?? error) : error;
          console.error(
            `The ${category} catalogue failed to load:`,
            cause instanceof Error ? cause.message : cause,
          );
          failed.push(category);
          return [category, null] as const;
        }
      }),
    );
    const catalogs: Partial<Record<Category, CatalogItem[]>> = {};
    const counts = {} as Record<Category, number>;
    const versions = {} as Record<Category, string>;
    for (const [category, snapshot] of snapshots) {
      counts[category] = snapshot?.items.length ?? 0;
      versions[category] = snapshot?.version ?? "";
      if (snapshot && (!only || only === category))
        catalogs[category] = snapshot.items;
    }
    return { catalogs, counts, versions, failed };
  });

/** Where each category stands on the site: home panels, header links, preloader. */
const ORDER: Record<Category, number> = { mouse: 0, keyboard: 1, monitor: 2 };

/**
 * The categories the site offers, in the site's order: those with products. An empty or failed
 * one stays hidden.
 */
export const shownCategories = (counts: Record<Category, number>) =>
  categories
    .filter((category) => counts[category] > 0)
    .sort((a, b) => ORDER[a] - ORDER[b]);

/** How many products each catalogue holds. */
export const countsOf = (catalogs: Record<Category, CatalogItem[]>) =>
  Object.fromEntries(
    categories.map((category) => [category, catalogs[category].length]),
  ) as Record<Category, number>;
