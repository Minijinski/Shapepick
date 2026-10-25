import { defineConfig } from 'drizzle-kit'
import { guardProduction } from './src/production'

// `.env` is the database being worked on; `pnpm db:migrate:prod` (DB_ENV=prod) reads production's
// from `.env.prod` first (the first file read wins). A migration about to reach production any
// other way stops (src/production.ts).
for (const file of process.env.DB_ENV === 'prod'
  ? ['../../.env.prod', '../../.env']
  : ['../../.env']) {
  try {
    process.loadEnvFile(file)
  } catch {}
}
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? ''
if (url && process.argv.some((arg) => arg === 'migrate' || arg === 'push')) {
  guardProduction(url, `drizzle-kit ${process.argv.includes('push') ? 'push' : 'migrate'}`)
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  // On Neon, migrations go through the direct endpoint: the pooler (PgBouncer) keeps no session.
  dbCredentials: { url },
})
