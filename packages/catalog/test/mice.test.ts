import { describe, expect, it } from 'vitest'
import {
  askedSteps,
  describeAnswer,
  filter,
  firstPending,
  isInformed,
  isTrivial,
  liveAnswers,
  mouseFinder,
  rank,
  rankingAnswers,
  sanitizeAnswers,
  stepOf,
} from '../src'
import { gripFit, gripOf, sizeBandOf } from '../src/finder/mouse-fit'
import type { Answers } from '../src/finder/types'
import { mice } from './fixtures'

// The mouse questionnaire against the frozen demo catalogue: every tile reachable, the branching of
// the shape answer, the grip and the size tiles.

const slugs = (answers: Answers) =>
  filter(mouseFinder, mice, answers)
    .map((m) => m.slug)
    .sort()
describe('mouse finder', () => {
  it('loads the demo catalogue', () => {
    expect(mice.length).toBeGreaterThanOrEqual(25)
  })

  it('has every option matching at least one demo mouse', () => {
    for (const step of mouseFinder.steps) {
      if (step.kind === 'range' || step.weightOnly) continue
      for (const option of step.options) {
        expect(mice.filter(option.match).length, `${step.key}.${option.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('keeps only ambidextrous and left-handed mice for a left hand', () => {
    const left = filter(mouseFinder, mice, { hand: 'left' })
    expect(left.length).toBeGreaterThan(0)
    expect(left.every((m) => m.specs.hand !== 'right')).toBe(true)
    const right = filter(mouseFinder, mice, { hand: 'right' })
    expect(right.every((m) => m.specs.hand !== 'left')).toBe(true)
  })

  it('tells thumb and finger trackballs apart, and keeps them out of the other shapes', () => {
    expect(slugs({ shape: 'tb_finger' })).toEqual(['nimbus-orb', 'nimbus-orb-wired'])
    expect(
      filter(mouseFinder, mice, { shape: 'tb_thumb' }).every(
        (m) => m.specs.ballPosition === 'thumb',
      ),
    ).toBe(true)
    expect(
      filter(mouseFinder, mice, { shape: 'ergo' }).some((m) => m.specs.shape === 'trackball'),
    ).toBe(false)
  })

  it('skips grip, size and weight when only verticals or trackballs are left', () => {
    const base = { use: 'office', hand: 'right' }
    const vertical = askedSteps(mouseFinder, mice, { ...base, shape: 'vertical' })
    expect(vertical).not.toContain('grip')
    expect(vertical).not.toContain('size')
    expect(vertical).not.toContain('weight')
    const trackballs = askedSteps(mouseFinder, mice, { ...base, shape: 'tb_thumb,tb_finger' })
    expect(trackballs).not.toContain('grip')
    expect(trackballs).not.toContain('size')
    const mixed = askedSteps(mouseFinder, mice, { ...base, shape: 'sym,vertical' })
    expect(mixed).toContain('grip')
    expect(mixed).toContain('size')
  })

  it('leaves trackballs in whatever size and weight a mixed shape answer picks', () => {
    const kept = filter(mouseFinder, mice, {
      hand: 'right',
      shape: 'sym,tb_thumb',
      size: 'medium',
      weight: 'light',
    })
    expect(kept.some((m) => m.specs.shape === 'trackball')).toBe(true)
    const shells = kept.filter((m) => m.specs.shape !== 'trackball')
    expect(shells.every((m) => sizeBandOf(m) === 'medium')).toBe(true)
  })

  it('ignores a grip answered before the shape ruled grips out', () => {
    const live = liveAnswers(mouseFinder, { use: 'office', shape: 'vertical', grip: 'claw' })
    expect(live.grip).toBeUndefined()
    expect(rankingAnswers(mouseFinder, { use: 'office', grip: 'claw' })).toEqual({
      use: 'office',
      grip: 'claw',
    })
  })

  it('counts a few grams either side of a weight band', () => {
    const light = slugs({ weight: 'light' })
    // 55 g sits on the edge between ultralight and light: it belongs to both.
    expect(light).toContain('ardent-rook-mini')
    expect(slugs({ weight: 'ultralight' })).toContain('ardent-rook-mini')
    expect(light).not.toContain('ardent-feather')
  })

  it('keeps Bluetooth-only mice reachable and wired-only mice apart', () => {
    expect(slugs({ connection: 'bluetooth' })).toContain('pebblework-dot-bt')
    expect(slugs({ connection: 'dongle' })).not.toContain('pebblework-dot-bt')
    const wired = filter(mouseFinder, mice, { connection: 'wired' })
    expect(wired.every((m) => !m.specs.conn24ghz && !m.specs.connBt)).toBe(true)
  })

  it('applies every must-have as a requirement', () => {
    expect(
      filter(mouseFinder, mice, { musts: 'poll8k' }).every((m) => (m.specs.pollingHz ?? 0) >= 8000),
    ).toBe(true)
    expect(slugs({ musts: 'charging' })).toEqual(['ardent-rook', 'nimbus-titan'])
    const quietMultiDevice = filter(mouseFinder, mice, { musts: 'silent,multidevice' })
    expect(quietMultiDevice.length).toBeGreaterThan(0)
    expect(quietMultiDevice.every((m) => m.specs.silentClicks && m.specs.hosts >= 2)).toBe(true)
  })

  it('says "not sure" rather than "no preference" for the grip', () => {
    expect(describeAnswer(stepOf(mouseFinder, 'grip'), 'any', 'fr')).toBe('Je ne sais pas')
    expect(describeAnswer(stepOf(mouseFinder, 'grip'), 'any', 'en')).toBe('Not sure')
  })
})

describe('side buttons', () => {
  it('asks them after the weight', () => {
    const keys = mouseFinder.steps.map((s) => s.key)
    expect(keys.indexOf('sideButtons')).toBe(keys.indexOf('weight') + 1)
  })

  it('counts the buttons under the thumb: none, back and forward, a few more, a grid', () => {
    expect(slugs({ sideButtons: 'many' })).toEqual(['nimbus-legion', 'nimbus-legion-left'])
    expect(slugs({ sideButtons: 'few' })).toEqual([
      'ardent-rook-left',
      'ardent-rook-xl',
      'nimbus-titan',
      'pebblework-master',
    ])
    const none = slugs({ sideButtons: 'none' })
    expect(none).toContain('pebblework-dot')
    expect(none).toContain('pebblework-thumbball')
    // Several tiles: any of them.
    expect(slugs({ sideButtons: 'few,many' })).toEqual(
      [...slugs({ sideButtons: 'few' }), ...slugs({ sideButtons: 'many' })].sort(),
    )
  })

  it('skips the question when only trackballs are left', () => {
    const step = stepOf(mouseFinder, 'sideButtons')
    expect(step.applies?.({ shape: 'tb_thumb,tb_finger' })).toBe(false)
    expect(step.applies?.({ shape: 'vertical' })).toBe(true)
    expect(step.applies?.({ shape: 'sym,tb_thumb' })).toBe(true)
    const base = { use: 'gaming', hand: 'right' }
    expect(askedSteps(mouseFinder, mice, { ...base, shape: 'tb_thumb' })).not.toContain(
      'sideButtons',
    )
    expect(askedSteps(mouseFinder, mice, { ...base, shape: 'ergo,tb_thumb' })).toContain(
      'sideButtons',
    )
  })

  it('rules out a mouse whose count is unknown once the question is answered', () => {
    const known = mice.find((m) => m.slug === 'ardent-swift')
    if (!known) throw new Error('demo mouse missing')
    const unknown = {
      ...known,
      slug: 'ardent-swift-unknown',
      specs: { ...known.specs, sideButtons: undefined },
    }
    const pool = [...mice, unknown]
    const kept = (answers: Answers) =>
      filter(mouseFinder, pool, answers).some((m) => m.slug === unknown.slug)
    expect(kept({ sideButtons: 'two' })).toBe(false)
    expect(kept({ sideButtons: 'any' })).toBe(true)
    expect(kept({})).toBe(true)
  })

  it('no longer offers the "8 buttons" and "MMO grid" must-haves, and old links still read', () => {
    const musts = stepOf(mouseFinder, 'musts')
    const ids = musts.kind === 'range' ? [] : musts.options.map((o) => o.id)
    expect(ids).not.toContain('buttons8')
    expect(ids).not.toContain('mmo')
    expect(sanitizeAnswers(mouseFinder, { use: 'gaming', musts: 'mmo,rgb' })).toEqual({
      use: 'gaming',
      musts: 'rgb',
    })
  })
})

describe('size and grip', () => {
  it('asks no hand size, and a link that still carries one keeps working', () => {
    expect(mouseFinder.steps.some((s) => s.key === 'handsize')).toBe(false)
    expect(sanitizeAnswers(mouseFinder, { use: 'office', handsize: 'm' })).toEqual({
      use: 'office',
    })
  })

  it('says on each size tile which hands it suits', () => {
    const size = stepOf(mouseFinder, 'size')
    const hints = size.kind === 'range' ? [] : size.options.map((o) => o.hint?.fr)
    expect(hints).toEqual([
      'Main de moins de 17 cm',
      'Main de 17 à 19 cm',
      'Main de 19 à 21 cm',
      'Main de plus de 21 cm',
    ])
  })

  it('reads two neighbouring grips as the way between them, and far-apart grips as none', () => {
    const relaxed = gripOf({ grip: 'palm,claw' })
    const palm = gripOf({ grip: 'palm' })
    const claw = gripOf({ grip: 'claw' })
    expect(relaxed?.hl).toBeGreaterThan(claw?.hl ?? 0)
    expect(relaxed?.hl).toBeLessThan(palm?.hl ?? 0)
    expect(gripOf({ grip: 'palm,fingertip' })).toBeNull()
    expect(gripOf({ grip: 'palm,claw,fingertip' })).toBeNull()
  })

  it('skips the grip when it cannot change anything', () => {
    const shells = { use: 'competitive', hand: 'right', shape: 'sym' }
    // One mouse left: nothing to rank, the results come next.
    const one = mice.find((m) => m.specs.shape === 'symmetrical' && m.specs.hand !== 'left')
    if (!one) throw new Error('demo mouse missing')
    expect(isTrivial(mouseFinder, [one], shells, 'grip')).toBe(true)
    expect(firstPending(mouseFinder, [one], shells)).toBe(null)
    // No grip ranks a mouse to travel with.
    expect(isTrivial(mouseFinder, mice, { ...shells, use: 'travel' }, 'grip')).toBe(true)
    // Only verticals and trackballs left, though the shape answer keeps shells too.
    const held = mice.filter((m) => m.specs.shape === 'vertical' || m.specs.shape === 'trackball')
    const mixed = { use: 'office', hand: 'right', shape: 'sym,vertical,tb_thumb' }
    expect(filter(mouseFinder, held, mixed).length).toBeGreaterThan(1)
    expect(isTrivial(mouseFinder, held, mixed, 'grip')).toBe(true)
    // Shells it tells apart: asked.
    expect(isTrivial(mouseFinder, mice, shells, 'grip')).toBe(false)
    expect(firstPending(mouseFinder, mice, shells)).toBe('grip')
  })

  it('leaves the ranking alone until a grip is given', () => {
    expect(isInformed(mouseFinder, { grip: 'claw' })).toBe(true)
    expect(isInformed(mouseFinder, {})).toBe(false)
    const [first] = rank(mouseFinder, mice, { use: 'competitive' })
    expect(first?.pros.some((p) => p.fr === 'Forme adaptée à ta prise')).toBe(false)
  })

  it('weighs the body as the grip wants it: ergonomic for the palm, symmetrical at the tips', () => {
    // The same shell, sculpted or symmetrical: only the body tells them apart.
    const base = mice.find((m) => m.specs.shape === 'symmetrical' && m.specs.heightMm)
    if (!base) throw new Error('demo mouse missing')
    const sculpted = { ...base, specs: { ...base.specs, shape: 'ergonomic' as const } }
    const ratio = (grip: string) => gripFit(sculpted, { grip }) / gripFit(base, { grip })
    expect(ratio('palm')).toBeGreaterThan(1)
    expect(ratio('fingertip')).toBeLessThan(1)
    // Held another way, a vertical shell or a trackball is neither rewarded nor ruled out.
    const vertical = mice.find((m) => m.specs.shape === 'vertical')
    if (!vertical) throw new Error('demo mouse missing')
    expect(gripFit(vertical, { grip: 'claw' })).toBe(0.85)
    expect(gripFit(vertical, {})).toBe(1)
  })
})
