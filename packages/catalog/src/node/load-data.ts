import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'
import type { z } from 'zod'
import {
  brandSchema,
  keyboardInputSchema,
  monitorInputSchema,
  mouseInputSchema,
  switchSchema,
} from '../domain/schemas'

// Reads the versioned seed data (data/ at the repo root). Every file is validated with Zod so a typo
// in a spec fails loudly here, with the file and the field, instead of surfacing as a wrong answer.
// Node only: the browser never sees YAML, it gets the snapshot built from the database.

async function readList<S extends z.ZodType>(file: string, schema: S): Promise<z.infer<S>[]> {
  const raw = parse(await readFile(file, 'utf8')) ?? []
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((entry, i) => {
    const result = schema.safeParse(entry)
    if (!result.success) {
      const where = (entry as { slug?: string })?.slug ?? `#${i}`
      throw new Error(`${file} › ${where}\n${result.error.message}`)
    }
    return result.data
  })
}

async function readDir<S extends z.ZodType>(dir: string, schema: S): Promise<z.infer<S>[]> {
  // A category not imported yet has no folder: it simply has no products.
  const names = await readdir(dir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [] as string[]
    throw error
  })
  const files = names.filter((f) => /\.ya?ml$/.test(f)).sort()
  const lists = await Promise.all(files.map((f) => readList(join(dir, f), schema)))
  return lists.flat()
}

export async function loadData(dataDir: string) {
  const [brands, switches, keyboards, monitors, mice] = await Promise.all([
    readList(join(dataDir, 'brands.yaml'), brandSchema),
    readList(join(dataDir, 'switches.yaml'), switchSchema),
    readDir(join(dataDir, 'keyboards'), keyboardInputSchema),
    readDir(join(dataDir, 'monitors'), monitorInputSchema),
    readDir(join(dataDir, 'mice'), mouseInputSchema),
  ])
  for (const [kind, list] of [
    ['brand', brands],
    ['switch', switches],
    ['product', [...keyboards, ...monitors, ...mice]],
  ] as const) {
    const seen = new Set<string>()
    for (const { slug } of list) {
      if (seen.has(slug)) throw new Error(`Duplicate ${kind} slug "${slug}"`)
      seen.add(slug)
    }
  }
  return { brands, switches, keyboards, monitors, mice }
}
