import { getDb, schema } from '@choose/db'

// Server only, imported dynamically from the /api/out handler (as snapshot.server.ts is): the
// database client never reaches the browser bundle.

export type ClickRow = typeof schema.outboundClicks.$inferInsert

/** Writes one click on a buy link. */
export async function recordClick(row: ClickRow) {
  await getDb().insert(schema.outboundClicks).values(row)
}
