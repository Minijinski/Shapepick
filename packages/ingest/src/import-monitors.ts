import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { monitorInputSchema } from '@choose/catalog'
import { loadData } from '@choose/catalog/node'
import { parse } from 'yaml'
import { http } from './http'
import { type MonitorDraft, type MonitorSource, Skip } from './source'
import { appendEntries, compact } from './yaml'

// pnpm ingest <monitor source>: the next N monitors of a brand that are not in data/monitors yet,
// validated with the seed's schema, appended to data/monitors/<brand>.yaml with a review sheet.
// Same flow as the keyboards (cli.ts), without switches. Nothing reaches the database.

/**
 * A monitor's record without what its schema defaults anyway (false flags, no USB-C power, no
 * travel). Tilt and VESA default to yes, so only their "no" is written; a stand's travel already
 * says it is height-adjustable (the schema derives it).
 */
function compactMonitor(input: MonitorDraft['input']) {
  const specs: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input.specs)) {
    if (v === undefined) continue
    if (k === 'tilt' || k === 'vesa') {
      if (v === false) specs[k] = false
    } else if (k === 'heightAdjustable') {
      if (v && !input.specs.standHeightMm) specs[k] = true
    } else if (v !== false && !((k === 'usbcPdW' || k === 'standHeightMm') && v === 0)) {
      specs[k] = v
    }
  }
  const out = compact(input) as Record<string, unknown>
  out.specs = specs
  return out
}

export async function importMonitors(
  source: MonitorSource,
  {
    dataDir,
    wanted,
    dry,
    command,
  }: { dataDir: string; wanted: number; dry: boolean; command: string },
) {
  const data = await loadData(dataDir)
  const known = new Set([...data.monitors, ...data.keyboards].map((p) => p.slug))
  const excluded = await readFile(join(dataDir, 'excluded.yaml'), 'utf8')
    .then((text) => (parse(text) ?? {}) as { slugs?: string[]; brands?: string[] })
    .catch(() => ({}) as { slugs?: string[]; brands?: string[] })
  const skipSlugs = new Set(excluded.slugs ?? [])
  const brands = new Map(data.brands.map((b) => [b.slug, b]))
  const newBrands = new Map<string, { slug: string; name: string; website?: string }>()
  const drafts: (MonitorDraft & { brandName: string })[] = []
  const skipped: string[] = []

  for (const candidate of await source.candidates()) {
    if (drafts.length >= wanted) break
    if (known.has(candidate.slug) || skipSlugs.has(candidate.slug)) continue
    try {
      const draft = await candidate.map()
      const check = monitorInputSchema.safeParse(draft.input)
      if (!check.success) {
        skipped.push(`${candidate.slug} : invalide\n${check.error.message}`)
        continue
      }
      if (!brands.has(candidate.brand.slug)) newBrands.set(candidate.brand.slug, candidate.brand)
      drafts.push({ ...draft, brandName: candidate.brand.name })
      known.add(candidate.slug)
      if (drafts.length % 10 === 0) console.info(`… ${drafts.length} écrans`)
    } catch (e) {
      if (!(e instanceof Skip)) throw e
      skipped.push(`${candidate.slug} : ${e.message}`)
    }
  }

  // ─── Review sheet ──────────────────────────────────────────────────────────────────────────────

  const pad = (s: unknown, n: number) =>
    String(s ?? '—')
      .padEnd(n)
      .slice(0, n)
  const row = (cells: [unknown, number][]) => cells.map(([s, n]) => pad(s, n)).join(' ')
  console.info(
    `\n${drafts.length} écrans, ${newBrands.size} nouvelles marques, ${http.requests} requêtes\n`,
  )
  console.info(
    row([
      ['slug', 40],
      ['taille', 7],
      ['définition', 10],
      ['dalle', 11],
      ['Hz', 4],
      ['HDR', 14],
      ['€', 5],
      ['prix', 10],
      ['pied', 6],
      ['photos', 6],
    ]),
  )
  const FROM = { shop: 'boutique', resellers: 'revendeurs', msrp: 'conseillé' }
  for (const { input: m, priceFrom } of drafts) {
    const s = m.specs
    const price = priceFrom ? FROM[priceFrom] : '—'
    console.info(
      row([
        [m.slug, 40],
        [`${s.diagonalIn}"${s.curvatureR ? 'C' : ''}`, 7],
        [`${s.resW}×${s.resH}`, 10],
        [s.panel, 11],
        [s.refreshHzMax, 4],
        [s.hdrCert, 14],
        [m.msrpEur, 5],
        [price, 10],
        [s.heightAdjustable ? `${s.standHeightMm || '?'}mm` : 'fixe', 6],
        [m.images?.length ?? 0, 6],
      ]),
    )
  }
  const withNotes = drafts.filter((d) => d.notes.length)
  if (withNotes.length) {
    console.info('\nÀ vérifier :')
    for (const d of withNotes) for (const n of d.notes) console.info(`  ${d.input.slug} · ${n}`)
  }
  if (skipped.length) console.info(`\nIgnorés :\n${skipped.map((s) => `  ${s}`).join('\n')}`)

  // ─── Write ─────────────────────────────────────────────────────────────────────────────────────

  if (dry) {
    console.info('\n--dry-run : rien n’a été écrit.')
    return
  }
  if (!drafts.length) return
  const date = new Date().toISOString().slice(0, 10)
  await appendEntries(
    join(dataDir, 'brands.yaml'),
    [...newBrands.values()].map((b) => ({ value: compact(b) })),
    `Marques importées (pnpm ingest ${command}, ${date})`,
    { flat: true },
  )
  for (const brand of new Set(drafts.map((d) => d.input.brand))) {
    const mine = drafts.filter((d) => d.input.brand === brand)
    const brandName = mine[0]?.brandName ?? brand
    await appendEntries(
      join(dataDir, 'monitors', `${brand}.yaml`),
      mine.map((d) => ({ value: compactMonitor(d.input), notes: d.notes })),
      `Lot du ${date} : ${mine.length} modèles, ${source.label}`,
      {
        intro: [
          ...source.intro({ slug: brand, name: brandName }),
          '# Le script ajoute seulement les modèles absents : les corrections faites ici restent.',
          '# Prix indicatifs (boutique officielle hors promo, sinon revendeurs listés par la marque, sinon',
          '# prix conseillé de data/msrp.yaml), arrondis à 5 €, mis à jour par pnpm ingest prices.',
          '# Une fois une note « à vérifier » traitée, supprimer le commentaire.',
        ].join('\n'),
      },
    )
  }
  // The files must still load as a whole: same validation as pnpm db:seed.
  const after = await loadData(dataDir)
  console.info(
    `\nÉcrit. data/ contient maintenant ${after.monitors.length} écrans. Relire puis pnpm db:seed.`,
  )
}
