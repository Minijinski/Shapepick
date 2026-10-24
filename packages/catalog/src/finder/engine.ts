import type { Locale } from '../i18n'
import {
  ANY,
  type Answers,
  type ChoiceStep,
  type Criterion,
  type FinderDefinition,
  type RangeStep,
  type Ranked,
  type Recommendation,
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

/** Step keys from a comma-separated list (`order=use,tech`): known questions only, each once. */
export const readOrder = <I>(def: FinderDefinition<I>, raw: string | undefined): string[] =>
  [...new Set(raw?.split(',') ?? [])].filter((key) =>
    def.steps.some((s) => s.key === key && !s.aside),
  )

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

/**
 * Answers of the steps that come before `key`: what a screen is allowed to know about. An answer
 * given aside (the brands) comes before every question.
 */
export function priorAnswers<I>(def: FinderDefinition<I>, answers: Answers, key: string): Answers {
  const index = def.steps.findIndex((s) => s.key === key)
  const prior: Answers = {}
  def.steps.forEach((step, i) => {
    const value = answers[step.key]
    if (value != null && (i < index || step.aside)) prior[step.key] = value
  })
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

/** Whether the questionnaire puts this step to the visitor: never one answered aside. */
const asked = <I>(def: FinderDefinition<I>, items: I[], answers: Answers, step: Step<I>) =>
  !step.aside && applies(step, answers) && !isTrivial(def, items, answers, step.key)

/** The next screen: the first applicable, non-trivial, unanswered step. null when done. */
export function firstPending<I>(
  def: FinderDefinition<I>,
  items: I[],
  answers: Answers,
): string | null {
  for (const step of def.steps) {
    if (step.aside || isAnswered(step, answers)) continue
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

// ==== Journey ==================================================================================

/**
 * A question on the journey bar: answered, on screen, still ahead, or skipped when the answers
 * leave it nothing to decide (it no longer applies, or every option would keep all or nothing).
 */
export type JourneyState = 'done' | 'current' | 'ahead' | 'skipped'

/**
 * The answers once the question on screen (`key`, null on the results) is committed as "Continue"
 * would commit it: with its draft, the picks not confirmed yet. An empty draft commits nothing.
 */
export const withDraft = (answers: Answers, key: string | null, draft: string | undefined) =>
  key != null && draft ? withAnswer(answers, key, draft) : answers

/**
 * Where each question stands, the draft on screen included, so that the journey bar greys out
 * live a question that picking the draft would skip, and brings it back once the answers widen.
 * An answered question stays open to editing, unless its question no longer applies at all.
 */
export function journeyStates<I>(
  def: FinderDefinition<I>,
  items: I[],
  answers: Answers,
  current: string | null,
  draft: string | undefined,
): Record<string, JourneyState> {
  const effective = withDraft(answers, current, draft)
  const ahead = new Set(askedSteps(def, items, effective))
  const stateOf = (step: Step<I>): JourneyState => {
    if (step.key === current) return 'current'
    if (isAnswered(step, answers)) return applies(step, effective) ? 'done' : 'skipped'
    return ahead.has(step.key) ? 'ahead' : 'skipped'
  }
  return Object.fromEntries(def.steps.filter((s) => !s.aside).map((s) => [s.key, stateOf(s)]))
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
/** The profile's share of the fit once the prior tells items apart; the prior has the rest. */
const FIT_SHARE = 0.75
/** Weight of the fit in the match, against one answer that an item meets. */
const FIT_WEIGHT = 3

/**
 * The answers that still mean something: those of questions that apply, readable, other than
 * "no preference". What a criterion that measures an item against an answer reads.
 */
export function liveAnswers<I>(def: FinderDefinition<I>, answers: Answers): Answers {
  const live: Answers = {}
  for (const step of def.steps) {
    const value = answers[step.key]
    if (value == null || value === ANY || !isAnswered(step, answers)) continue
    if (applies(step, answers)) live[step.key] = value
  }
  return live
}

/** The live answers that only steer the ranking (the use, a hand size): what strengths read. */
export function rankingAnswers<I>(def: FinderDefinition<I>, answers: Answers): Answers {
  const live = liveAnswers(def, answers)
  const kept: Answers = {}
  for (const step of def.steps) {
    const value = live[step.key]
    if (step.weightOnly && value != null) kept[step.key] = value
  }
  return kept
}

/**
 * What the other answers suggest picking at a step (a mouse size, from the hand and the grip), or
 * null: never read from the step's own answer.
 */
export function recommended<I>(
  def: FinderDefinition<I>,
  answers: Answers,
  key: string,
): Recommendation | null {
  const step = stepOf(def, key)
  if (!isChoice(step) || !step.recommend) return null
  return step.recommend(liveAnswers(def, withAnswer(answers, key, null)))
}

/**
 * Whether the answers say anything to rank on: the use, an answer that only steers the ranking (a
 * hand size), or one that narrows the catalogue.
 */
export function isInformed<I>(def: FinderDefinition<I>, answers: Answers): boolean {
  if ((answers[def.profileStep] ?? ANY) !== ANY) return true
  if (def.steps.some((s) => !s.aside && predicateOf(s, answers) != null)) return true
  const live = liveAnswers(def, answers)
  return def.steps.some((s) => s.weightOnly && live[s.key] != null)
}

type Typical = Map<string, Map<string, number>>

/** Per catalogue, what each criterion reads on an item whose sheet does not say. */
const typicalCache = new WeakMap<object, WeakMap<object, Typical>>()

/**
 * For every criterion that a sheet may leave blank, the median score of each group of peers over
 * the items whose sheet gives it: what a blank counts as.
 */
function typicalScores<I>(def: FinderDefinition<I>, items: I[]): Typical {
  let byCriteria = typicalCache.get(items)
  if (!byCriteria) {
    byCriteria = new WeakMap()
    typicalCache.set(items, byCriteria)
  }
  let typical = byCriteria.get(def.criteria)
  if (!typical) {
    typical = new Map()
    for (const c of def.criteria) {
      if (!c.known) continue
      const groups = new Map<string, number[]>()
      for (const item of items) {
        if (!c.known(item)) continue
        const peer = c.peers?.(item) ?? ''
        const list = groups.get(peer)
        // A criterion that may leave a figure blank never reads the answers.
        const score = clamp(c.score(item, {}))
        if (list) list.push(score)
        else groups.set(peer, [score])
      }
      const medians = new Map<string, number>()
      for (const [peer, list] of groups) {
        list.sort((a, b) => a - b)
        medians.set(peer, list[list.length >> 1] ?? 0.5)
      }
      typical.set(c.key, medians)
    }
    byCriteria.set(def.criteria, typical)
  }
  return typical
}

/** Per catalogue, whether its items' priors differ. */
const priorCache = new WeakMap<object, WeakMap<object, boolean>>()

/**
 * Whether the prior tells any of the catalogue's items apart. Until editorial scores and
 * popularity are filled in, every item has the same one: its share of the fit would then squeeze
 * every match towards the middle without ever changing the order.
 */
function priorTellsApart<I>(def: FinderDefinition<I>, items: I[]): boolean {
  let byPrior = priorCache.get(items)
  if (!byPrior) {
    byPrior = new WeakMap()
    priorCache.set(items, byPrior)
  }
  let differs = byPrior.get(def.prior)
  if (differs === undefined) {
    const [first] = items
    const level = first === undefined ? 0 : clamp(def.prior(first))
    differs = items.some((item) => clamp(def.prior(item)) !== level)
    byPrior.set(def.prior, differs)
  }
  return differs
}

/**
 * Scores the items that pass every filter. The fit is a weighted geometric mean of the profile's
 * criteria, so one catastrophic axis drags the whole score down instead of being averaged away. A
 * figure the item's sheet does not give counts as the catalogue's typical one (median), so a
 * sparse sheet is never ranked as a poor product, and it is never named as a strength or a
 * weakness. A prior from the editorial score and popularity takes a share of the fit once it
 * tells the catalogue's items apart; while every item has the same one, it sits out. The match
 * printed adds the answers: each one that narrows the catalogue is a criterion every ranked item
 * meets, so the match starts at the fit and fills up as the visitor answers, without changing the
 * order. Items with exactly the same match come cheapest first, then as the definition settles
 * them (the newer model…), never by name. Among items printed with the same match, makers take
 * turns: a brand that sells ten variants of one board cannot fill a podium on a tie. Weaknesses
 * are said in their own words, and a caveat (an OLED's burn-in at the office) only ever as a
 * weakness.
 */
export function rank<I>(def: FinderDefinition<I>, items: I[], answers: Answers): Ranked<I>[] {
  const pool = filter(def, items, answers)
  const met = def.steps.filter((s) => !s.aside && predicateOf(s, answers) != null).length
  const profileId = answers[def.profileStep]
  const weights = (profileId && def.profiles[profileId]) || def.profiles.default || {}
  const live = liveAnswers(def, answers)
  // A criterion with nothing to measure yet (a fit to a hand not given) sits out.
  const criteria = def.criteria.filter(
    (c) => (weights[c.key] ?? 0) > 0 && (c.active?.(live) ?? true),
  )
  const total = criteria.reduce((sum, c) => sum + (weights[c.key] ?? 0), 0)
  const heavy = [...criteria].sort((a, b) => (weights[b.key] ?? 0) - (weights[a.key] ?? 0))
  /** The criteria whose weakness is worth saying: the heaviest half, at least three. */
  const weighty = new Set(heavy.slice(0, Math.max(3, Math.ceil(heavy.length / 2))))
  const typical = typicalScores(def, items)
  const fitShare = priorTellsApart(def, items) ? FIT_SHARE : 1

  const ranked = pool.map((item) => {
    const scores = new Map<string, number>()
    const guessed = new Set<string>()
    for (const c of criteria) {
      if (c.known && !c.known(item)) {
        guessed.add(c.key)
        scores.set(c.key, typical.get(c.key)?.get(c.peers?.(item) ?? '') ?? 0.5)
      } else {
        scores.set(c.key, clamp(c.score(item, live)))
      }
    }
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
    const said = heavy.filter((c) => !guessed.has(c.key))
    const pros = said.filter((c) => !c.caveat && (scores.get(c.key) ?? 0) >= 0.75).slice(0, 3)
    const cons = [
      ...said.filter((c) => c.caveat),
      ...said.filter((c) => !c.caveat && weighty.has(c)),
    ]
      .filter((c) => (scores.get(c.key) ?? 1) < 0.35)
      .slice(0, 2)
    const fit = fitShare * profileFit + (1 - fitShare) * prior
    return {
      item,
      score: (FIT_WEIGHT * fit + met) / (FIT_WEIGHT + met),
      fit,
      met,
      pros: pros.map((c) => c.label),
      cons: cons.map((c) => weakLabelOf(c, item, live)),
    }
  })
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      def.price(a.item) - def.price(b.item) ||
      (def.settle?.(a.item, b.item) ?? 0) ||
      def.id(a.item).localeCompare(def.id(b.item)),
  )
  return def.maker ? takeTurns(ranked, def.maker) : ranked
}

const weakLabelOf = <I>(c: Criterion<I>, item: I, answers: Answers) =>
  typeof c.weakLabel === 'function' ? c.weakLabel(item, answers) : (c.weakLabel ?? c.label)

/** The match as printed: a whole percentage. */
export const matchPercent = (score: number) => Math.round(score * 100)

/**
 * Among ranked items printed with the same match, one per maker in turn (makers in the order
 * their best item came), each maker's items in their own order. Different matches keep their
 * order: only what reads as a tie is reshuffled.
 */
function takeTurns<I>(ranked: Ranked<I>[], maker: (item: I) => string): Ranked<I>[] {
  const out: Ranked<I>[] = []
  for (let start = 0; start < ranked.length; ) {
    const percent = matchPercent(ranked[start]?.score ?? 0)
    let end = start
    while (end < ranked.length && matchPercent(ranked[end]?.score ?? 0) === percent) end++
    const queues = new Map<string, Ranked<I>[]>()
    for (const entry of ranked.slice(start, end)) {
      const key = maker(entry.item)
      const queue = queues.get(key)
      if (queue) queue.push(entry)
      else queues.set(key, [entry])
    }
    while (out.length < end) {
      for (const queue of queues.values()) {
        const next = queue.shift()
        if (next) out.push(next)
      }
    }
    start = end
  }
  return out
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
  const anyLabel = step.anyLabel?.[locale] ?? (locale === 'fr' ? 'Peu importe' : 'No preference')
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
