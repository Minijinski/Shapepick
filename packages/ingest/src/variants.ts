import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { KeyboardInput } from '@choose/catalog'
import { loadData } from '@choose/catalog/node'
import { type Document, isMap, isSeq, parseDocument, type YAMLMap } from 'yaml'
import { http, NotCached } from './http'
import { type Candidate, type KeyboardSource, Skip, type Source } from './source'
import { loadAliases, switchResolver } from './switches'
import { appendEntries, compact } from './yaml'

// pnpm ingest switches [--dry-run] [--accept slug,…]: the boards imported before their switches
// were known. An import keys a board's variants by colour, layout and switch; a switch it could not
// resolve left the key without one, so the variants of all such switches were merged into one per
// colour and layout. Once data/switches.yaml and data/switch-aliases.yaml know them, this runs each
// board's adapter again on the pages of the import's cache (never the network) and puts the
// variants it gets in place of the merged ones, if they cover the same colours and layouts;
// failing that, a board that names a single switch gets it on every variant, and any other is left
// a review note (`--accept` takes the rebuilt variants of a board reviewed after one). Only
// `variants` changes, prices judged against the board's own; the other fields and the comments
// stay, except the notes of the switches now known.

type Variant = KeyboardInput['variants'][number]
type Rebuilt = { variants: Variant[]; msrpEur?: number; notes: string[] } | { problem: string }

/** Technologies with a switch per variant: Topre domes, membranes and scissors have no record. */
const SWITCHED = new Set(['mechanical', 'optical', 'magnetic'])
/** The import's note on a switch it could not resolve ("switch « K Pro Red » : aucune fiche…"). */
const SWITCH_NOTE = /^ ?à vérifier : switch « (.+?) » : /
const REVIEW = 'switchs non reconstruits'

const coverOf = (variants: Variant[]) =>
  new Set(variants.map((v) => `${v.colorName} · ${v.layout}`))

/** The switch a variant already had (set by hand, say) when the page names none: the old variant
 * of the same SKU, else the one switch of the old variants of its colour and layout. */
function kept(old: Variant[], v: Variant) {
  const same = old.find((o) => v.sku && o.sku === v.sku)
  if (same) return same.switch
  const switches = new Set(
    old.filter((o) => o.colorName === v.colorName && o.layout === v.layout).map((o) => o.switch),
  )
  const [only] = switches
  return switches.size === 1 ? only : undefined
}

export type Outcome =
  | { how: 'rebuilt' | 'single'; variants: Variant[] }
  | { how: 'review'; problem: string }

/**
 * The variants a board gets. The rebuilt ones first, when they cover the same colours and layouts
 * as the merged ones (the merge only lost switches): a variant keeps a price of its own only 10 %
 * away from the board's, as at import, and one the page names no switch for keeps the switch it
 * had. Failing that, the one switch the board names (`single`) on every variant. Otherwise nothing
 * changes, and the problem says why.
 */
export function mergeVariants(
  old: Variant[],
  msrpEur: number,
  rebuilt: Rebuilt,
  single?: string,
  /** Reviewed: the rebuilt variants win even if colours or layouts changed (`--accept`). */
  accepted = false,
): Outcome {
  let problem: string
  if ('variants' in rebuilt) {
    const before = coverOf(old)
    const after = coverOf(rebuilt.variants)
    const lost = [...before].filter((c) => !after.has(c))
    const added = [...after].filter((c) => !before.has(c))
    if (accepted || (!lost.length && !added.length)) {
      // The single switch also goes where a listing named none, unless the page names others.
      const named = new Set(rebuilt.variants.map((v) => v.switch).filter(Boolean))
      const fill = single && [...named].every((s) => s === single) ? single : undefined
      return {
        how: 'rebuilt',
        variants: rebuilt.variants.map((v) => {
          const price = v.msrpEur ?? rebuilt.msrpEur
          const own = price && Math.abs(price - msrpEur) / msrpEur >= 0.1 ? price : undefined
          return { ...v, switch: v.switch ?? fill ?? kept(old, v), msrpEur: own }
        }),
      }
    }
    const changes = [
      lost.length ? `disparues : ${lost.join(', ')}` : '',
      added.length ? `nouvelles : ${added.join(', ')}` : '',
    ].filter(Boolean)
    problem = `la page ne donne plus les mêmes couleurs × dispositions (${changes.join(' ; ')})`
  } else problem = rebuilt.problem
  if (single) {
    return { how: 'single', variants: old.map((v) => (v.switch ? v : { ...v, switch: single })) }
  }
  return { how: 'review', problem }
}

/** The names of the switch notes of a comment block. */
export const switchNotes = (comment: string | null | undefined) => [
  ...new Set(
    (comment ?? '')
      .split('\n')
      .map((line) => SWITCH_NOTE.exec(line)?.[1])
      .filter((name): name is string => !!name),
  ),
]

/** A comment block without the switch notes `drop` accepts and the previous review note, with
 * `add` after the notes it keeps. Batch headers and other notes stay where they are. */
export function editNotes(
  comment: string | null | undefined,
  drop: (name: string) => boolean,
  add: string[],
) {
  const lines = (comment ?? '').split('\n').filter((line) => {
    const name = SWITCH_NOTE.exec(line)?.[1]
    if (name) return !drop(name)
    return !line.startsWith(` à vérifier : ${REVIEW}`)
  })
  for (const note of add) {
    const line = ` à vérifier : ${note}`
    if (!lines.includes(line)) lines.push(line)
  }
  const text = lines.join('\n')
  return text.trim() ? text : undefined
}

/** `variants` of a YAML entry replaced, one flow line per variant like the import writes them. */
export function setVariants(doc: Document, entry: YAMLMap<unknown, unknown>, variants: Variant[]) {
  const seq = doc.createNode(variants.map((v) => compact(v)))
  if (isSeq(seq)) for (const item of seq.items) if (isMap(item)) item.flow = true
  entry.set('variants', seq)
}

/** `accept`: slugs of boards reviewed after a note, whose rebuilt variants are taken anyway. */
export async function rebuildVariants(
  dataDir: string,
  sources: Source[],
  dry: boolean,
  accept: string[] = [],
) {
  http.offline = true
  const data = await loadData(dataDir)
  const resolver = switchResolver(data.switches, await loadAliases(dataDir, data.switches))
  const keyboards = new Map(data.keyboards.map((k) => [k.slug, k]))
  const keyboardSources = sources.filter(
    (s): s is KeyboardSource => (s.category ?? 'keyboard') === 'keyboard',
  )
  const lists = new Map<KeyboardSource, Promise<Map<string, Candidate>>>()

  /** The board's adapter run again on the cached pages it was imported from. */
  async function rebuild(k: KeyboardInput): Promise<Rebuilt> {
    const host = k.sources?.[0] && new URL(k.sources[0]).host
    const source = keyboardSources.find((s) => s.host === host)
    if (!source) return { problem: `aucune source d’import pour ${host ?? 'ce clavier'}` }
    let list = lists.get(source)
    if (!list) {
      list = source.candidates().then((cs) => new Map(cs.map((c) => [c.slug, c])))
      lists.set(source, list)
    }
    try {
      const candidate = (await list).get(k.slug)
      if (!candidate) return { problem: `modèle absent de la liste de ${source.host}` }
      const draft = await candidate.map(resolver)
      return { variants: draft.input.variants, msrpEur: draft.input.msrpEur, notes: draft.notes }
    } catch (e) {
      if (e instanceof Skip || e instanceof NotCached) return { problem: e.message }
      throw e
    }
  }

  const files = (await readdir(join(dataDir, 'keyboards'))).filter((f) => /\.ya?ml$/.test(f)).sort()
  const docs = await Promise.all(
    files.map(async (file) => {
      const path = join(dataDir, 'keyboards', file)
      const text = await readFile(path, 'utf8')
      return { path, text, doc: parseDocument(text) }
    }),
  )
  const report = { rebuilt: [] as string[], single: [] as string[], review: [] as string[] }
  const unknown = new Map<string, string[]>()
  const edited = new Set<string>()
  let targets = 0

  for (const { path, doc } of docs) {
    if (!isSeq(doc.contents)) continue
    for (const node of doc.contents.items) {
      if (!isMap(node)) continue
      const entry = node as YAMLMap<unknown, unknown>
      const k = keyboards.get(String(entry.get('slug')))
      if (!k || !SWITCHED.has(k.specs.technology) || k.variants.every((v) => v.switch)) continue
      targets++
      const named = switchNotes(entry.commentBefore)
      const resolved = new Map<string, string | undefined>()
      for (const name of named) resolved.set(name, (await resolver.resolve(name)).slug)
      const [onlyName] = named
      const single =
        named.length === 1 && onlyName && k.variants.every((v) => !v.switch)
          ? resolved.get(onlyName)
          : undefined

      const rebuilt = await rebuild(k)
      const outcome = mergeVariants(k.variants, k.msrpEur, rebuilt, single, accept.includes(k.slug))
      // Switch notes: the rebuild's own replace the old ones when its variants are used; otherwise
      // the old ones go once their switch is known.
      const fresh =
        outcome.how === 'rebuilt' && 'notes' in rebuilt
          ? rebuilt.notes.filter((n) => /^switch « /.test(n))
          : undefined
      const stillUnknown = fresh
        ? switchNotes(fresh.map((n) => ` à vérifier : ${n}`).join('\n'))
        : named.filter((name) => !resolved.get(name))
      const comment = editNotes(
        entry.commentBefore,
        (name) => !!fresh || !stillUnknown.includes(name),
        [...(fresh ?? []), ...(outcome.how === 'review' ? [`${REVIEW} : ${outcome.problem}`] : [])],
      )
      for (const name of stillUnknown) unknown.set(name, [...(unknown.get(name) ?? []), k.slug])

      if (outcome.how !== 'review') {
        setVariants(doc, entry, outcome.variants)
        const switches = new Set(outcome.variants.map((v) => v.switch).filter(Boolean))
        const missing = outcome.variants.filter((v) => !v.switch).length
        report[outcome.how].push(
          `${k.slug} : ${k.variants.length} → ${outcome.variants.length} variantes, ${switches.size} switchs${
            missing ? `, ${missing} variantes encore sans switch` : ''
          }`,
        )
      } else report.review.push(`${k.slug} : ${outcome.problem}`)
      if (comment !== entry.commentBefore || outcome.how !== 'review') {
        entry.commentBefore = comment
        edited.add(path)
      }
    }
  }

  const created = [...resolver.created.values()]
  console.info(
    `${targets} claviers à switchs avec des variantes sans switch : ${report.rebuilt.length} reconstruits depuis le cache, ${report.single.length} complétés avec leur seul switch, ${report.review.length} à relire\n`,
  )
  for (const [title, lines] of [
    ['Reconstruits', report.rebuilt],
    ['Un seul switch, mis sur toutes les variantes', report.single],
    ['À relire', report.review],
  ] as const) {
    if (!lines.length) continue
    console.info(`${title} (${lines.length}) :`)
    for (const line of lines) console.info(`  ${line}`)
    console.info('')
  }
  if (unknown.size) {
    console.info(`Switchs encore inconnus (${unknown.size}) :`)
    for (const [name, boards] of [...unknown].sort((a, b) => b[1].length - a[1].length)) {
      console.info(`  « ${name} » : ${boards.join(', ')}`)
    }
    console.info('')
  }
  if (created.length) {
    console.info('Nouveaux switchs, lus sur les fiches en cache :')
    for (const s of created) console.info(`  ${s.slug} · ${s.feel}`)
  }

  if (dry) {
    console.info('--dry-run : rien n’a été écrit.')
    return
  }
  const date = new Date().toISOString().slice(0, 10)
  await appendEntries(
    join(dataDir, 'switches.yaml'),
    created.map((s) => ({ value: compact(s), notes: resolver.notes.get(s.slug) })),
    `Switchs lus sur les fiches des boutiques (pnpm ingest switches, ${date})`,
    { flat: true },
  )
  let written = 0
  for (const { path, text, doc } of docs) {
    const out = doc.toString({ lineWidth: 0 })
    if (!edited.has(path) || out === text) continue
    await writeFile(path, out)
    written++
  }
  // The files must still load as a whole: same validation as pnpm db:seed.
  await loadData(dataDir)
  console.info(
    written || created.length
      ? `Écrit (${written} fichiers modifiés). Relire puis pnpm db:seed.`
      : 'Rien à écrire : les fichiers sont à jour.',
  )
}
