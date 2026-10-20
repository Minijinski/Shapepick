import type { Locale } from '../i18n'
import {
  ANY,
  type Answers,
  type ChoiceStep,
  type FinderDefinition,
  type RangeStep,
  type Ranked,
  type Step,
} from './types'

// Pure functions over a definition, a list of items and the raw answers. No DOM, no database:
// the route loader runs them on the server for the first paint, the browser runs them on every
// answer. Everything a screen needs (counts, skips, dead ends, ranking) is derived, never stored.

type Range = [number, number | null]

export function stepOf<I>(def: FinderDefinition<I>, key: string): Step<I> {
  const step = def.steps.find((s) => s.key === key)
  if (!step) throw new Error(`Unknown step "${key}"`)
  return step
}

const isChoice = <I>(step: Step<I>): step is ChoiceStep<I> => step.kind !== 'range'

// ==== Reading answers ==========================================================================

/** The picked option ids, `'any'`, or undefined when the step has not been answered. */
export function readChoice<I>(
  step: ChoiceStep<I>,
  raw: string | undefined,
): string[] | 'any' | undefined {
  if (raw == null || raw === '') return undefined
  if (raw === ANY) return step.required ? undefined : ANY
  const ids = raw.split(',').filter((id) => step.options.some((o) => o.id === id))
  if (!ids.length) return undefined
  return step.kind === 'single' ? ids.slice(0, 1) : [...new Set(ids)]
}

/** `[min, max]` (max null = no ceiling), `'any'`, or undefined. */
export function readRange(raw: string | undefined): Range | 'any' | undefined {
  if (raw == null || raw === '') return undefined
  if (raw === ANY) return ANY
  const match = /^(\d+)-(\d*)$/.exec(raw)
  if (!match) return undefined
  const min = Number(match[1])
  const max = match[2] ? Number(match[2]) : null
  return max != null && max < min ? undefined : [min, max]
}

export const writeRange = ([min, max]: Range) => `${min}-${max ?? ''}`

const isAnswered = <I>(step: Step<I>, answers: Answers) =>
  (isChoice(step) ? readChoice(step, answers[step.key]) : readRange(answers[step.key])) !==
  undefined

/** Keeps only known keys with readable values, so a hand-edited URL can never break a screen. */
export function sanitizeAnswers<I>(
  def: FinderDefinition<I>,
  raw: Record<string, unknown>,
): Answers {
  const clean: Answers = {}
  for (const step of def.steps) {
    const value = raw[step.key]
    if (typeof value !== 'string' && typeof value !== 'number') continue
    const str = String(value)
    if (isChoice(step)) {
      const read = readChoice(step, str)
      if (read !== undefined) clean[step.key] = read === ANY ? ANY : read.join(',')
    } else {
      const read = readRange(str)
      if (read !== undefined) clean[step.key] = read === ANY ? ANY : writeRange(read)
    }
  }
  return clean
}

export const withAnswer = (answers: Answers, key: string, value: string | null): Answers => {
  const next = { ...answers }
  if (value == null) delete next[key]
  else next[key] = value
  return next
}

// ==== Order ====================================================================================

/** Step keys from a comma-separated list (`order=use,tech`): known keys only, each once. */
export const readOrder = <I>(def: FinderDefinition<I>, raw: string | undefined): string[] =>
  [...new Set(raw?.split(',') ?? [])].filter((key) => def.steps.some((s) => s.key === key))

/**
 * The definition with its steps in the visitor's order: the `first` keys in that order, then every
 * other step where the definition has it. Skips, Back and the progress all read the order from the
 * definition, so a questionnaire taken in another order stays consistent.
 */
export function withOrder<I>(
  def: FinderDefinition<I>,
  first: readonly string[],
): FinderDefinition<I> {
  const head = first.flatMap((key) => def.steps.find((s) => s.key === key) ?? [])
  return head.length ? { ...def, steps: [...new Set([...head, ...def.steps])] } : def
}

// ==== Filtering ================================================================================

export const applies = <I>(step: Step<I>, answers: Answers) => step.applies?.(answers) ?? true

/** The test one answered step puts on an item, or null when it does not narrow anything. */
export function predicateOf<I>(step: Step<I>, answers: Answers): ((item: I) => boolean) | null {
  if (step.weightOnly || !applies(step, answers)) return null
  if (!isChoice(step)) {
    const range = readRange(answers[step.key])
    if (!range || range === ANY) return null
    const [min, max] = range
    return (item) => {
      const v = step.value(item)
      return v >= min && (max == null || v <= max)
    }
  }
  const picked = readChoice(step, answers[step.key])
  if (!picked || picked === ANY) return null
  const options = step.options.filter((o) => picked.includes(o.id))
  return step.kind === 'musts'
    ? (item) => options.every((o) => o.match(item))
    : (item) => options.some((o) => o.match(item))
}

export function filter<I>(
  def: FinderDefinition<I>,
  items: I[],
  answers: Answers,
  { without }: { without?: string } = {},
): I[] {
  const tests = def.steps
    .filter((s) => s.key !== without)
    .map((s) => predicateOf(s, answers))
    .filter((t): t is (item: I) => boolean => t != null)
  return tests.length ? items.filter((item) => tests.every((t) => t(item))) : items
}

/** Answers of the steps that come before `key`: what a screen is allowed to know about. */
export function priorAnswers<I>(def: FinderDefinition<I>, answers: Answers, key: string): Answers {
  const index = def.steps.findIndex((s) => s.key === key)
  const prior: Answers = {}
  for (const step of def.steps.slice(0, index)) {
    const value = answers[step.key]
    if (value != null) prior[step.key] = value
  }
  return prior
}

// ==== Per-option counts, skips and dead ends ===================================================

export type OptionCounts = { base: number; counts: Record<string, number> }

/**
 * How many items each option would leave, given every other answer. For musts the current picks
 * stay applied, since a must-have adds to them rather than replacing them.
 */
export function optionCounts<I>(
  def: FinderDefinition<I>,
  items: I[],
  answers: Answers,
  key: string,
): OptionCounts {
  const step = stepOf(def, key)
  const base = filter(def, items, answers, { without: key })
  const counts: Record<string, number> = {}
  if (!isChoice(step)) return { base: base.length, counts }
  const kept =
    step.kind === 'musts' ? base.filter((i) => predicateOf(step, answers)?.(i) ?? true) : base
  for (const option of step.options) {
    counts[option.id] = step.weightOnly ? base.length : kept.filter(option.match).length
  }
  return { base: base.length, counts }
}

/**
 * A step is trivial when no option would change the result set: every option keeps either all
 * of the remaining items or none of them. It is then skipped rather than asked, so the visitor
 * never answers a question whose answer cannot matter.
 */
export function isTrivial<I>(def: FinderDefinition<I>, items: I[], answers: Answers, key: string) {
  const step = stepOf(def, key)
  if (step.weightOnly) return false
  const prior = priorAnswers(def, answers, key)
  const base = filter(def, items, prior)
  if (base.length <= 1) return true
  if (!isChoice(step)) {
    const values = base.map(step.value)
    return Math.min(...values) === Math.max(...values)
  }
  const { counts } = optionCounts(def, items, prior, key)
  return step.options.every((o) => counts[o.id] === 0 || counts[o.id] === base.length)
}

const asked = <I>(def: FinderDefinition<I>, items: I[], answers: Answers, step: Step<I>) =>
  applies(step, answers) && !isTrivial(def, items, answers, step.key)

/** The next screen: the first applicable, non-trivial, unanswered step. null when done. */
export function firstPending<I>(
  def: FinderDefinition<I>,
  items: I[],
  answers: Answers,
): string | null {
  for (const step of def.steps) {
    if (isAnswered(step, answers)) continue
    if (asked(def, items, answers, step)) return step.key
  }
  return null
}

/** Where Back goes from `current` (null = results): the closest earlier step that was asked. */
export function previousStep<I>(
  def: FinderDefinition<I>,
  items: I[],
  answers: Answers,
  current: string | null,
): string | null {
  const end = current == null ? def.steps.length : def.steps.findIndex((s) => s.key === current)
  for (let i = end - 1; i >= 0; i--) {
    const step = def.steps[i]
    if (step && asked(def, items, answers, step)) return step.key
  }
  return null
}

/** The steps the visitor will actually see, for the `03 / 08` progress readout. */
export function askedSteps<I>(def: FinderDefinition<I>, items: I[], answers: Answers): string[] {
  return def.steps.filter((s) => asked(def, items, answers, s)).map((s) => s.key)
}

/**
 * For an option that leaves nothing: the single earlier answer that, removed, would bring items
 * back. The tile then offers to change that answer instead of just being greyed out.
 */
export function deadEnd<I>(
  def: FinderDefinition<I>,
  items: I[],
  answers: Answers,
  key: string,
  optionId: string,
): { blockedBy: string; count: number } | null {
  const answered = def.steps.filter(
    (s) => s.key !== key && !s.weightOnly && answers[s.key] != null && answers[s.key] !== ANY,
  )
  for (const blocker of answered.reverse()) {
    const relaxed = withAnswer(answers, blocker.key, null)
    const count = optionCounts(def, items, relaxed, key).counts[optionId] ?? 0
    if (count > 0) return { blockedBy: blocker.key, count }
  }
  return null
}

// ==== Ranking ==================================================================================

const FLOOR = 0.05
const FIT_SHARE = 0.75
/** Weight of the fit in the match, against one answer that an item meets. */
const FIT_WEIGHT = 3

/** Whether the answers say anything to rank on: the use, or an answer that narrows the catalogue. */
export const isInformed = <I>(def: FinderDefinition<I>, answers: Answers) =>
  (answers[def.profileStep] ?? ANY) !== ANY ||
  def.steps.some((s) => predicateOf(s, answers) != null)

/**
 * Scores the items that pass every filter. The fit is a weighted geometric mean of the profile's
 * criteria, so one catastrophic axis drags the whole score down instead of being averaged away.
 * A prior from the editorial score and popularity settles near-ties between equally fitting items.
 * The match printed adds the answers: each one that narrows the catalogue is a criterion every
 * ranked item meets, so the match starts at the fit and fills up as the visitor answers, without
 * changing the order.
 */
export function rank<I>(def: FinderDefinition<I>, items: I[], answers: Answers): Ranked<I>[] {
  const pool = filter(def, items, answers)
  const met = def.steps.filter((s) => predicateOf(s, answers) != null).length
  const profileId = answers[def.profileStep]
  const weights = (profileId && def.profiles[profileId]) || def.profiles.default || {}
  const criteria = def.criteria.filter((c) => (weights[c.key] ?? 0) > 0)
  const total = criteria.reduce((sum, c) => sum + (weights[c.key] ?? 0), 0)
  const heavy = [...criteria].sort((a, b) => (weights[b.key] ?? 0) - (weights[a.key] ?? 0))

  const ranked = pool.map((item) => {
    const scores = new Map(criteria.map((c) => [c.key, clamp(c.score(item))]))
    const profileFit = total
      ? Math.exp(
          criteria.reduce(
            (sum, c) =>
              sum + (weights[c.key] ?? 0) * Math.log(Math.max(FLOOR, scores.get(c.key) ?? 0)),
            0,
          ) / total,
        )
      : 0.5
    const prior = clamp(def.prior(item))
    const pros = heavy.filter((c) => (scores.get(c.key) ?? 0) >= 0.75).slice(0, 3)
    const cons = heavy
      .slice(0, Math.max(3, Math.ceil(heavy.length / 2)))
      .filter((c) => (scores.get(c.key) ?? 1) < 0.35)
      .slice(0, 2)
    const fit = FIT_SHARE * profileFit + (1 - FIT_SHARE) * prior
    return {
      item,
      score: (FIT_WEIGHT * fit + met) / (FIT_WEIGHT + met),
      fit,
      met,
      pros: pros.map((c) => c.label),
      cons: cons.map((c) => c.label),
    }
  })
  return ranked.sort((a, b) => b.score - a.score || def.id(a.item).localeCompare(def.id(b.item)))
}

const clamp = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

// ==== Budget ===================================================================================

export type Bin = { from: number; to: number; count: number }

/** Price distribution of what the other answers leave, for the budget screen's histogram. */
export function histogram<I>(
  def: FinderDefinition<I>,
  items: I[],
  answers: Answers,
  key: string,
  binCount = 24,
): Bin[] {
  const step = stepOf(def, key) as RangeStep<I>
  const [lo, hi] = step.bounds
  const width = (hi - lo) / binCount
  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => ({
    from: lo + i * width,
    to: lo + (i + 1) * width,
    count: 0,
  }))
  for (const item of filter(def, items, answers, { without: key })) {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor((step.value(item) - lo) / width)))
    const bin = bins[index]
    if (bin) bin.count++
  }
  return bins
}

// ==== Wording ==================================================================================

const euro = (locale: Locale, value: number) =>
  new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)

/** What the answer rail prints for an answered step: "75 % · 65 %", "≤ 150 €", "Peu importe". */
export function describeAnswer<I>(
  step: Step<I>,
  raw: string | undefined,
  locale: Locale,
): string | null {
  const anyLabel = locale === 'fr' ? 'Peu importe' : 'No preference'
  if (!isChoice(step)) {
    const range = readRange(raw)
    if (!range) return null
    if (range === ANY) return anyLabel
    const [min, max] = range
    if (max == null) return min > 0 ? `≥ ${euro(locale, min)}` : anyLabel
    return min > 0 ? `${euro(locale, min)} – ${euro(locale, max)}` : `≤ ${euro(locale, max)}`
  }
  const picked = readChoice(step, raw)
  if (!picked) return null
  if (picked === ANY) return anyLabel
  return step.options
    .filter((o) => picked.includes(o.id))
    .map((o) => o.label[locale])
    .join(' · ')
}
