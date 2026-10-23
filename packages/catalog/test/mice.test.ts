import { describe, expect, it } from 'vitest'
import {
  askedSteps,
  describeAnswer,
  filter,
  isInformed,
  liveAnswers,
  mouseFinder,
  rank,
  rankingAnswers,
  recommended,
  stepOf,
} from '../src'
import {
  gripOf,
  type HandSize,
  handFit,
  recommendSize,
  type SizeBand,
  sizeBandOf,
} from '../src/finder/mouse-fit'
import type { Answers } from '../src/finder/types'
import { mice } from './fixtures'

// The mouse questionnaire against the frozen demo catalogue: every tile reachable, the branching of
// the shape answer, the fit to a hand and the size it suggests.

const slugs = (answers: Answers) =>
  filter(mouseFinder, mice, answers)
    .map((m) => m.slug)
    .sort()
const top = (answers: Answers, n = 3) =>
  rank(mouseFinder, mice, answers)
    .slice(0, n)
    .map((r) => r.item.slug)

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
    expect(vertical).toContain('handsize')
    const trackballs = askedSteps(mouseFinder, mice, { ...base, shape: 'tb_thumb,tb_finger' })
    expect(trackballs).not.toContain('handsize')
    expect(trackballs).not.toContain('grip')
    const mixed = askedSteps(mouseFinder, mice, { ...base, shape: 'sym,vertical' })
    expect(mixed).toContain('grip')
    expect(mixed).toContain('size')
  })

  it('ignores a grip answered before the shape ruled grips out', () => {
    const live = liveAnswers(mouseFinder, { use: 'office', shape: 'vertical', grip: 'claw' })
    expect(live.grip).toBeUndefined()
    expect(rankingAnswers(mouseFinder, { use: 'office', handsize: 'm', grip: 'claw' })).toEqual({
      use: 'office',
      handsize: 'm',
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
    expect(slugs({ musts: 'mmo' })).toEqual(['nimbus-legion', 'nimbus-legion-left'])
    const quietMultiDevice = filter(mouseFinder, mice, { musts: 'silent,multidevice' })
    expect(quietMultiDevice.length).toBeGreaterThan(0)
    expect(quietMultiDevice.every((m) => m.specs.silentClicks && m.specs.hosts >= 2)).toBe(true)
  })

  it('says "not sure" rather than "no preference" for the hand size', () => {
    expect(describeAnswer(stepOf(mouseFinder, 'handsize'), 'any', 'fr')).toBe('Je ne sais pas')
    expect(describeAnswer(stepOf(mouseFinder, 'handsize'), 'any', 'en')).toBe('Not sure')
  })
})

describe('fit to the hand', () => {
  const hands: HandSize[] = ['s', 'm', 'l', 'xl']
  const order: SizeBand[] = ['small', 'medium', 'large', 'xl']
  const index = (b: string) => order.indexOf(b as SizeBand)

  it('suggests a size that grows with the hand and shrinks towards the fingertips', () => {
    for (const grip of ['palm', 'claw', 'fingertip', undefined]) {
      const sizes = hands.map((h) => {
        const r = recommendSize({ handsize: h, ...(grip ? { grip } : {}) })
        return index(r?.primary ?? '')
      })
      for (let i = 1; i < sizes.length; i++)
        expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1] ?? 0)
    }
    for (const h of hands) {
      const palm = index(recommendSize({ handsize: h, grip: 'palm' })?.primary ?? '')
      const claw = index(recommendSize({ handsize: h, grip: 'claw' })?.primary ?? '')
      const tip = index(recommendSize({ handsize: h, grip: 'fingertip' })?.primary ?? '')
      expect(palm).toBeGreaterThanOrEqual(claw)
      expect(claw).toBeGreaterThanOrEqual(tip)
    }
  })

  it('suggests nothing without a hand size, and never reads the size answer itself', () => {
    expect(recommendSize({ grip: 'claw' })).toBeNull()
    const a = recommended(mouseFinder, { handsize: 'l', grip: 'palm' }, 'size')
    const b = recommended(mouseFinder, { handsize: 'l', grip: 'palm', size: 'small' }, 'size')
    expect(a).toEqual(b)
    expect(a?.also).not.toContain(a?.primary)
  })

  it('reads two neighbouring grips as the way between them, and far-apart grips as none', () => {
    const relaxed = gripOf({ grip: 'palm,claw' })
    const palm = gripOf({ grip: 'palm' })
    const claw = gripOf({ grip: 'claw' })
    expect(relaxed?.offset).toBeGreaterThan(claw?.offset ?? 0)
    expect(relaxed?.offset).toBeLessThan(palm?.offset ?? 0)
    expect(gripOf({ grip: 'palm,fingertip' })).toBeNull()
    expect(gripOf({ grip: 'palm,claw,fingertip' })).toBeNull()
  })

  it('leaves the ranking alone until a hand size or a grip is given', () => {
    expect(isInformed(mouseFinder, { handsize: 'm' })).toBe(true)
    expect(isInformed(mouseFinder, {})).toBe(false)
    const [first] = rank(mouseFinder, mice, { use: 'competitive' })
    expect(first?.pros.some((p) => p.fr === 'Taille faite pour ta main')).toBe(false)
  })

  it('puts small light shells first for a small hand in a fingertip grip', () => {
    const answers = {
      use: 'competitive',
      hand: 'right',
      shape: 'sym',
      handsize: 's',
      grip: 'fingertip',
    }
    const [first] = top(answers, 1)
    const mouse = mice.find((m) => m.slug === first)
    expect(mouse && sizeBandOf(mouse)).toBe('small')
  })

  it('puts large ergonomic shells first for a large hand in a palm grip', () => {
    const answers = { use: 'gaming', hand: 'right', shape: 'ergo', handsize: 'l', grip: 'palm' }
    const leaders = top(answers, 2)
    expect(leaders).toContain('ardent-rook')
    for (const slug of leaders) {
      const mouse = mice.find((m) => m.slug === slug)
      expect(['large', 'xl']).toContain(mouse && sizeBandOf(mouse))
    }
  })

  it('names the side a shell misses the hand on', () => {
    const answers = {
      use: 'competitive',
      hand: 'right',
      shape: 'sym',
      handsize: 'xl',
      grip: 'palm',
    }
    const ranked = rank(mouseFinder, mice, answers)
    const tiny = ranked.find((r) => r.item.slug === 'pebblework-dot')
    expect(tiny?.cons.map((c) => c.fr)).toContain('Petite pour ta main')
    const mini = mice.find((m) => m.slug === 'ardent-swift-mini')
    if (!mini) throw new Error('demo mouse missing')
    expect(handFit(mini, { handsize: 's', grip: 'fingertip' })).toBeGreaterThan(
      handFit(mini, { handsize: 'xl', grip: 'palm' }),
    )
  })

  it('does not reproach a size the visitor picked on purpose', () => {
    const mini = mice.find((m) => m.slug === 'ardent-swift-mini')
    if (!mini) throw new Error('demo mouse missing')
    const big = { handsize: 'xl', grip: 'palm' }
    expect(handFit(mini, { ...big, size: 'small' })).toBeGreaterThan(handFit(mini, big))
  })

  it('reads a maker’s recommended hand range', () => {
    const mini = mice.find((m) => m.slug === 'ardent-rook-mini')
    if (!mini) throw new Error('demo mouse missing')
    expect(handFit(mini, { handsize: 's' })).toBeGreaterThan(handFit(mini, { handsize: 'l' }))
  })
})
