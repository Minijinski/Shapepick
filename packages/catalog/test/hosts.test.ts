import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { atWidth, isShopPhoto, PHOTO_SOURCES } from '../src/media'
import { loadData } from '../src/node/load-data'

// The photo sources (src/media/hosts.ts) against the real catalogue (data/, not the demo one):
// every photo it lists must be fetchable, by our relay as by the image CDN, whose own list
// (netlify.toml) must say the same; and files anyone could publish on a shared CDN must not be.

const root = new URL('../../../', import.meta.url)
const data = await loadData(fileURLToPath(new URL('data/', root)))
const photos = [...data.keyboards, ...data.monitors, ...data.mice].flatMap((product) =>
  (product.images ?? []).map((image) => ({ slug: product.slug, url: image.url })),
)

describe('photo sources', () => {
  it('take every photo of the catalogue, at any width the site asks for', () => {
    expect(photos.length).toBeGreaterThan(1000)
    const refused = photos.filter(({ url }) => !isShopPhoto(url) || !isShopPhoto(atWidth(url, 400)))
    expect(
      refused,
      'Photos from a source not listed: add it to PHOTO_SOURCES (packages/catalog/src/media/hosts.ts) and to remote_images (netlify.toml), deployed before the seed that brings them.',
    ).toEqual([])
  })

  it('are the image CDN’s own list (netlify.toml)', async () => {
    const toml = await readFile(new URL('netlify.toml', root), 'utf8')
    // The list ends on a line of its own (a pattern may hold brackets); comments may hold quotes.
    const block = /remote_images\s*=\s*\[([\s\S]*?)\n\s*\]/.exec(toml)?.[1] ?? ''
    const listed = [...block.replace(/#.*$/gm, '').matchAll(/'([^']+)'/g)].map((match) => match[1])
    const expected = PHOTO_SOURCES.map((source) => `${source}.*`)
    expect({
      missing: expected.filter((pattern) => !listed.includes(pattern)),
      extra: listed.filter((pattern) => pattern && !expected.includes(pattern)),
    }).toEqual({ missing: [], extra: [] })
  })

  it('refuse files anyone could publish on a shared CDN, and every other address', () => {
    for (const url of [
      'https://res.cloudinary.com/demo/image/fetch/https://example.com/x.svg',
      'https://res.cloudinary.com/corsair-pwa/image/fetch/https://example.com/x.png',
      'https://cdn.sanity.io/images/abcd1234/production/x.svg',
      'https://images.ctfassets.net/someone/x/y/z.svg',
      'https://cdn.shopify.com/s/files/1/9999/9999/9999/files/x.svg',
      'https://cdn.shopify.com/s/files/1/0549/2681/9999/files/x.svg',
      'https://image.makewebeasy.net/makeweb/m_1920x0/someone/x.png',
      'https://cdn.shopify.com.example.com/s/files/1/0059/0630/1017/files/x.png',
      'http://cdn.shopify.com/s/files/1/0059/0630/1017/files/x.png',
      'https://example.com/x.png',
    ]) {
      expect(isShopPhoto(url), url).toBe(false)
    }
  })
})
