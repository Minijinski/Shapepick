// Production's database is written to on purpose only. `.env` points at a database to work on (the
// local one, a Neon branch); production's addresses live in `.env.prod`, read by the `:prod`
// scripts (`pnpm db:seed:prod`, `db:migrate:prod`, `db:site-role:prod`), which say so with
// CONFIRM_PROD=1. Any other script that finds itself about to write to production stops.

/** Whether a database URL is production's: a Neon endpoint, unless NEON_BRANCH names another branch. */
export const isProduction = (url: string) =>
  new URL(url).hostname.endsWith('.neon.tech') &&
  (process.env.NEON_BRANCH ?? 'production') === 'production'

/** Stops `what` (a seed, a migration…) about to write to production without CONFIRM_PROD=1. */
export function guardProduction(url: string, what: string) {
  if (!isProduction(url) || process.env.CONFIRM_PROD === '1') return
  console.error(
    `${what} would write to the production database. Run its :prod script (pnpm db:seed:prod, db:migrate:prod…), which reads .env.prod, or set CONFIRM_PROD=1.`,
  )
  process.exit(1)
}
