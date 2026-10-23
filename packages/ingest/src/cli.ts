import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { keyboardInputSchema, switchSchema } from '@choose/catalog'
import { loadData } from '@choose/catalog/node'
import { parse } from 'yaml'
import { http } from './http'
import { importMonitors } from './import-monitors'
import { pickPhotos } from './photos'
import { refreshPrices } from './refresh-prices'
import { type Draft, Skip, type Source } from './source'
import * as corsair from './sources/corsair'
import * as keychron from './sources/keychron'
import * as logitech from './sources/logitech'
import * as mk from './sources/mk'
import { monitorSources } from './sources/monitors'
import * as razer from './sources/razer'
import * as steelseries from './sources/steelseries'
import * as stores from './sources/stores'
import { switchResolver } from './switches'
import { appendEntries, compact } from './yaml'

// pnpm ingest <source> [--next 10] [--dry-run] [--refresh]   import the next N models
//   keyboards: keychron, mk (mechanicalkeyboards.com), epomaker, womier, yunzii, ajazz, logitech,
//   logitechg, corsair, razer, steelseries, hyperx, turtlebeach
//   monitors (sources/monitors/, written to data/monitors): see monitorSources
// pnpm ingest prices [--dry-run]                              weekly price refresh, in place
// pnpm ingest photos [keyboards|monitors] [--dry-run]         each product's best photo as primary
//
// An import takes the next N models of a source that are not in data/keyboards yet, with the
// switches and brands they need, validates everything with the seed's Zod schemas, appends it to
// data/ and prints a review sheet. Nothing reaches the database: review, then run pnpm db:seed.

const sources: Record<string, Source> = {
  keychron: keychron.source,
  mk: mk.source,
  ...stores.sources,
  ...logitech.sources,
  corsair: corsair.source,
  razer: razer.source,
  steelseries: steelseries.source,
  ...monitorSources,
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    next: { type: 'string', default: '10' },
    'dry-run': { type: 'boolean', default: false },
    refresh: { type: 'boolean', default: false },
  },
})
const command = positionals[0] ?? 'keychron'
const dataDir = fileURLToPath(new URL('../../../data', import.meta.url))
const dry = values['dry-run']

if (command === 'prices') {
  await refreshPrices(dataDir, Object.values(sources), dry)
  process.exit(0)
}
if (command === 'photos') {
  await pickPhotos(dataDir, dry, positionals[1])
  process.exit(0)
}

const source = sources[command]
if (!source) {
  throw new Error(
    `Unknown source "${command}" (available: ${Object.keys(sources).join(', ')}, prices, photos)`,
  )
}
const wanted = Number(values.next)
http.refresh = values.refresh

if (source.category === 'monitor') {
  await importMonitors(source, { dataDir, wanted, dry, command })
  process.exit(0)
}

const data = await loadData(dataDir)
const known = new Set(data.keyboards.map((k) => k.slug))
// data/excluded.yaml: models and brands left out on purpose (curation), never imported again.
const excluded = await readFile(join(dataDir, 'excluded.yaml'), 'utf8')
  .then((text) => (parse(text) ?? {}) as { slugs?: string[]; brands?: string[] })
  .catch(() => ({}) as { slugs?: string[]; brands?: string[] })
const skipSlugs = new Set(excluded.slugs ?? [])
const skipBrands = new Set(excluded.brands ?? [])
const resolver = switchResolver(data.switches)
const drafts: (Draft & { brandName: string })[] = []
const skipped: string[] = []
const brands = new Map(data.brands.map((b) => [b.slug, b]))
const newBrands = new Map<string, { slug: string; name: string }>()

for (const candidate of await source.candidates()) {
  if (drafts.length >= wanted) break
  if (known.has(candidate.slug) || skipSlugs.has(candidate.slug)) continue
  if (skipBrands.has(candidate.brand.slug)) continue
  try {
    const draft = await candidate.map(resolver)
    const check = keyboardInputSchema.safeParse(draft.input)
    if (!check.success) {
      skipped.push(`${candidate.slug} : invalide\n${check.error.message}`)
      continue
    }
    if (!brands.has(candidate.brand.slug)) newBrands.set(candidate.brand.slug, candidate.brand)
    drafts.push({ ...draft, brandName: candidate.brand.name })
    known.add(candidate.slug)
    if (drafts.length % 10 === 0) console.info(`… ${drafts.length} modèles`)
  } catch (e) {
    if (!(e instanceof Skip)) throw e
    skipped.push(`${candidate.slug} : ${e.message}`)
  }
}
const switches = [...resolver.created.values()]
for (const s of switches) switchSchema.parse(s)

// ─── Review sheet ────────────────────────────────────────────────────────────────────────────────

const pad = (s: unknown, n: number) =>
  String(s ?? '—')
    .padEnd(n)
    .slice(0, n)
const row = (cells: [unknown, number][]) => cells.map(([s, n]) => pad(s, n)).join(' ')
console.info(
  `\n${drafts.length} claviers, ${switches.length} nouveaux switchs, ${newBrands.size} nouvelles marques, ${http.requests} requêtes\n`,
)
console.info(
  row([
    ['slug', 34],
    ['taille', 6],
    ['techno', 10],
    ['sans fil', 9],
    ['€', 6],
    ['kg', 5],
    ['var.', 4],
    ['dispositions', 60],
  ]),
)
for (const { input: k } of drafts) {
  const s = k.specs
  const wireless = [s.conn24ghz && '2.4', s.connBt && 'BT'].filter(Boolean).join('+') || 'filaire'
  const layouts = [...new Set(k.variants.map((v) => v.layout))].join(',')
  console.info(
    row([
      [k.slug, 34],
      [s.formFactor, 6],
      [s.technology, 10],
      [wireless, 9],
      [k.msrpEur, 6],
      [s.weightG && (s.weightG / 1000).toFixed(2), 5],
      [k.variants.length, 4],
      [layouts, 60],
    ]),
  )
}
const withNotes = drafts.filter((d) => d.notes.length)
if (withNotes.length) {
  console.info('\nÀ vérifier :')
  for (const d of withNotes) for (const n of d.notes) console.info(`  ${d.input.slug} · ${n}`)
}
if (switches.length) {
  console.info('\nNouveaux switchs :')
  for (const s of switches) {
    const figures =
      s.actuationForceG != null
        ? ` ${s.actuationForceG} gf, ${s.preTravelMm}/${s.totalTravelMm} mm`
        : ', ressenti seul'
    console.info(`  ${s.slug} · ${s.feel}${figures}`)
  }
}
if (skipped.length) console.info(`\nIgnorés :\n${skipped.map((s) => `  ${s}`).join('\n')}`)

// ─── Write ───────────────────────────────────────────────────────────────────────────────────────

if (dry) {
  console.info('\n--dry-run : rien n’a été écrit.')
} else if (drafts.length) {
  const date = new Date().toISOString().slice(0, 10)
  await appendEntries(
    join(dataDir, 'brands.yaml'),
    [...newBrands.values()].map((b) => ({ value: compact(b) })),
    `Marques importées (pnpm ingest ${command}, ${date})`,
    { flat: true },
  )
  await appendEntries(
    join(dataDir, 'switches.yaml'),
    switches.map((s) => ({ value: compact(s), notes: resolver.notes.get(s.slug) })),
    `Switchs lus sur les fiches des boutiques (pnpm ingest ${command}, ${date})`,
    { flat: true },
  )
  for (const brand of new Set(drafts.map((d) => d.input.brand))) {
    const mine = drafts.filter((d) => d.input.brand === brand)
    const brandName = mine[0]?.brandName ?? brand
    await appendEntries(
      join(dataDir, 'keyboards', `${brand}.yaml`),
      mine.map((d) => ({ value: compact(d.input), notes: d.notes })),
      `Lot du ${date} : ${mine.length} modèles, ${source.label}`,
      {
        intro: [
          ...source.intro({ slug: brand, name: brandName }),
          '# Le script ajoute seulement les modèles absents : les corrections faites ici restent.',
          '# Prix indicatifs (prix habituel hors promo, arrondi à 5 €), mis à jour par pnpm ingest prices.',
          '# Une fois une note « à vérifier » traitée, supprimer le commentaire.',
        ].join('\n'),
      },
    )
  }
  // The files must still load as a whole: same validation as pnpm db:seed.
  const after = await loadData(dataDir)
  console.info(
    `\nÉcrit. data/ contient maintenant ${after.keyboards.length} claviers. Relire puis pnpm db:seed.`,
  )
}
