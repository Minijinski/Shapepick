import { type CatalogItem, type Category, categories } from "@choose/catalog";
import { createServerFn } from "@tanstack/react-start";

// Every category's catalogue, from one snapshot per category. The layout loads them once: the
// home page draws every category in its panels, and a category page filters and ranks in memory
// (server for the first paint, browser afterwards), so no answer waits on the database.
export const getCatalogs = createServerFn({ method: "GET" }).handler(
  async () => {
    const { snapshotOf } = await import("./snapshot.server");
    const entries = await Promise.all(
      categories.map(
        async (category) =>
          [category, (await snapshotOf(category)).items] as const,
      ),
    );
    return Object.fromEntries(entries) as Record<Category, CatalogItem[]>;
  },
);
