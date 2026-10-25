import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Netlify's CDN keeps what the site builds from the catalogue for a day, tagged `catalogue`
// (apps/web/src/cdn.ts, the same word): after a seed of production, this has it drop them, so the
// new data shows at once rather than within a day. A deploy empties the CDN anyway. It needs a
// Netlify personal access token in NETLIFY_AUTH_TOKEN (Netlify › User settings › Applications ›
// Personal access tokens) in the root .env; NETLIFY_SITE names the site when it is not
// `choose-a-device`, its first name. Run on its own: `pnpm db:purge-cdn`.

const TAG = 'catalogue'

/** Has Netlify's CDN drop the catalogue's pages; false when it could not. */
export async function purgeCatalogue(): Promise<boolean> {
  const token = process.env.NETLIFY_AUTH_TOKEN
  const site = process.env.NETLIFY_SITE ?? 'choose-a-device'
  if (!token) {
    console.warn(
      'CDN not purged (no NETLIFY_AUTH_TOKEN in .env): the site shows the previous catalogue for up to a day, or until the next deploy. `pnpm db:purge-cdn` once the token is there.',
    )
    return false
  }
  const response = await fetch('https://api.netlify.com/api/v1/purge', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ site_slug: site, cache_tags: [TAG] }),
  })
  if (!response.ok) {
    console.error(`CDN purge failed (${response.status}): ${(await response.text()).slice(0, 200)}`)
    return false
  }
  console.info(`CDN: what ${site} keeps of the catalogue was dropped.`)
  return true
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit((await purgeCatalogue()) ? 0 : 1)
}
