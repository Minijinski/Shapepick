import {
  ANY,
  type Answers,
  askedSteps,
  type CatalogItem,
  type Category,
  type ChoiceStep,
  deadEnd,
  describeAnswer,
  filter,
  finderOf,
  firstPending,
  type Locale,
  optionCounts,
  predicateOf,
  previousStep,
  rank,
  readChoice,
  type Step,
  sanitizeAnswers,
  type Text,
  withAnswer,
} from '@choose/catalog'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ItemDetail } from '../scene/controller'

// Everything a finder screen shows is derived here from three inputs: the catalogue, the answers
// in the URL, and what the visitor is doing right now (a draft pick, a hovered tile). Committed
// answers live in the URL; the draft lives in state until "Continue".

export const DONE = 'done'

export type FinderSearch = Record<string, string | undefined>

/** What a product's sheet shows: its rank and fit when the answers keep it, what rules it out otherwise. */
export type ProductSheet = {
  item: CatalogItem
  rank: number | null
  score: number | null
  pros: Text[]
  cons: Text[]
  excludedBy: string | null
}

export function useFinder(
  category: Category,
  items: CatalogItem[],
  search: FinderSearch,
  locale: Locale,
) {
  const def = finderOf(category)
  const navigate = useNavigate()
  const answers = useMemo(() => sanitizeAnswers(def, search), [def, search])
  const at = search.at

  const currentKey = useMemo(() => {
    if (at === DONE) return null
    const explicit = def.steps.find((s) => s.key === at)
    if (explicit && (explicit.applies?.(answers) ?? true)) return explicit.key
    return firstPending(def, items, answers)
  }, [def, items, answers, at])
  const step = currentKey ? (def.steps.find((s) => s.key === currentKey) ?? null) : null

  // ---- Draft & hover ------------------------------------------------------------------------
  const [draft, setDraft] = useState<string | undefined>(
    currentKey ? answers[currentKey] : undefined,
  )
  const [hovered, setHovered] = useState<string | null>(null)
  useEffect(() => {
    setDraft(currentKey ? answers[currentKey] : undefined)
    setHovered(null)
  }, [currentKey, answers])

  const effective = useMemo(
    () => (currentKey && draft !== undefined ? withAnswer(answers, currentKey, draft) : answers),
    [answers, currentKey, draft],
  )

  // ---- Derived catalogue state ---------------------------------------------------------------
  const ranked = useMemo(() => rank(def, items, effective), [def, items, effective])
  const asked = useMemo(() => askedSteps(def, items, answers), [def, items, answers])
  const counts = useMemo(
    () => (step ? optionCounts(def, items, effective, step.key) : null),
    [def, items, effective, step],
  )

  /** What the counter would read if the hovered tile were picked. */
  const preview = useMemo(() => {
    if (!step || !hovered || step.weightOnly || step.kind === 'range') return null
    const next = toggled(step, draft, hovered)
    return filter(def, items, withAnswer(answers, step.key, next)).length
  }, [def, items, answers, step, draft, hovered])

  // ---- Navigation ----------------------------------------------------------------------------
  const go = useCallback(
    (next: Answers, at?: string, from?: string) =>
      navigate({
        to: '.',
        search: { ...next, ...(at && { at }), ...(from && { from }) },
        resetScroll: false,
      }),
    [navigate],
  )
  const commit = useCallback(
    (value: string | null) => {
      if (!currentKey) return
      go(withAnswer(answers, currentKey, value))
    },
    [answers, currentKey, go],
  )
  const goTo = useCallback((key: string) => go(answers, key), [answers, go])
  const back = useCallback(() => {
    const previous = previousStep(def, items, answers, currentKey)
    if (previous) go(answers, previous)
  }, [def, items, answers, currentKey, go])
  const reset = useCallback(() => go({}), [go])
  // The results read the answers on screen, picks not yet confirmed included (the button said
  // how many they leave), and remember the question they were opened from.
  const showResults = useCallback(
    () => go(sanitizeAnswers(def, effective), DONE, currentKey ?? undefined),
    [def, effective, currentKey, go],
  )
  // Back from the results to that question; without one (a shared link), to the first question
  // left unanswered, or the last one asked when every question has its answer.
  const from = search.from
  const editAnswers = useCallback(() => {
    const target =
      (from && asked.includes(from) ? from : null) ??
      firstPending(def, items, answers) ??
      asked[asked.length - 1]
    if (target) go(answers, target)
  }, [def, items, answers, asked, from, go])
  const canGoBack = useMemo(
    () => previousStep(def, items, answers, currentKey) != null,
    [def, items, answers, currentKey],
  )

  const blockerOf = useCallback(
    (optionId: string) => {
      if (!step) return null
      const found = deadEnd(def, items, effective, step.key, optionId)
      if (!found) return null
      const blocker = def.steps.find((s) => s.key === found.blockedBy)
      return blocker ? { key: blocker.key, label: blocker.label[locale], count: found.count } : null
    },
    [def, items, effective, step, locale],
  )

  // ---- Answer rail ---------------------------------------------------------------------------
  const rail = useMemo(
    () =>
      def.steps
        .filter((s) => answers[s.key] != null && asked.includes(s.key))
        .map((s) => ({
          key: s.key,
          label: s.label[locale],
          value: describeAnswer(s, answers[s.key], locale) ?? '',
        })),
    [def, answers, asked, locale],
  )

  // ---- Canvas --------------------------------------------------------------------------------
  /** The test each answered step puts on a product, the draft included. */
  const tests = useMemo(
    () =>
      def.steps.flatMap((s) => {
        const test = predicateOf(s, effective)
        return test ? [{ step: s, test }] : []
      }),
    [def, effective],
  )

  /**
   * How many answers each product fails: 0 is kept (drawn in colour), more is drawn as an ever
   * fainter sketch. null while no answer filters anything yet.
   */
  const misses = useMemo(() => {
    if (!tests.length) return null
    return new Map(items.map((item) => [def.id(item), tests.filter((t) => !t.test(item)).length]))
  }, [def, items, tests])

  /** Kept products, best match first: the canvas's short list and podium badges follow it. */
  const order = useMemo(() => ranked.map((r) => def.id(r.item)), [def, ranked])
  const scores = useMemo(() => ranked.map((r) => r.score), [ranked])

  /** Products the hovered option keeps, given every other answer: highlighted on the canvas. */
  const hotIds = useMemo(() => {
    if (!step || !hovered || step.weightOnly || step.kind === 'range') return null
    const option = step.options.find((o) => o.id === hovered)
    if (!option) return null
    const base = filter(def, items, answers, { without: step.key })
    // A must-have adds to the ones already picked, so those stay applied.
    const pool = step.kind === 'musts' ? filter(def, base, effective) : base
    return new Set(pool.filter(option.match).map(def.id))
  }, [def, items, answers, effective, step, hovered])

  /** What the product popup prints: rank and match for a kept product, the blocking answer otherwise. */
  const details = useMemo(() => {
    const map = new Map<string, ItemDetail>()
    ranked.forEach((r, i) => {
      map.set(def.id(r.item), { rank: i, score: r.score, excludedBy: null })
    })
    for (const item of items) {
      const id = def.id(item)
      if (map.has(id)) continue
      const blocker = tests.find((t) => !t.test(item))
      map.set(id, { rank: null, score: null, excludedBy: blocker?.step.label[locale] ?? null })
    }
    return map
  }, [def, items, ranked, tests, locale])

  /** One product's sheet, whether the answers keep it or rule it out. */
  const sheetOf = useCallback(
    (slug: string): ProductSheet | null => {
      const index = ranked.findIndex((r) => def.id(r.item) === slug)
      const entry = ranked[index]
      if (entry) return { ...entry, rank: index, excludedBy: null }
      const item = items.find((i) => def.id(i) === slug)
      if (!item) return null
      // Ruled out: no rank and no score, but its strengths still read against the visitor's use.
      const use = effective[def.profileStep]
      const [fit] = rank(def, [item], use ? { [def.profileStep]: use } : {})
      return {
        item,
        rank: null,
        score: null,
        pros: fit?.pros ?? [],
        cons: fit?.cons ?? [],
        excludedBy: details.get(slug)?.excludedBy ?? null,
      }
    },
    [def, items, ranked, effective, details],
  )

  return {
    def,
    items,
    answers,
    step,
    currentKey,
    draft,
    setDraft,
    hovered,
    setHovered,
    ranked,
    matching: ranked.length,
    preview,
    counts,
    asked,
    position: currentKey ? asked.indexOf(currentKey) + 1 : asked.length,
    rail,
    misses,
    order,
    scores,
    hotIds,
    details,
    commit,
    goTo,
    back,
    canGoBack,
    reset,
    showResults,
    editAnswers,
    blockerOf,
    sheetOf,
  }
}

export type Finder = ReturnType<typeof useFinder>

/** The draft after clicking a tile: a single pick replaces, a multi pick toggles. */
export function toggled<I>(step: Step<I>, draft: string | undefined, id: string): string {
  if (step.kind !== 'multi' && step.kind !== 'musts') return id
  const picked = readChoice(step as ChoiceStep<I>, draft)
  const list = picked && picked !== ANY ? picked : []
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  return next.length ? next.join(',') : ''
}
