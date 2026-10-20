import { describe, expect, it } from 'vitest'
import { filter, firstPending, keyboardFinder, monitorFinder, rank } from '../src'
import type { FinderDefinition } from '../src/finder/types'
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
})
