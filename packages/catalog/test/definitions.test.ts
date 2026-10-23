import { describe, expect, it } from 'vitest'
import {
  filter,
  finders,
  firstPending,
  keyboardFinder,
  monitorFinder,
  rank,
  switchSchema,
} from '../src'
import type { Answers, FinderDefinition } from '../src/finder/types'
import { keyboards, monitors } from './fixtures'

// Checks the two real questionnaires against the demo catalogue: every tile reachable, branching
// and skipping behave, and the ranking profiles put the obvious candidates on top.

function everyOptionMatches<I>(def: FinderDefinition<I>, items: I[]) {
  for (const step of def.steps) {
    if (step.kind === 'range' || step.weightOnly) continue
    for (const option of step.options) {
      expect(items.filter(option.match).length, `${step.key}.${option.id}`).toBeGreaterThan(0)
    }
  }
}

describe('keyboard finder', () => {
  it('loads the demo catalogue', () => {
    expect(keyboards.length).toBeGreaterThanOrEqual(25)
  })
  it('has every option matching at least one demo board', () =>
    everyOptionMatches(keyboardFinder, keyboards))
  it('keeps AZERTY boards only when asked', () => {
    const azerty = filter(keyboardFinder, keyboards, { layout: 'azerty' })
    expect(azerty.length).toBeGreaterThan(0)
    expect(azerty.every((k) => k.variants.some((v) => v.layout === 'iso_fr'))).toBe(true)
  })
  it('never asks about switch feel once only membrane boards remain', () => {
    const answers = { use: 'office', size: 'full', layout: 'azerty', tech: 'membrane' }
    expect(keyboardFinder.steps.find((s) => s.key === 'feel')?.applies?.(answers)).toBe(false)
    expect(firstPending(keyboardFinder, keyboards, answers)).not.toBe('feel')
  })
  it('puts magnetic, rapid-trigger boards on top for competitive play', () => {
    const top = rank(keyboardFinder, keyboards, { use: 'competitive' }).slice(0, 3)
    expect(
      top.every((r) => r.item.specs.technology === 'magnetic' && r.item.specs.rapidTrigger),
    ).toBe(true)
  })
  it('favours quiet boards for the office', () => {
    const [first] = rank(keyboardFinder, keyboards, { use: 'office', size: 'full,f96' })
    expect(first?.item.slug).toBe('atelier-silence-96')
  })
  it('reads the feel of a switch known by its feel alone', () => {
    // Logitech names its switches by their feel ("GL Tactile") and publishes no figures.
    const glTactile = switchSchema.parse({
      slug: 'logitech-gl-tactile',
      brand: 'Logitech',
      name: 'GL Tactile',
      feel: 'tactile',
      tech: 'mechanical',
    })
    const board = keyboards.find((k) => k.specs.technology === 'mechanical')
    const feel = keyboardFinder.steps.find((s) => s.key === 'feel')
    if (!board || !feel || feel.kind === 'range') throw new Error('demo board or feel step missing')
    const sold = { ...board, variants: board.variants.map((v) => ({ ...v, switch: glTactile })) }
    const matches = (id: string) => feel.options.find((o) => o.id === id)?.match(sold)
    expect(matches('tactile')).toBe(true)
    expect(matches('linear')).toBe(false)
  })
  it('scores a board by its quietest version', () => {
    const quiet = keyboardFinder.criteria.find((c) => c.key === 'quiet')
    const switchOf = (feel: string) =>
      keyboards.flatMap((k) => k.variants).find((v) => v.switch?.feel === feel && !v.switch.silent)
        ?.switch
    const board = keyboards.find(
      (k) => k.specs.technology === 'mechanical' && !k.specs.soundDampening,
    )
    const [variant] = board?.variants ?? []
    if (!quiet || !board || !variant) throw new Error('demo board or quiet criterion missing')
    const clicky = { ...variant, switch: switchOf('clicky') ?? null }
    const tactile = { ...variant, switch: switchOf('tactile') ?? null }
    expect(quiet.score({ ...board, variants: [clicky] }, {})).toBe(0.15)
    expect(quiet.score({ ...board, variants: [clicky, tactile] }, {})).toBe(0.5)
  })
})

describe('monitor finder', () => {
  it('loads the demo catalogue and computes PPI', () => {
    expect(monitors.length).toBeGreaterThanOrEqual(25)
    expect(monitors.find((m) => m.slug === 'prism-p27q')?.specs.ppi).toBe(109)
  })
  it('has every option matching at least one demo monitor', () =>
    everyOptionMatches(monitorFinder, monitors))
  it('reads the refresh answer as a minimum', () => {
    const fast = filter(monitorFinder, monitors, { refresh: '240' })
    expect(fast.every((m) => m.specs.refreshHzMax >= 240)).toBe(true)
  })
  it('puts the fastest panels on top for competitive FPS', () => {
    const [first] = rank(monitorFinder, monitors, { use: 'fps' })
    expect(first?.item.specs.refreshHzMax).toBeGreaterThanOrEqual(360)
  })
  it('favours calibrated wide-gamut panels for creative work', () => {
    const top = rank(monitorFinder, monitors, { use: 'creative' }).slice(0, 3)
    expect(top.every((r) => r.item.specs.factoryCalibrated)).toBe(true)
  })
  it('asks the budget right after the size', () => {
    expect(monitorFinder.steps.map((s) => s.key).slice(0, 3)).toEqual(['use', 'format', 'budget'])
    expect(firstPending(monitorFinder, monitors, { use: 'office', format: 's27' })).toBe('budget')
  })

  const slugs = (answers: Answers) => filter(monitorFinder, monitors, answers).map((m) => m.slug)

  it('reads the sharpness on the height of the picture', () => {
    expect(slugs({ resolution: 'fhd' })).toEqual(
      expect.arrayContaining(['prism-p24-wuxga', 'kestrel-k29-uw']),
    )
    expect(slugs({ resolution: 'qhd' })).toEqual(
      expect.arrayContaining(['halcyon-h38-uw', 'lumen-l34-uw', 'kestrel-k49-va']),
    )
    expect(slugs({ resolution: 'qhd' })).not.toContain('prism-p24-wuxga')
    expect(slugs({ resolution: 'uhd' })).toContain('lumen-l40-5k2k')
    expect(slugs({ resolution: '5k' })).toEqual(['lumen-l27-5k'])
  })
  it('puts every 21:9 panel from 37.5" up in the large ultrawides', () => {
    expect(slugs({ format: 'uw38' })).toEqual(
      expect.arrayContaining(['halcyon-h38-uw', 'lumen-l40-5k2k', 'vanta-v45-woled']),
    )
    expect(slugs({ format: 'uw34' })).toContain('kestrel-k29-uw')
  })
  it('counts a stand that goes up and down as height-adjustable, travel given or not', () => {
    expect(slugs({ musts: 'height' })).toEqual(
      expect.arrayContaining(['halcyon-h27-ergo', 'lumen-l27-4k']),
    )
    expect(slugs({ musts: 'height' })).not.toContain('kestrel-k27-budget')
  })
  it('offers the VESA mount as a must-have', () => {
    expect(slugs({ musts: 'vesa' })).not.toContain('lumen-l27-slim')
    expect(slugs({ musts: 'vesa' })).toHaveLength(monitors.length - 1)
  })
  it('never names a figure the sheet leaves out as a strength or a weakness', () => {
    const response = monitorFinder.criteria.find((c) => c.key === 'response')
    const ergo = rank(monitorFinder, monitors, { use: 'fps' }).find(
      (r) => r.item.slug === 'halcyon-h27-ergo',
    )
    expect(ergo).toBeDefined()
    expect(ergo?.pros).not.toContainEqual(response?.label)
    expect(ergo?.cons).not.toContainEqual(response?.weakLabel)
  })
  it('puts an IPS ahead of the same screen in OLED for the office, and says why', () => {
    const oled = monitors.find((m) => m.slug === 'vanta-v32-oled-4k')
    if (!oled) throw new Error('demo OLED missing')
    const ips = { ...oled, slug: 'same-in-ips', specs: { ...oled.specs, panel: 'ips' as const } }
    const burnIn = monitorFinder.criteria.find((c) => c.key === 'burnIn')
    const [first, second] = rank(monitorFinder, [oled, ips], { use: 'office' })
    expect(first?.item.slug).toBe('same-in-ips')
    expect(first?.pros).not.toContainEqual(burnIn?.label)
    expect(second?.cons[0]).toEqual(burnIn?.weakLabel)
  })
})

describe('every finder', () => {
  it('words every weakness as a weakness', () => {
    for (const finder of Object.values(finders)) {
      for (const c of finder.criteria)
        expect(c.weakLabel, `${finder.category} ${c.key}`).toBeDefined()
    }
  })
  it('never lets a criterion that may lack a figure read the answers', () => {
    // The medians standing in for missing figures are worked out once per catalogue.
    for (const finder of Object.values(finders)) {
      for (const c of finder.criteria) if (c.known) expect(c.score.length, c.key).toBeLessThan(2)
    }
  })
})
