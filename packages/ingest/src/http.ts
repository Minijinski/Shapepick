import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Every page is fetched once, politely (one request every 1.5 s per site, slower where a site asks
// for it, an honest user agent, backing off on 429), then served from disk: re-running a batch or
// tweaking a mapper never hits the shop again. `--refresh` re-downloads what the run touches.

const cacheDir = fileURLToPath(new URL('../.cache', import.meta.url))
/** Who fetches, and where to find out: every request of the import says it. */
export const userAgent = 'shapepick-ingest/0.1 (+https://shapepick.com)'
const gapMs = 1500
/** Slower sites: corsair.com's robots.txt suggests 10 s (commented out), heavier pages elsewhere. */
const gaps: Record<string, number> = {
  'www.corsair.com': 4000,
  'www.razer.com': 2500,
  'www.logitech.com': 2500,
  'www.logitechg.com': 2500,
  'steelseries.com': 2500,
  // Monitor sites: heavy pages (1 to 3 MB of HTML); MSI's store answered 429 at a faster pace.
  'www.samsung.com': 2500,
  'www.lg.com': 3000,
  'www.dell.com': 3000,
  'fr-store.msi.com': 4000,
  'www.aoc.com': 2500,
  'www.asus.com': 2500,
  'rog.asus.com': 2500,
  'odinapi.asus.com': 2000,
  'www.philips.fr': 2500,
  'www.benq.eu': 2500,
  'zowie.benq.eu': 2500,
  // Shopify stores limited the agent after a burst (23 October): one page every 4 s.
  'turtlebeach.com': 4000,
  'www.keychron.com': 4000,
  'eu.pulsar.gg': 4000,
  'www.gloriousgaming.com': 4000,
  'eu.gloriousgaming.com': 4000,
  'akkogear.com': 4000,
  'en.akkogear.com': 4000,
  'nuphy.com': 4000,
  'eu.nuphy.com': 4000,
  // Answered 429 to switch pages fetched one at a time (24 October).
  'epomaker.com': 4000,
  // Shopify stores read for photos, colours and sheets (24 October): the same pace.
  'www.rkgamingstore.com': 4000,
  'redragonshop.com': 4000,
  'www.lamzu.com': 4000,
  'www.endgamegear.com': 4000,
  'www.atk.store': 4000,
  'finalmouse.com': 4000,
}

/** `offline`: the cache only, for runs that must read what an import read (pnpm ingest switches). */
export const http = { refresh: false, offline: false, requests: 0 }
const last = new Map<string, number>()

/** A page the cache lacks, asked for while `http.offline` is set. */
export class NotCached extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function cacheFile(url: URL) {
  const hash = createHash('sha1')
    .update(url.pathname + url.search)
    .digest('hex')
    .slice(0, 10)
  const name = url.pathname
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return join(cacheDir, url.host, `${name || 'index'}-${hash}`)
}

/**
 * `referer`: the page an API belongs to, sent as a browser sends it when that page calls the API
 * (ZOWIE's price and retailer APIs answer 401 to a call that names no page of the site).
 */
export async function get(href: string, opts: { referer?: string } = {}): Promise<string> {
  const url = new URL(href)
  const file = cacheFile(url)
  if (!http.refresh) {
    try {
      return await readFile(file, 'utf8')
    } catch {}
  }
  if (http.offline) throw new NotCached(`absent du cache : ${href}`)
  const headers: Record<string, string> = { 'user-agent': userAgent }
  if (opts.referer) headers.referer = opts.referer
  for (let attempt = 0; ; attempt++) {
    const wait = (last.get(url.host) ?? 0) + (gaps[url.host] ?? gapMs) - Date.now()
    if (wait > 0) await sleep(wait)
    last.set(url.host, Date.now())
    http.requests++
    const res = await fetch(url, { headers })
    if (res.ok) {
      const body = await res.text()
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, body)
      return body
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const retryAfter = Number(res.headers.get('retry-after'))
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 10_000)
      continue
    }
    throw new Error(`GET ${href} → ${res.status}`)
  }
}

export const getJson = async <T>(href: string, opts: { referer?: string } = {}): Promise<T> =>
  JSON.parse(await get(href, opts)) as T
