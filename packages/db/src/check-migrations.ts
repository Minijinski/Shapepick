import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import postgres from 'postgres'
import { isProduction } from './production'

// Has the database this build will read every migration of this commit? The site reads new columns
// as soon as it is deployed: pushed before `pnpm db:migrate`, one took every page down with 500s
// (2026-10-23). The Netlify build runs this before building, reading only: a production build
// stops on a missing migration, so the previous deploy stays live until the migration runs; a
// deploy preview or a branch deploy only warns (its branch may bring the migration). Without
// DATABASE_URL, there is nothing to check.

type Journal = { entries: { tag: string; when: number }[] }

const journal: Journal = JSON.parse(
  readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'),
)
const url = process.env.DATABASE_URL
const preview = ['deploy-preview', 'branch-deploy'].includes(process.env.CONTEXT ?? '')

if (!url) {
  console.warn('check-migrations: DATABASE_URL is not set, nothing checked.')
  process.exit(0)
}

/** When each migration the database holds was written (drizzle-kit keeps the journal's `when`). */
async function applied(target: string): Promise<Set<number>> {
  const query = 'select created_at from drizzle.__drizzle_migrations'
  if (new URL(target).hostname.endsWith('.neon.tech')) {
    const rows = (await neon(target).query(query)) as { created_at: string | number }[]
    return new Set(rows.map((row) => Number(row.created_at)))
  }
  const sql = postgres(target, { max: 1 })
  try {
    const rows = await sql.unsafe<{ created_at: string | number }[]>(query)
    return new Set(rows.map((row) => Number(row.created_at)))
  } finally {
    await sql.end()
  }
}

let done: Set<number>
try {
  done = await applied(url)
} catch (error) {
  const code = (error as { code?: string }).code
  const reason = (error instanceof Error && error.message) || code || String(error)
  // A database never migrated has no table: every migration is missing. One that does not answer
  // says nothing either way, and a deploy (a fix, say) should not wait on it.
  if (!/does not exist/.test(reason)) {
    console.warn(`check-migrations: no answer from the database, nothing checked (${reason}).`)
    process.exit(0)
  }
  done = new Set()
}
const missing = journal.entries.filter((entry) => !done.has(entry.when))
const host = new URL(url).hostname

if (missing.length === 0) {
  console.info(`check-migrations: ${host} has all ${journal.entries.length} migrations.`)
} else {
  const list = missing.map((entry) => entry.tag).join(', ')
  const message = `check-migrations: ${host} lacks ${list}. Run \`pnpm db:migrate${isProduction(url) ? ':prod' : ''}\` on it before deploying this commit.`
  if (preview) {
    console.warn(message)
  } else {
    console.error(message)
    process.exit(1)
  }
}
