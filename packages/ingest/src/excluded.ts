import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Category } from '@choose/catalog'
import { parse } from 'yaml'

// data/excluded.yaml: models and brands left out on purpose (curation), never imported again.
// Its top-level `brands:` list is the keyboards' (niche keyboard makers, Pulsar and Endgame Gear
// among them); a category keeps its own list under its name (`mouse: { brands: [...] }`).

type File = {
  slugs?: string[]
  brands?: string[]
  photos?: string[]
  mouse?: { brands?: string[] }
}

export async function readExcluded(dataDir: string) {
  const file = await readFile(join(dataDir, 'excluded.yaml'), 'utf8')
    .then((text) => (parse(text) ?? {}) as File)
    .catch(() => ({}) as File)
  return {
    slugs: new Set(file.slugs ?? []),
    /** The brands a category leaves out. */
    brandsFor: (category: Category) =>
      new Set(
        category === 'keyboard'
          ? (file.brands ?? [])
          : category === 'mouse'
            ? (file.mouse?.brands ?? [])
            : [],
      ),
  }
}
