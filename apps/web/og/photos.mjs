// The photos on the share card (card.html): three products of the catalogue, each from its primary
// photo, cut out with the site's own code (@choose/catalog/media) and kept at twice the width the
// card shows them at. To make them again, from apps/web, with Node 24 (it reads the .ts as is):
//
//   node og/photos.mjs
//
// sharp and yaml come from the ingest's dependencies.

import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const root = new URL('../../../', import.meta.url)
const require = createRequire(new URL('packages/ingest/package.json', root))
const sharp = require('sharp')
const YAML = require('yaml')
const { atWidth } = await import(new URL('packages/catalog/src/media/cdn.ts', root).href)
const { isolate } = await import(new URL('packages/catalog/src/media/cutout.ts', root).href)

/** Each product and the width the card draws it at, in CSS pixels. */
const shown = [
  { category: 'mice', slug: 'logitech-pro-x-superlight-2', width: 100 },
  { category: 'keyboards', slug: 'keychron-q1-he', width: 392 },
  { category: 'monitors', slug: 'samsung-viewfinity-s9-s90pc-27', width: 400 },
]
const out = new URL('photos/', import.meta.url)
mkdirSync(out, { recursive: true })

/** The photo at full size: Logitech's resizer asked for a large PNG, the others through atWidth. */
const fullSize = (url) =>
  /^https:\/\/resource\.logitechg?\.com\//.test(url)
    ? url.replace(/\/c_fill,q_auto,f_auto,dpr_1\.0\//, '/c_fit,w_2400,q_100,f_png/')
    : atWidth(url, 2400)

for (const { category, slug, width } of shown) {
  const dir = new URL(`data/${category}/`, root)
  const product = readdirSync(dir)
    .flatMap((file) => YAML.parse(readFileSync(new URL(file, dir), 'utf8')) ?? [])
    .find((item) => item.slug === slug)
  const photo = product?.images?.find((image) => image.primary)
  if (!photo) throw new Error(`${slug}: no primary photo in data/${category}`)
  const res = await fetch(fullSize(photo.url), {
    headers: { 'user-agent': 'shapepick-ingest/0.1 (+https://shapepick.com)' },
  })
  if (!res.ok) throw new Error(`${slug}: ${res.status} for ${photo.url}`)
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const pixels = {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
    width: info.width,
    height: info.height,
  }
  const box = isolate(pixels)
  if (!box) throw new Error(`${slug}: nothing to cut out`)
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .resize({ width: width * 2, kernel: 'lanczos3' })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(new URL(`${slug}.webp`, out).pathname)
  console.log(`${slug}: ${box.w}×${box.h} cut out of ${info.width}×${info.height}`)
}
