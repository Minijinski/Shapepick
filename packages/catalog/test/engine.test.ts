import { describe, expect, it } from 'vitest'
import {
  deadEnd,
  describeAnswer,
  filter,
  firstPending,
  histogram,
  isInformed,
  isTrivial,
  optionCounts,
  previousStep,
  rank,
  readOrder,
  readRange,
  sanitizeAnswers,
  stepOf,
  withOrder,
} from '../src'
import type { FinderDefinition } from '../src/finder/types'
import { text } from '../src/i18n'

// A tiny catalogue whose answers can be checked by hand.
type Toy = {
  id: string
  color: 'red' | 'blue'
  size: 's' | 'm' | 'l'
  price: number
  wifi: boolean
  bt: boolean
  q: number
}
const toys: Toy[] = [
  { id: 'a', color: 'red', size: 's', price: 50, wifi: true, bt: false, q: 0.9 },
  { id: 'b', color: 'red', size: 'm', price: 120, wifi: true, bt: true, q: 0.5 },
  { id: 'c', color: 'blue', size: 'm', price: 80, wifi: false, bt: true, q: 0.7 },
  { id: 'd', color: 'blue', size: 'l', price: 300, wifi: true, bt: true, q: 0.2 },
  { id: 'e', color: 'blue', size: 'l', price: 200, wifi: false, bt: false, q: 0.6 },
]
const t = (s: string) => text(s)

const def: FinderDefinition<Toy> = {
  category: 'keyboard',
  profileStep: 'use',
  id: (x) => x.id,
  price: (x) => x.price,
  prior: () => 0.5,
  steps: [
    {
      key: 'use',
      kind: 'single',
      weightOnly: true,
      required: true,
      label: t('Use'),
      title: t('Use?'),
      options: [
        { id: 'quality', label: t('Quality'), match: () => true },
        { id: 'cheap', label: t('Cheap'), match: () => true },
      ],
    },
    {
      key: 'color',
      kind: 'multi',
      label: t('Colour'),
      title: t('Colour?'),
      options: [
        { id: 'red', label: t('Red'), match: (x) => x.color === 'red' },
        { id: 'blue', label: t('Blue'), match: (x) => x.color === 'blue' },
      ],
    },
    {
      key: 'size',
      kind: 'multi',
      label: t('Size'),
      title: t('Size?'),
      applies: (a) => a.color !== 'red',
      options: [
        { id: 's', label: t('S'), match: (x) => x.size === 's' },
        { id: 'm', label: t('M'), match: (x) => x.size === 'm' },
        { id: 'l', label: t('L'), match: (x) => x.size === 'l' },
      ],
    },
    {
      key: 'budget',
      kind: 'range',
      label: t('Budget'),
      title: t('Budget?'),
      value: (x) => x.price,
      bounds: [0, 400],
      snap: 10,
    },
    {
      key: 'musts',
      kind: 'musts',
      label: t('Musts'),
      title: t('Musts?'),
      options: [
        { id: 'wifi', label: t('Wi-Fi'), match: (x) => x.wifi },
        { id: 'bt', label: t('Bluetooth'), match: (x) => x.bt },
      ],
    },
  ],
  criteria: [
    { key: 'quality', label: t('Well made'), score: (x) => x.q },
    { key: 'cheap', label: t('Cheap'), score: (x) => 1 - x.price / 300 },
  ],
  profiles: { quality: { quality: 1 }, cheap: { cheap: 1 }, default: { quality: 1, cheap: 1 } },
}
const ids = (list: Toy[]) => list.map((x) => x.id).sort()

describe('reading answers', () => {
  it('drops unknown keys, unknown ids and malformed ranges', () => {
    expect(
      sanitizeAnswers(def, {
        color: 'red,green',
        size: 'xl',
        budget: '300-100',
        musts: 'bt',
        junk: 'x',
        use: 'any',
      }),
    ).toEqual({ color: 'red', musts: 'bt' })
  })
  it('reads open-ended ranges', () => {
    expect(readRange('100-')).toEqual([100, null])
    expect(readRange('0-150')).toEqual([0, 150])
    expect(readRange('abc')).toBeUndefined()
  })
})

describe('filter', () => {
  it('ORs a multi answer and ANDs must-haves', () => {
    expect(ids(filter(def, toys, { color: 'red,blue' }))).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(ids(filter(def, toys, { musts: 'wifi,bt' }))).toEqual(['b', 'd'])
  })
  it('ignores the weight-only step and "any"', () => {
    expect(filter(def, toys, { use: 'cheap', color: 'any' })).toHaveLength(5)
  })
  it('applies a budget range, open-ended or not', () => {
    expect(ids(filter(def, toys, { budget: '0-100' }))).toEqual(['a', 'c'])
    expect(ids(filter(def, toys, { budget: '150-' }))).toEqual(['d', 'e'])
  })
  it('ignores the answer of a step that no longer applies', () => {
    // size only applies when red was not picked: the stale "l" must not empty the result.
    expect(ids(filter(def, toys, { color: 'red', size: 'l' }))).toEqual(['a', 'b'])
  })
})

describe('counts, skips and dead ends', () => {
  it('counts each option against every other answer', () => {
    const { base, counts } = optionCounts(def, toys, { color: 'blue', budget: '0-250' }, 'size')
    expect(base).toBe(2)
    expect(counts).toEqual({ s: 0, m: 1, l: 1 })
  })
  it('keeps current must-haves applied when counting another one', () => {
    expect(optionCounts(def, toys, { musts: 'wifi' }, 'musts').counts).toEqual({ wifi: 3, bt: 2 })
  })
  it('skips a step where every option keeps all or nothing', () => {
    // Must-haves still split blue boards in 200–300; a budget over an empty set cannot split anything.
    const answers = { use: 'quality', color: 'blue', budget: '200-300' }
    expect(isTrivial(def, toys, answers, 'musts')).toBe(false)
    expect(isTrivial(def, toys, { use: 'quality', color: 'red' }, 'budget')).toBe(false)
    expect(isTrivial(def, toys, { use: 'quality', color: 'blue', size: 'l' }, 'musts')).toBe(false)
    expect(isTrivial(def, toys, { use: 'quality', color: 'blue', size: 's' }, 'budget')).toBe(true)
  })
  it('walks forward past answered, non-applicable and trivial steps', () => {
    expect(firstPending(def, toys, {})).toBe('use')
    expect(firstPending(def, toys, { use: 'cheap' })).toBe('color')
    expect(firstPending(def, toys, { use: 'cheap', color: 'red' })).toBe('budget')
    expect(firstPending(def, toys, { use: 'cheap', color: 'red', budget: '0-60' })).toBeNull()
  })
  it('goes back to the closest step that was actually asked', () => {
    const answers = { use: 'cheap', color: 'red', budget: '0-200' }
    expect(previousStep(def, toys, answers, 'musts')).toBe('budget')
    expect(previousStep(def, toys, answers, 'budget')).toBe('color')
    expect(previousStep(def, toys, answers, null)).toBe('musts')
  })
  it('names the one earlier answer that blocks an option', () => {
    const answers = { color: 'red', budget: '0-100', musts: 'wifi' }
    expect(optionCounts(def, toys, answers, 'musts').counts.bt).toBe(0)
    expect(deadEnd(def, toys, answers, 'musts', 'bt')).toEqual({ blockedBy: 'budget', count: 1 })
  })
})

describe('rank', () => {
  it('orders by the profile picked on the weight-only step', () => {
    expect(rank(def, toys, { use: 'quality' }).map((r) => r.item.id)).toEqual([
      'a',
      'c',
      'e',
      'b',
      'd',
    ])
    expect(rank(def, toys, { use: 'cheap' })[0]?.item.id).toBe('a')
    expect(rank(def, toys, { use: 'cheap' }).at(-1)?.item.id).toBe('d')
  })
  it('only ranks items that pass the filters, scores in 0..1, explains strengths', () => {
    const ranked = rank(def, toys, { use: 'quality', color: 'blue' })
    expect(ranked.map((r) => r.item.id)).toEqual(['c', 'e', 'd'])
    for (const r of ranked) expect(r.score).toBeGreaterThanOrEqual(0)
    expect(ranked[0]?.pros).toEqual([])
    expect(ranked.at(-1)?.cons.map((c) => c.en)).toEqual(['Well made'])
  })
  it('is deterministic on ties', () => {
    const first = rank(def, toys, {}).map((r) => r.item.id)
    expect(rank(def, [...toys].reverse(), {}).map((r) => r.item.id)).toEqual(first)
  })
  it('fills the match up with every answer that narrows, keeping the order', () => {
    const fit = rank(def, toys, { use: 'quality' })
    const answered = rank(def, toys, { use: 'quality', musts: 'wifi' })
    expect(answered.map((r) => r.item.id)).toEqual(
      fit.filter((r) => r.item.wifi).map((r) => r.item.id),
    )
    for (const r of answered) {
      const before = fit.find((f) => f.item.id === r.item.id)
      expect(r.score).toBeGreaterThan(before?.score ?? 1)
      expect(r.score).toBeLessThanOrEqual(1)
      // The two parts a sheet explains the match with: the fit to the use, the answers met.
      expect(r.fit).toBe(before?.fit)
      expect(r.met).toBe(1)
      expect(r.score).toBeCloseTo((3 * r.fit + 1) / 4)
    }
    // "No preference" narrows nothing, so it changes nothing.
    expect(rank(def, toys, { use: 'quality', color: 'any' })).toEqual(fit)
  })
  it('knows when the answers give it nothing to rank on', () => {
    expect(isInformed(def, {})).toBe(false)
    expect(isInformed(def, { color: 'any' })).toBe(false)
    expect(isInformed(def, { use: 'cheap' })).toBe(true)
    expect(isInformed(def, { color: 'blue' })).toBe(true)
  })
})

describe('order', () => {
  it('reads known keys, each once', () => {
    expect(readOrder(def, 'musts,junk,color,musts')).toEqual(['musts', 'color'])
    expect(readOrder(def, undefined)).toEqual([])
  })
  it("asks the steps in the visitor's order, and Back follows it", () => {
    const ordered = withOrder(def, ['use', 'musts'])
    expect(ordered.steps.map((s) => s.key)).toEqual(['use', 'musts', 'color', 'size', 'budget'])
    expect(firstPending(ordered, toys, { use: 'quality' })).toBe('musts')
    expect(firstPending(ordered, toys, { use: 'quality', musts: 'wifi' })).toBe('color')
    expect(previousStep(ordered, toys, { use: 'quality', musts: 'wifi' }, 'color')).toBe('musts')
    expect(withOrder(def, [])).toBe(def)
  })
})

describe('budget and wording', () => {
  it('bins the prices left by the other answers', () => {
    const bins = histogram(def, toys, { color: 'blue', budget: '0-100' }, 'budget', 4)
    expect(bins.map((b) => b.count)).toEqual([1, 0, 1, 1])
  })
  it('describes answers for the rail', () => {
    expect(describeAnswer(stepOf(def, 'color'), 'red,blue', 'en')).toBe('Red · Blue')
    expect(describeAnswer(stepOf(def, 'budget'), '0-150', 'fr')?.replace(/\s/g, ' ')).toBe(
      '≤ 150 €',
    )
    expect(describeAnswer(stepOf(def, 'budget'), 'any', 'en')).toBe('No preference')
  })
})
