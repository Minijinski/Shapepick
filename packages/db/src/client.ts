import { neon } from '@neondatabase/serverless'
import { drizzle as overHttp } from 'drizzle-orm/neon-http'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle as overTcp } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// The site runs as a Netlify Function and reads Neon through its serverless driver, over HTTP: one
// fetch per query, so a cold start opens no connection and a frozen function leaves none behind.
// Scripts keep a TCP connection, which interactive transactions need. A Postgres of our own
// (pnpm pg:local, Docker) only speaks TCP.

/** What the site queries, whichever driver is behind it. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

const required = (url: string | undefined) => {
  if (!url) throw new Error('DATABASE_URL is not set (see .env.example)')
  return url
}

const isNeon = (url: string) => new URL(url).hostname.endsWith('.neon.tech')

/** For the site, on the pooled URL. */
export function createDb(url = process.env.DATABASE_URL): Db {
  const target = required(url)
  return isNeon(target)
    ? overHttp({ client: neon(target), schema, casing: 'snake_case' })
    : overTcp({ client: postgres(target, { max: 10 }), schema, casing: 'snake_case' })
}

/** For scripts (seed): one TCP connection, on Neon through the direct endpoint, not the pooler. */
export function connectDirect(url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL) {
  const client = postgres(required(url), { max: 1 })
  return overTcp({ client, schema, casing: 'snake_case' })
}

let shared: Db | undefined
/** One client per server process. */
export const getDb = () => {
  shared ??= createDb()
  return shared
}
