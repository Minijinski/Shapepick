import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isMap, isSeq, parseDocument, type YAMLMap } from 'yaml'
import { http } from './http'
import { msrps } from './msrp'
import { EUR_PER_USD, median, priceVariants, roundPrice } from './prices'
import type { PriceIndex, Source } from './source'

// pnpm ingest prices: the weekly refresh. For every entry of data/keyboards and data/monitors,
// today's regular price of each variant is read back by SKU from the shop the entry came from (its
// `sources`), then the usual policy applies (median, rounded to 5 €, a variant priced on its own
// only when 10 % apart). A monitor priced at its maker's recommended price (data/msrp.yaml) keeps
// it. Only prices change: the files are edited in place, comments and hand corrections stay.

const sourcesOf = (item: YAMLMap<unknown, unknown>) => {
  const urls = (item.get('sources') as { toJSON?: () => unknown } | undefined)?.toJSON?.()
  return Array.isArray(urls) ? urls.filter((u): u is string => typeof u === 'string') : []
}

export async function refreshPrices(dataDir: string, sources: Source[], dry: boolean) {
  http.refresh = true
  const fixed = await msrps()
  const paths = await Promise.all(
    ['keyboards', 'monitors'].map(async (category) => {
      const dir = join(dataDir, category)
      const files = await readdir(dir).catch(() => [] as string[])
      return files
        .filter((f) => /\.ya?ml$/.test(f))
        .sort()
        .map((f) => join(dir, f))
    }),
  )
  const docs = await Promise.all(
    paths.flat().map(async (path) => ({ path, doc: parseDocument(await readFile(path, 'utf8')) })),
  )
  // Pages to re-read per site (official sites price page by page; Shopify answers in one feed).
  const urlsByHost = new Map<string, string[]>()
  for (const { doc } of docs) {
    if (!isSeq(doc.contents)) continue
    for (const node of doc.contents.items) {
      if (!isMap(node)) continue
      for (const url of sourcesOf(node as YAMLMap<unknown, unknown>)) {
        const host = new URL(url).host
        urlsByHost.set(host, [...(urlsByHost.get(host) ?? []), url])
      }
    }
  }
  const indexes = new Map<string, Promise<PriceIndex>>()
  const indexFor = (source: Source) => {
    let index = indexes.get(source.host)
    if (!index) {
      index = source.priceIndex(urlsByHost.get(source.host) ?? [])
      indexes.set(source.host, index)
    }
    return index
  }
  const changed: string[] = []
  const missing: string[] = []
  let checked = 0

  for (const { path, doc } of docs) {
    if (!isSeq(doc.contents)) continue
    let edits = 0
    for (const node of doc.contents.items) {
      if (!isMap(node)) continue
      const item = node as YAMLMap<unknown, unknown>
      const slug = String(item.get('slug'))
      const [first] = sourcesOf(item)
      const host = first ? new URL(first).host : ''
      const source = sources.find((s) => s.host === host)
      const variants = item.get('variants')
      if (!source || !isSeq(variants) || fixed.has(slug)) continue
      checked++
      const index = await indexFor(source)
      const rows = variants.items.filter(isMap) as YAMLMap<unknown, unknown>[]
      const today = rows.map((v) => index.get(String(v.get('sku') ?? '')))
      // Same rule as the import: euro prices when the shop has any, dollar estimates otherwise.
      const direct = today.map((p) => p?.eur)
      const eur = direct.some(Boolean)
        ? direct
        : today.map((p) => (p?.usd ? p.usd * EUR_PER_USD : undefined))
      if (!eur.some(Boolean)) {
        missing.push(slug)
        continue
      }
      const priced = priceVariants(eur.map((msrpEur) => ({ msrpEur })))
      const usd = today.map((p) => p?.usd).filter((p): p is number => !!p)
      const before = Number(item.get('msrpEur'))
      if (priced.msrpEur && priced.msrpEur !== before) {
        item.set('msrpEur', priced.msrpEur)
        changed.push(`${slug} : ${before} → ${priced.msrpEur} €`)
        edits++
      }
      if (usd.length) item.set('msrpUsd', roundPrice(median(usd)))
      rows.forEach((v, i) => {
        const own = priced.variants[i]?.msrpEur
        if (own && own !== v.get('msrpEur')) {
          v.set('msrpEur', own)
          edits++
        } else if (!own && v.has('msrpEur') && eur[i]) {
          v.delete('msrpEur')
          edits++
        }
      })
    }
    if (edits && !dry) await writeFile(path, doc.toString({ lineWidth: 0 }))
  }

  console.info(
    `${checked} produits vérifiés, ${changed.length} prix changés, ${http.requests} requêtes`,
  )
  for (const c of changed) console.info(`  ${c}`)
  if (missing.length) {
    console.info(`\nPlus aucun SKU en vente (retirés ?) : ${missing.join(', ')}`)
  }
  if (dry) console.info('\n--dry-run : rien n’a été écrit.')
}
