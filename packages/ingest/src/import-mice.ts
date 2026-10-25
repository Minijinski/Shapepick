import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { mouseInputSchema } from '@choose/catalog'
import { loadData } from '@choose/catalog/node'
import { readExcluded } from './excluded'
import { http } from './http'
import { type MouseDraft, type MouseSource, Skip } from './source'
import { appendEntries, compact } from './yaml'

// pnpm ingest <mouse source>: the next N mice of a brand that are not in data/ yet, validated with
// the seed's schema, appended to data/mice/<brand>.yaml with a review sheet. Same flow as the
// monitors (import-monitors.ts). Nothing reaches the database.

/**
 * A mouse's record without what its schema defaults anyway (false flags, a cable). A wireless
 * mouse that cannot be used wired says so: `connWired` defaults to yes.
 */
function compactMouse(input: MouseDraft['input']) {
  const specs: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input.specs)) {
    if (v === undefined) continue
    if (k === 'connWired') {
      if (v === false) specs[k] = false
    } else if (k === 'hosts') {
      if (typeof v === 'number' && v > 1) specs[k] = v
    } else if (v !== false) specs[k] = v
  }
  const out = compact(input) as Record<string, unknown>
  out.specs = specs
  return out
}

export async function importMice(
  source: MouseSource,
  {
    dataDir,
    wanted,
    dry,
    command,
    only,
  }: { dataDir: string; wanted: number; dry: boolean; command: string; only?: Set<string> },
) {
  const data = await loadData(dataDir)
  const known = new Set([...data.mice, ...data.monitors, ...data.keyboards].map((p) => p.slug))
  const excluded = await readExcluded(dataDir)
  const skipBrands = excluded.brandsFor('mouse')
  const brands = new Map(data.brands.map((b) => [b.slug, b]))
  const newBrands = new Map<string, { slug: string; name: string; website?: string }>()
  const drafts: (MouseDraft & { brandName: string })[] = []
  const skipped: string[] = []

  for (const candidate of await source.candidates()) {
    if (drafts.length >= wanted) break
    if (only?.size && !only.has(candidate.slug)) continue
    if (known.has(candidate.slug) || excluded.slugs.has(candidate.slug)) continue
    if (skipBrands.has(candidate.brand.slug)) continue
    try {
      const draft = await candidate.map()
      const check = mouseInputSchema.safeParse(draft.input)
      if (!check.success) {
        skipped.push(`${candidate.slug} : invalide\n${check.error.message}`)
        continue
      }
      if (!brands.has(candidate.brand.slug)) newBrands.set(candidate.brand.slug, candidate.brand)
      drafts.push({ ...draft, brandName: candidate.brand.name })
      known.add(candidate.slug)
      if (drafts.length % 10 === 0) console.info(`… ${drafts.length} souris`)
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
    `\n${drafts.length} souris, ${newBrands.size} nouvelles marques, ${http.requests} requêtes\n`,
  )
  console.info(
    row([
      ['slug', 36],
      ['forme', 6],
      ['main', 5],
      ['L × l × h', 18],
      ['g', 5],
      ['Hz', 5],
      ['liaison', 9],
      ['btn', 3],
      ['côté', 4],
      ['€', 5],
      ['prix', 10],
      ['photos', 6],
    ]),
  )
  const FROM = { shop: 'boutique', resellers: 'revendeurs', msrp: 'conseillé' }
  const SHAPE = { symmetrical: 'sym', ergonomic: 'ergo', vertical: 'vert', trackball: 'boule' }
  const HAND = { right: 'D', left: 'G', ambidextrous: 'ambi' }
  for (const { input: m, priceFrom } of drafts) {
    const s = m.specs
    const size = s.lengthMm ? `${s.lengthMm}×${s.widthMm}×${s.heightMm}` : '—'
    const link =
      [s.conn24ghz && '2.4', s.connBt && 'BT', s.connWired !== false && 'fil']
        .filter(Boolean)
        .join('+') || '—'
    console.info(
      row([
        [m.slug, 36],
        [SHAPE[s.shape], 6],
        [HAND[s.hand], 5],
        [size, 18],
        [s.weightG, 5],
        [s.pollingHz, 5],
        [link, 9],
        [s.buttons, 3],
        [s.sideButtons, 4],
        [m.msrpEur, 5],
        [priceFrom ? FROM[priceFrom] : '—', 10],
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
  await mkdir(join(dataDir, 'mice'), { recursive: true })
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
      join(dataDir, 'mice', `${brand}.yaml`),
      mine.map((d) => ({ value: compactMouse(d.input), notes: d.notes })),
      `Lot du ${date} : ${mine.length} modèles, ${source.label}`,
      {
        intro: [
          ...source.intro({ slug: brand, name: brandName }),
          '# Le script ajoute seulement les modèles absents : les corrections faites ici restent.',
          '# Mesures et poids lus sur la fiche officielle ; une variante est une couleur (une autre taille,',
          '# fréquence ou une version filaire est un autre produit). Prix indicatifs (boutique officielle',
          '# hors promo, sinon revendeurs listés par la marque, sinon prix conseillé de data/msrp.yaml),',
          '# arrondis à 5 €, mis à jour par pnpm ingest prices.',
          '# Une fois une note « à vérifier » traitée, supprimer le commentaire.',
        ].join('\n'),
      },
    )
  }
  // The files must still load as a whole: same validation as pnpm db:seed.
  const after = await loadData(dataDir)
  console.info(
    `\nÉcrit. data/ contient maintenant ${after.mice.length} souris. Relire puis pnpm db:seed.`,
  )
}
