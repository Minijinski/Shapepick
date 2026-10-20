import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = ReturnType<typeof createDb>

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set (see .env.example)')
  const client = postgres(url, { max: 10 })
  return drizzle({ client, schema, casing: 'snake_case' })
}

let shared: Db | undefined
/** One pool per server process. */
export const getDb = () => {
  shared ??= createDb()
  return shared
}
