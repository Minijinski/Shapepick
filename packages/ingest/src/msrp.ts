import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

// data/msrp.yaml: the makers' recommended prices of the monitors whose brand sells nowhere online
// in France and whose page shows no reseller price (ASUS, Philips, BenQ). Kept by hand, each with
// the page it was read on: a press release, or the tech press quoting the maker's price (UVP,
// MSRP), found through a search engine, never on a reseller's site; prices from 2023 on only. The
// adapters read it; the weekly price refresh leaves these prices alone.

export type Msrp = { eur: number; source: string }

const file = fileURLToPath(new URL('../../../data/msrp.yaml', import.meta.url))
let cache: Promise<Map<string, Msrp>> | undefined

export function msrps(): Promise<Map<string, Msrp>> {
  cache ??= readFile(file, 'utf8')
    .then((text) => {
      const raw = (parse(text) ?? {}) as Record<string, Msrp>
      return new Map(
        Object.entries(raw).filter(([, v]) => v && v.eur > 0 && typeof v.source === 'string'),
      )
    })
    .catch(() => new Map<string, Msrp>())
  return cache
}
