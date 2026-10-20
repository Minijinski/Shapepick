import { type Category, categories } from '@choose/catalog'
import { createServerFn } from '@tanstack/react-start'

// The finder's catalogue comes from one snapshot per category. Filtering and ranking then happen
// in memory (server for the first paint, browser afterwards), so no answer waits on the database.
export const getCatalog = createServerFn({ method: 'GET' })
  .validator((category: unknown): Category => {
    if (!(categories as readonly unknown[]).includes(category)) throw new Error('Unknown category')
    return category as Category
  })
  .handler(async ({ data }) => {
    const { snapshotOf } = await import('./snapshot.server')
    return snapshotOf(data)
  })
