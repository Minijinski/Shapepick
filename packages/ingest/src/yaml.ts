import { readFile, writeFile } from 'node:fs/promises'
import { Document, isMap, isSeq } from 'yaml'

// Batches are appended to the data files, never rewritten: corrections made by hand during review
// survive the next run. Layout follows data/keyboards/_demo.yaml: one block per product, specs and
// each variant on one flow line, notes as comments above the entry.

export type Entry = { value: object; notes?: string[] }

/** Drops what the schema defaults anyway: undefined fields, false flags, a wired connection. */
export function compact<T extends object>(value: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined || v === false || (k === 'connWired' && v === true)) continue
    if (k === 'status' && v === 'active') continue
    if (Array.isArray(v)) out[k] = v.map((x) => (x && typeof x === 'object' ? compact(x) : x))
    else if (v && typeof v === 'object') out[k] = compact(v)
    else out[k] = v
  }
  return out as T
}

export function toYaml(entries: Entry[], { flat = false } = {}) {
  const doc = new Document(entries.map((e) => e.value))
  if (!isSeq(doc.contents)) return ''
  doc.contents.items.forEach((item, i) => {
    if (!isMap(item)) return
    const notes = entries[i]?.notes ?? []
    if (notes.length) item.commentBefore = notes.map((n) => ` à vérifier : ${n}`).join('\n')
    if (flat) {
      item.flow = true
      return
    }
    if (i > 0) item.spaceBefore = true
    for (const pair of item.items) {
      if (isMap(pair.value)) pair.value.flow = true
      if (isSeq(pair.value)) for (const x of pair.value.items) if (isMap(x)) x.flow = true
    }
  })
  return doc.toString({ lineWidth: 0 })
}

export async function appendEntries(
  file: string,
  entries: Entry[],
  header: string,
  opts: { flat?: boolean; intro?: string } = {},
) {
  if (!entries.length) return
  let existing = ''
  try {
    existing = await readFile(file, 'utf8')
  } catch {}
  const block = `# ${header}\n${toYaml(entries, opts)}`
  const head = existing
    ? `${existing.replace(/\n*$/, '\n')}\n`
    : opts.intro
      ? `${opts.intro}\n\n`
      : ''
  await writeFile(file, head + block)
}
