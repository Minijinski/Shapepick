import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type KeyboardItem, productImageSchema, toKeyboardItems } from '@choose/catalog'
import { isolate, squareOn } from '@choose/catalog/media'
import { loadData } from '@choose/catalog/node'
import sharp from 'sharp'
import { type Document, isMap, isSeq, parse, parseDocument, type YAMLMap } from 'yaml'
import type { ShopifyProduct } from './shopify'

// pnpm ingest photos [--dry-run]: picks each keyboard's primary photo, the one the site shows. The
// site cuts a photo out in the browser and lets it stand in for the drawing on its canvas only if
// it shows the board from above (`squareOn`); a board whose primary photo is angled, shot on a
// colour or in a scene keeps its drawing there. So every photo of a board is judged here with the
// site's own code: those already in data/, then the rest of its gallery on the shop (Shopify
// galleries are in the import's cache). The first one seen from above becomes the primary; failing
// that, the first one of data/ that can be cut out at all (the product sheet shows any cut-out).
// A gallery has look-alikes (a collage, a banner, a diagram): those found on review go in the
// `photos` list of data/excluded.yaml and are never picked; a board's slug there keeps its
// primary as it is. Thumbnails (Corsair's `w_96`) are
// asked for at full size. The files are edited in place.

const cacheDir = fileURLToPath(new URL('../.cache', import.meta.url))
const photoDir = join(cacheDir, 'photos')
/** Width the photos are judged at: what the site asks for on a canvas, give or take. */
const WIDTH = 800
/** Gallery pictures judged per board at most, after those in data/. */
const GALLERY = 40
const CONCURRENCY = 6

type Candidate = { url: string; width?: number; height?: number; fromGallery: boolean }
type Verdict = 'square' | 'cutout' | 'none' | 'unreadable'

const CLOUDINARY = /^https:\/\/(assets\.corsair\.com|res\.cloudinary\.com)\//
/** The width step of a Cloudinary URL (`c_scale,q_auto,w_96/…`, its comma encoded or not). */
const CLOUDINARY_WIDTH = /(w_)\d+(?=,|%2C|\/)/i

/** A thumbnail URL asked for at full size (Cloudinary resizes on the fly: `w_96` → `w_2000`). */
export const fullSize = (url: string) =>
  CLOUDINARY.test(url) ? url.replace(CLOUDINARY_WIDTH, (_, step) => `${step}2000`) : url

/** The photo at the width it is judged at, from the shop's CDN. */
function judgedAt(url: string) {
  const u = new URL(url)
  if (u.hostname === 'cdn.shopify.com') {
    u.searchParams.set('width', String(WIDTH))
    return u.toString()
  }
  if (CLOUDINARY.test(url)) return url.replace(CLOUDINARY_WIDTH, (_, step) => `${step}${WIDTH}`)
  if (u.hostname === 'images.ctfassets.net') {
    u.searchParams.set('w', String(WIDTH))
    return u.toString()
  }
  // Razer's resizer carries the original, encoded, in its path.
  const wrapped = /^https:\/\/assets3\.razerzone\.com\/[^/]+\/\d+x\d+\/(https%3A%2F%2F.+)$/.exec(
    url,
  )
  return wrapped?.[1] ? decodeURIComponent(wrapped[1]) : url
}

/** The same photo whatever its cache-busting query (Shopify's `?v=`). */
const sameAs = (url: string) => url.replace(/\?.*$/, '')

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function bytesOf(url: string): Promise<Buffer | null> {
  const file = join(photoDir, createHash('sha1').update(url).digest('hex'))
  try {
    return await readFile(file)
  } catch {}
  try {
    await readFile(`${file}.missing`)
    return null
  } catch {}
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'choose-a-device-ingest/0.1 (+https://choose-a-device.netlify.app)',
        },
        signal: AbortSignal.timeout(20_000),
      })
      if (res.ok) {
        const bytes = Buffer.from(await res.arrayBuffer())
        await writeFile(file, bytes)
        return bytes
      }
      if (res.status < 500 && res.status !== 429) {
        await writeFile(`${file}.missing`, String(res.status))
        return null
      }
    } catch {}
    await sleep(1500 * (attempt + 1))
  }
  return null
}

async function judge(item: KeyboardItem, url: string): Promise<Verdict> {
  const bytes = await bytesOf(judgedAt(url))
  if (!bytes) return 'unreadable'
  try {
    const { data, info } = await sharp(bytes)
      .resize({ width: WIDTH, withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const pixels = {
      data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
      width: info.width,
      height: info.height,
    }
    const box = isolate(pixels)
    if (!box) return 'none'
    const fill = box.area / (box.w * box.h)
    const cut = { width: box.w, height: box.h, fill, parts: box.parts, detail: box.detail }
    return squareOn(item, cut) ? 'square' : 'cutout'
  } catch {
    return 'unreadable'
  }
}

/** Every product of the Shopify feeds in the import's cache, by product page URL. */
async function galleries() {
  const byPage = new Map<string, ShopifyProduct>()
  for (const host of await readdir(cacheDir)) {
    if (host === 'photos') continue
    for (const file of await readdir(join(cacheDir, host)).catch(() => [])) {
      if (!/products-json/.test(file)) continue
      try {
        const { products } = JSON.parse(await readFile(join(cacheDir, host, file), 'utf8')) as {
          products?: ShopifyProduct[]
        }
        for (const p of products ?? []) byPage.set(`https://${host}/products/${p.handle}`, p)
      } catch {}
    }
  }
  return byPage
}

const urlsOf = (node: YAMLMap<unknown, unknown>, key: string) => {
  const list = (node.get(key) as { toJSON?: () => unknown } | undefined)?.toJSON?.()
  return Array.isArray(list) ? list : []
}

export async function pickPhotos(dataDir: string, dry: boolean) {
  await mkdir(photoDir, { recursive: true })
  const data = await loadData(dataDir)
  const items = new Map(
    toKeyboardItems(data.keyboards, data.brands, data.switches).map((k) => [k.slug, k]),
  )
  const pages = await galleries()
  const listed = await readFile(join(dataDir, 'excluded.yaml'), 'utf8')
    .then((text) => ((parse(text) ?? {}) as { photos?: string[] }).photos ?? [])
    .catch(() => [] as string[])
  const excluded = new Set(listed.filter((entry) => entry.startsWith('https://')))
  const kept = new Set(listed.filter((entry) => !entry.startsWith('https://')))
  const dir = join(dataDir, 'keyboards')
  const files = (await readdir(dir)).filter((f) => /\.ya?ml$/.test(f)).sort()
  const docs = await Promise.all(
    files.map(async (file) => {
      const path = join(dir, file)
      return { path, doc: parseDocument(await readFile(path, 'utf8')) }
    }),
  )

  type Job = {
    doc: Document
    node: YAMLMap<unknown, unknown>
    item: KeyboardItem
    candidates: Candidate[]
  }
  const jobs: (Job & { path: string })[] = []
  for (const { path, doc } of docs) {
    if (!isSeq(doc.contents)) continue
    for (const node of doc.contents.items) {
      if (!isMap(node)) continue
      const entry = node as YAMLMap<unknown, unknown>
      const item = items.get(String(entry.get('slug')))
      if (!item || kept.has(item.slug)) continue
      const own = (urlsOf(entry, 'images') as { url: string; kind: string; primary?: boolean }[])
        .filter((img) => img.kind === 'cutout_top')
        .sort((a, b) => Number(!!b.primary) - Number(!!a.primary))
        .map((img): Candidate => ({ url: img.url, fromGallery: false }))
      const seen = new Set([...own.map((c) => sameAs(c.url)), ...excluded])
      const gallery: Candidate[] = []
      for (const page of urlsOf(entry, 'sources') as string[]) {
        for (const img of pages.get(page)?.images ?? []) {
          if (seen.has(sameAs(img.src))) continue
          seen.add(sameAs(img.src))
          gallery.push({ url: img.src, width: img.width, height: img.height, fromGallery: true })
        }
      }
      jobs.push({
        path,
        doc,
        node: entry,
        item,
        candidates: [
          ...own.filter((c) => !excluded.has(sameAs(c.url))),
          ...gallery.slice(0, GALLERY),
        ],
      })
    }
  }

  // Each board's photos in order, stopping at the first seen from above; boards side by side.
  const picks = new Map<Job, { chosen: Candidate | null; verdict: Verdict; tried: number }>()
  let next = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++]
        if (!job) break
        let fallback: Candidate | null = null
        let found: Candidate | null = null
        let tried = 0
        for (const candidate of job.candidates) {
          tried++
          const verdict = await judge(job.item, candidate.url)
          if (verdict === 'square') {
            found = candidate
            break
          }
          // Only a photo of data/ (one the import took for a product shot) stands in at an angle.
          if (verdict === 'cutout' && !fallback && !candidate.fromGallery) fallback = candidate
        }
        picks.set(job, {
          chosen: found ?? fallback,
          verdict: found ? 'square' : fallback ? 'cutout' : 'none',
          tried,
        })
      }
    }),
  )

  const changed: string[] = []
  const fallbacks: string[] = []
  const none: string[] = []
  const edited = new Set<string>()
  for (const job of jobs) {
    const pick = picks.get(job)
    const slug = job.item.slug
    const images = job.node.get('images')
    // Thumbnails at full size, whatever happens to the primary.
    if (isSeq(images)) {
      for (const img of images.items) {
        if (!isMap(img)) continue
        const url = String(img.get('url'))
        if (fullSize(url) !== url) {
          img.set('url', fullSize(url))
          edited.add(job.path)
        }
      }
    }
    if (!pick?.chosen) {
      none.push(slug)
      continue
    }
    if (pick.verdict === 'cutout') fallbacks.push(slug)
    const current = job.candidates[0]
    if (pick.chosen === current) continue
    if (!isSeq(images)) continue
    const target = sameAs(fullSize(pick.chosen.url))
    let entry = images.items.find(
      (img) => isMap(img) && sameAs(String(img.get('url'))) === target,
    ) as YAMLMap<unknown, unknown> | undefined
    for (const img of images.items) if (isMap(img)) img.delete('primary')
    if (entry) {
      images.items.splice(images.items.indexOf(entry), 1)
    } else {
      const { url, width, height } = pick.chosen
      const added = job.doc.createNode(
        productImageSchema.parse({
          url: fullSize(url),
          kind: 'cutout_top',
          ...(width && { width }),
          ...(height && { height }),
        }),
      ) as YAMLMap<unknown, unknown>
      added.flow = true
      entry = added
    }
    entry.set('primary', true)
    images.items.unshift(entry)
    edited.add(job.path)
    changed.push(
      `${slug} : ${pick.chosen.fromGallery ? 'galerie' : 'déjà en base'}${
        pick.verdict === 'cutout' ? ' (détourable, pas vue de dessus)' : ''
      }`,
    )
  }

  if (!dry) {
    for (const { path, doc } of docs) {
      if (edited.has(path)) await writeFile(path, doc.toString({ lineWidth: 0 }))
    }
  }
  const square = jobs.filter((j) => picks.get(j)?.verdict === 'square').length
  console.info(
    `${jobs.length} claviers : ${square} vus de dessus, ${fallbacks.length} détourables seulement, ${none.length} sans photo utilisable`,
  )
  console.info(`\nPhoto principale changée (${changed.length}) :`)
  for (const line of changed) console.info(`  ${line}`)
  if (fallbacks.length) console.info(`\nDétourables, pas vus de dessus : ${fallbacks.join(', ')}`)
  if (none.length) console.info(`\nAucune photo détourable : ${none.join(', ')}`)
  if (dry) console.info('\n--dry-run : rien n’a été écrit.')
}
