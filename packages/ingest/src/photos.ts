import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type CatalogItem,
  productImageSchema,
  toKeyboardItems,
  toMonitorItems,
} from '@choose/catalog'
import { atWidth, isolate, squareOn } from '@choose/catalog/media'
import { loadData } from '@choose/catalog/node'
import sharp from 'sharp'
import { type Document, isMap, isSeq, parse, parseDocument, type YAMLMap } from 'yaml'
import type { ShopifyProduct } from './shopify'

// pnpm ingest photos [--dry-run]: picks each product's primary photo, the one the site shows. The
// site cuts a photo out in the browser and lets it stand in for the drawing on its canvas only if
// it shows the product as its drawing does (`squareOn`): a keyboard from above, a monitor from the
// front; one whose primary photo is angled, shot on a colour or in a scene keeps its drawing there. So every photo of a board is judged here with the
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
  // Razer's resizer carries the original, encoded, in its path.
  const wrapped = /^https:\/\/assets3\.razerzone\.com\/[^/]+\/\d+x\d+\/(https%3A%2F%2F.+)$/.exec(
    url,
  )
  return wrapped?.[1] ? decodeURIComponent(wrapped[1]) : atWidth(url, WIDTH)
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

async function judge(item: CatalogItem, url: string): Promise<Verdict> {
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
    const cut = {
      width: box.w,
      height: box.h,
      fill,
      parts: box.parts,
      detail: box.detail,
      symmetry: box.symmetry,
    }
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

export async function pickPhotos(dataDir: string, dry: boolean, only?: string) {
  await mkdir(photoDir, { recursive: true })
  const data = await loadData(dataDir)
  const items = new Map<string, CatalogItem>([
    ...toKeyboardItems(data.keyboards, data.brands, data.switches).map((k) => [k.slug, k] as const),
    ...toMonitorItems(data.monitors, data.brands).map((m) => [m.slug, m] as const),
  ])
  const pages = await galleries()
  const listed = await readFile(join(dataDir, 'excluded.yaml'), 'utf8')
    .then((text) => ((parse(text) ?? {}) as { photos?: string[] }).photos ?? [])
    .catch(() => [] as string[])
  const excluded = new Set(listed.filter((entry) => entry.startsWith('https://')))
  const kept = new Set(listed.filter((entry) => !entry.startsWith('https://')))
  // A keyboard is shown from above, a monitor from the front.
  const views = { keyboards: 'cutout_top', monitors: 'cutout_front' } as const
  const docs = (
    await Promise.all(
      (Object.keys(views) as (keyof typeof views)[])
        .filter((category) => !only || category === only)
        .map(async (category) => {
          const dir = join(dataDir, category)
          const files = (await readdir(dir).catch(() => [] as string[]))
            .filter((f) => /\.ya?ml$/.test(f))
            .sort()
          return Promise.all(
            files.map(async (file) => {
              const path = join(dir, file)
              return {
                path,
                view: views[category],
                doc: parseDocument(await readFile(path, 'utf8')),
              }
            }),
          )
        }),
    )
  ).flat()

  type Job = {
    doc: Document
    node: YAMLMap<unknown, unknown>
    item: CatalogItem
    view: string
    /** The primary photo in data/, excluded or not. */
    primary?: string
    candidates: Candidate[]
  }
  const jobs: (Job & { path: string })[] = []
  for (const { path, view, doc } of docs) {
    if (!isSeq(doc.contents)) continue
    for (const node of doc.contents.items) {
      if (!isMap(node)) continue
      const entry = node as YAMLMap<unknown, unknown>
      const item = items.get(String(entry.get('slug')))
      if (!item || kept.has(item.slug)) continue
      const own = (urlsOf(entry, 'images') as { url: string; kind: string; primary?: boolean }[])
        .filter((img) => img.kind === view)
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
        view,
        primary: own[0]?.url,
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
    // Already the primary (an excluded primary is replaced, even by the next photo in data/).
    if (job.primary && sameAs(fullSize(pick.chosen.url)) === sameAs(fullSize(job.primary))) continue
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
          kind: job.view,
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
        pick.verdict === 'cutout'
          ? job.view === 'cutout_top'
            ? ' (détourable, pas vue de dessus)'
            : ' (détourable, pas vue de face)'
          : ''
      }`,
    )
  }

  if (!dry) {
    for (const { path, doc } of docs) {
      if (edited.has(path)) await writeFile(path, doc.toString({ lineWidth: 0 }))
    }
  }
  for (const [view, what, seen] of [
    ['cutout_top', 'claviers', 'vus de dessus'],
    ['cutout_front', 'écrans', 'vus de face'],
  ] as const) {
    const mine = jobs.filter((j) => j.view === view)
    if (!mine.length) continue
    const square = mine.filter((j) => picks.get(j)?.verdict === 'square').length
    const cut = mine.filter((j) => picks.get(j)?.verdict === 'cutout').length
    const lost = mine.filter((j) => !picks.get(j)?.chosen).length
    console.info(
      `${mine.length} ${what} : ${square} ${seen}, ${cut} détourables seulement, ${lost} sans photo utilisable`,
    )
  }
  console.info(`\nPhoto principale changée (${changed.length}) :`)
  for (const line of changed) console.info(`  ${line}`)
  if (fallbacks.length) {
    console.info(`\nDétourables, pas dans l'angle du dessin : ${fallbacks.join(', ')}`)
  }
  if (none.length) console.info(`\nAucune photo détourable : ${none.join(', ')}`)
  if (dry) console.info('\n--dry-run : rien n’a été écrit.')
}
