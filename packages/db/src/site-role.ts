import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import postgres from 'postgres'
import { guardProduction } from './production'

// The site's own database role: it reads the catalogue and adds clicks, nothing more (it used to
// connect as the database's owner, who can drop every table). Run with the owner's connection
// (`pnpm db:site-role`, or `pnpm db:site-role:prod` for production): it creates the role or gives
// it a new password, grants what the site needs, and writes the site's connection URL (the pooled
// endpoint, as this role) into .env.site-role at the repo root, never on screen. Paste it into
// Netlify's DATABASE_URL (scopes Functions and Builds: the build checks the migrations), redeploy,
// then delete the file. Running it again changes the password: the old URL stops working.

const ROLE = 'shapepick_site'
/** What the site reads: the catalogue, and the migrations the build checks. */
const READ = [
  'brands',
  'switches',
  'products',
  'product_translations',
  'product_variants',
  'product_images',
  'keyboard_specs',
  'monitor_specs',
  'mouse_specs',
  'offers',
  'catalog_snapshots',
]

const owner = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!owner) throw new Error('DATABASE_URL is not set (see .env.example)')
guardProduction(owner, 'pnpm db:site-role')

const sql = postgres(owner, { max: 1, onnotice: () => {} })
// Letters, digits, - and _: nothing to escape, in SQL or in a URL.
const password = randomBytes(24).toString('base64url')
try {
  const [role] = await sql`select 1 from pg_roles where rolname = ${ROLE}`
  await sql.unsafe(`${role ? 'alter' : 'create'} role ${ROLE} with login password '${password}'`)
  const [{ name } = { name: '' }] = await sql<{ name: string }[]>`select current_database() as name`
  const existing = await sql<{ name: string }[]>`
    select tablename as name from pg_tables where schemaname = 'public'`
  const readable = READ.filter((table) => existing.some((t) => t.name === table))
  await sql.unsafe(`grant connect on database "${name}" to ${ROLE}`)
  await sql.unsafe(`grant usage on schema public to ${ROLE}`)
  // Nobody but the owner creates tables (Postgres' default since version 15, said here for any).
  await sql.unsafe('revoke create on schema public from public')
  await sql.unsafe(`revoke all on all tables in schema public from ${ROLE}`)
  await sql.unsafe(`grant select on ${readable.join(', ')} to ${ROLE}`)
  await sql.unsafe(`grant insert on outbound_clicks to ${ROLE}`)
  await sql.unsafe(`grant usage on sequence outbound_clicks_id_seq to ${ROLE}`)
  // Tables a later migration adds are readable too (the owner creates them).
  await sql.unsafe(`alter default privileges in schema public grant select on tables to ${ROLE}`)
  const [drizzle] = await sql`select 1 from pg_namespace where nspname = 'drizzle'`
  if (drizzle) {
    await sql.unsafe(`grant usage on schema drizzle to ${ROLE}`)
    await sql.unsafe(`grant select on drizzle.__drizzle_migrations to ${ROLE}`)
  }
  const site = new URL(process.env.DATABASE_URL ?? owner)
  site.username = ROLE
  site.password = password
  const file = new URL('../../../.env.site-role', import.meta.url)
  writeFileSync(
    file,
    `# ${ROLE} on ${site.hostname}: Netlify's DATABASE_URL\nDATABASE_URL=${site}\n`,
    {
      mode: 0o600,
    },
  )
  console.info(
    `${ROLE} ready on ${site.hostname} (reads ${readable.length} tables, adds clicks). Its URL is in .env.site-role.`,
  )
} finally {
  await sql.end()
}
