import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { KeyboardInput } from '@choose/catalog'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isMap, isSeq, parseDocument, type YAMLMap } from 'yaml'
import type { Source } from '../src/source'
import { switchOf } from '../src/sources/keychron'
import {
  editNotes,
  mergeVariants,
  rebuildVariants,
  setVariants,
  switchNotes,
} from '../src/variants'

type Variant = KeyboardInput['variants'][number]
/** A variant with its keys in the order adapters give them (SKU first). */
const v = (
  colorName: string,
  layout: Variant['layout'],
  extra: Partial<Variant> = {},
): Variant => ({
  sku: extra.sku,
  colorName,
  colorFamily: 'black',
  layout,
  ...extra,
})

describe('rebuilt variants', () => {
  const old = [v('Black', 'ansi_us', { sku: 'A' }), v('Black', 'iso_fr', { sku: 'F' })]
  const split = {
    variants: [
      v('Black', 'ansi_us', { sku: 'A1', switch: 'red' }),
      v('Black', 'ansi_us', { sku: 'A2', switch: 'brown', msrpEur: 150 }),
      v('Black', 'iso_fr', { sku: 'F1', switch: 'red' }),
    ],
    msrpEur: 105,
    notes: [],
  }

  it('replace the merged ones when colours and layouts stay the same', () => {
    const out = mergeVariants(old, 100, split)
    expect(out.how).toBe('rebuilt')
    // Prices are judged against the board's own: 105 € is within 10 % of it, 150 € is not.
    expect(out.how !== 'review' && out.variants).toEqual([
      v('Black', 'ansi_us', { sku: 'A1', switch: 'red', msrpEur: undefined }),
      v('Black', 'ansi_us', { sku: 'A2', switch: 'brown', msrpEur: 150 }),
      v('Black', 'iso_fr', { sku: 'F1', switch: 'red', msrpEur: undefined }),
    ])
  })

  it('leave a review note when colours or layouts changed, unless the board was reviewed', () => {
    const changed = { ...split, variants: split.variants.slice(0, 2) }
    const out = mergeVariants(old, 100, changed)
    expect(out).toEqual({
      how: 'review',
      problem: expect.stringContaining('disparues : Black · iso_fr'),
    })
    expect(mergeVariants(old, 100, changed, undefined, true).how).toBe('rebuilt')
  })

  it('put the one switch a board names on every variant when the page cannot be read', () => {
    const out = mergeVariants(old, 100, { problem: 'absent du cache' }, 'red')
    expect(out.how !== 'review' && out.variants.map((x) => x.switch)).toEqual(['red', 'red'])
    expect(mergeVariants(old, 100, { problem: 'absent du cache' }).how).toBe('review')
  })

  it('fill a variant the page names no switch for with the only one, or keep one set by hand', () => {
    const page = {
      variants: [v('Black', 'ansi_us', { sku: 'A' }), v('Black', 'iso_fr', { sku: 'F' })],
      notes: [],
    }
    const single = mergeVariants(old, 100, page, 'red')
    expect(single.how !== 'review' && single.variants.map((x) => x.switch)).toEqual(['red', 'red'])
    const byHand = [v('Black', 'ansi_us', { sku: 'A', switch: 'brown' }), old[1] as Variant]
    const kept = mergeVariants(byHand, 100, page)
    expect(kept.how !== 'review' && kept.variants.map((x) => x.switch)).toEqual([
      'brown',
      undefined,
    ])
  })
})

describe('switch notes', () => {
  const comment = [
    ' Lot du 2026-10-21 : 2 modèles',
    ' à vérifier : switch « K Pro Red » : aucune fiche trouvée, à saisir dans data/switches.yaml',
    ' à vérifier : poids introuvable',
    ' à vérifier : switch « Apex Red » : aucune fiche trouvée, à saisir dans data/switches.yaml',
  ].join('\n')

  it('name the switches the import could not resolve', () => {
    expect(switchNotes(comment)).toEqual(['K Pro Red', 'Apex Red'])
  })

  it('go once their switch is known; headers, other notes and new notes stay', () => {
    const out = editNotes(comment, (name) => name === 'K Pro Red', ['switch « X » : nouvelle'])
    expect(out?.split('\n')).toEqual([
      ' Lot du 2026-10-21 : 2 modèles',
      ' à vérifier : poids introuvable',
      ' à vérifier : switch « Apex Red » : aucune fiche trouvée, à saisir dans data/switches.yaml',
      ' à vérifier : switch « X » : nouvelle',
    ])
    expect(editNotes(' à vérifier : switch « A » : x', () => true, [])).toBeUndefined()
  })
})

describe('YAML rewrite', () => {
  it('replaces the variants only, one flow line each, comments kept', () => {
    const doc = parseDocument(
      [
        '# Marque : en-tête du fichier.',
        '',
        '# à vérifier : switch « K Pro Red » : aucune fiche trouvée',
        '- slug: test-board',
        '  name: Test',
        '  specs: { formFactor: f75, technology: mechanical }',
        '  variants:',
        '    - { sku: A, colorName: Black, colorFamily: black, layout: ansi_us }',
        '',
      ].join('\n'),
    )
    const entry = (isSeq(doc.contents) && doc.contents.items[0]) as YAMLMap<unknown, unknown>
    setVariants(doc, entry, [
      v('Black', 'ansi_us', { sku: 'A1', switch: 'red' }),
      v('Black', 'ansi_us', { sku: 'A2', switch: 'brown', msrpEur: 150 }),
    ])
    entry.commentBefore = editNotes(entry.commentBefore, () => true, [])
    expect(doc.toString({ lineWidth: 0 })).toBe(
      [
        '# Marque : en-tête du fichier.',
        '',
        '- slug: test-board',
        '  name: Test',
        '  specs: { formFactor: f75, technology: mechanical }',
        '  variants:',
        '    - { sku: A1, colorName: Black, colorFamily: black, layout: ansi_us, switch: red }',
        '    - { sku: A2, colorName: Black, colorFamily: black, layout: ansi_us, switch: brown, msrpEur: 150 }',
        '',
      ].join('\n'),
    )
  })
})

describe('Keychron switch options', () => {
  it('join a family and its colour split over two options', () => {
    expect(
      switchOf({
        'Switch Type': 'Low Profile Gateron Mechanical (Hot-swappable)',
        'Switch Option': 'Red',
      }),
    ).toBe('Low Profile Gateron Mechanical Red')
    expect(
      switchOf({ 'Type de Switches': 'Keychron Super Switch', 'Option de commutation': 'Brown' }),
    ).toBe('Keychron Super Switch Brown')
  })

  it('read the family from an option named after it', () => {
    expect(switchOf({ 'Keychron Ultra-Fast Lime Magnetic Switch': 'Silent Red' })).toBe(
      'Keychron Ultra-Fast Lime Magnetic Silent Red',
    )
  })

  it('keep a full name, and leave mount and pin options out', () => {
    expect(switchOf({ Switches: 'Keychron K Pro Red', 'Switch Mount': 'Hot-swappable' })).toBe(
      'Keychron K Pro Red',
    )
    expect(switchOf({ Color: 'Black', 'Switch Pin': '5-pin' })).toBeUndefined()
  })
})

describe('pnpm ingest switches', () => {
  let dir: string | undefined
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('rebuilds the merged variants of a board from its source, in place', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    dir = await mkdtemp(join(tmpdir(), 'switches-'))
    await mkdir(join(dir, 'keyboards'))
    await writeFile(join(dir, 'brands.yaml'), '- { slug: test, name: Test }\n')
    await writeFile(
      join(dir, 'switches.yaml'),
      [
        '- { slug: keychron-k-pro-red, brand: Keychron, name: K Pro Red, feel: linear, tech: mechanical }',
        '- { slug: keychron-k-pro-brown, brand: Keychron, name: K Pro Brown, feel: tactile, tech: mechanical }',
        '',
      ].join('\n'),
    )
    await writeFile(
      join(dir, 'switch-aliases.yaml'),
      'keychron-k-pro-red: [K Pro Red]\nkeychron-k-pro-brown: [K Pro Brown]\n',
    )
    const board = join(dir, 'keyboards', 'test.yaml')
    await writeFile(
      board,
      [
        '# Test : en-tête.',
        '',
        '# à vérifier : switch « K Pro Red » : aucune fiche trouvée, à saisir dans data/switches.yaml',
        '# à vérifier : switch « K Pro Brown » : aucune fiche trouvée, à saisir dans data/switches.yaml',
        '# à vérifier : poids introuvable',
        '- slug: test-board',
        '  brand: test',
        '  name: Board',
        '  msrpEur: 100',
        '  sources:',
        '    - https://shop.test/products/board',
        '  specs: { formFactor: f75, technology: mechanical }',
        '  variants:',
        '    - { sku: B-R, colorName: Black, colorFamily: black, layout: ansi_us }',
        '',
      ].join('\n'),
    )
    // What an adapter gives back for this page, its switches resolved by the alias table.
    const source: Source = {
      host: 'shop.test',
      label: 'test',
      intro: () => [],
      priceIndex: async () => new Map(),
      candidates: async () => [
        {
          slug: 'test-board',
          brand: { slug: 'test', name: 'Test' },
          map: async (resolver) => {
            const variants: Variant[] = []
            for (const [sku, name] of [
              ['B-R', 'K Pro Red'],
              ['B-B', 'K Pro Brown'],
            ] as const) {
              const { slug } = await resolver.resolve(name)
              variants.push(v('Black', 'ansi_us', { sku, switch: slug }))
            }
            const input = { slug: 'test-board', msrpEur: 100, variants } as KeyboardInput
            return { input, notes: [] }
          },
        },
      ],
    }

    await rebuildVariants(dir, [source], false)
    const text = await readFile(board, 'utf8')
    expect(text).toBe(
      [
        '# Test : en-tête.',
        '',
        '# à vérifier : poids introuvable',
        '- slug: test-board',
        '  brand: test',
        '  name: Board',
        '  msrpEur: 100',
        '  sources:',
        '    - https://shop.test/products/board',
        '  specs: { formFactor: f75, technology: mechanical }',
        '  variants:',
        '    - { sku: B-R, colorName: Black, colorFamily: black, layout: ansi_us, switch: keychron-k-pro-red }',
        '    - { sku: B-B, colorName: Black, colorFamily: black, layout: ansi_us, switch: keychron-k-pro-brown }',
        '',
      ].join('\n'),
    )
    // A second run finds nothing left to do.
    await rebuildVariants(dir, [source], false)
    expect(await readFile(board, 'utf8')).toBe(text)
    const entry = parseDocument(text).contents
    expect(isSeq(entry) && isMap(entry.items[0])).toBe(true)
  })
})
