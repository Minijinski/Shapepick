import type { Category } from '@choose/catalog'
import { getDb, readSnapshot, type Snapshot } from '@choose/db'

// Server only: the database client never reaches the browser bundle. Callers import this module
// dynamically from inside server-function or server-route handlers, which the compiler strips
// from the client build.

const TTL_MS = 60_000
const cache = new Map<Category, { at: number; snapshot: Promise<Snapshot<Category>> }>()

/**
 * One snapshot per category, read again at most once a minute per server process: the seed's copy
 * of its rows in one query, the tables themselves when the copy is missing or behind.
 */
export function snapshotOf<C extends Category>(category: C): Promise<Snapshot<C>> {
  const hit = cache.get(category)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.snapshot as Promise<Snapshot<C>>
  const snapshot = readSnapshot(getDb(), category)
  cache.set(category, { at: Date.now(), snapshot })
  snapshot.catch(() => cache.delete(category))
  return snapshot
}
