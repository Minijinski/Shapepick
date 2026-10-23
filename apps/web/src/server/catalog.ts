import { type CatalogItem, type Category, categories } from "@choose/catalog";
import { createServerFn } from "@tanstack/react-start";

// Every category's catalogue, from one snapshot per category. The layout loads them once: the
// home page draws every category in its panels, and a category page filters and ranks in memory
// (server for the first paint, browser afterwards), so no answer waits on the database.
// A category whose snapshot fails (a table its migration has not created yet, a database hiccup)
// comes back empty and is named in `failed`, instead of failing every page of the site.
export const getCatalogs = createServerFn({ method: "GET" }).handler(
  async () => {
    const { snapshotOf } = await import("./snapshot.server");
    const failed: Category[] = [];
    const entries = await Promise.all(
      categories.map(async (category) => {
        try {
          return [category, (await snapshotOf(category)).items] as const;
        } catch (error) {
          const cause = error instanceof Error ? (error.cause ?? error) : error;
          console.error(
            `The ${category} catalogue failed to load:`,
            cause instanceof Error ? cause.message : cause,
          );
          failed.push(category);
          return [category, [] as CatalogItem[]] as const;
        }
      }),
    );
    return {
      catalogs: Object.fromEntries(entries) as Record<Category, CatalogItem[]>,
      failed,
    };
  },
);

/** The categories the site offers: those with products. An empty or failed one stays hidden. */
export const shownCategories = (catalogs: Record<Category, CatalogItem[]>) =>
  categories.filter((category) => catalogs[category].length > 0);
