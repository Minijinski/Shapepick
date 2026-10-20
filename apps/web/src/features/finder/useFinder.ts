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
  previousStep,
  rank,
  readChoice,
  readRange,
  type Step,
  sanitizeAnswers,
  withAnswer,
} from '@choose/catalog'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type CloudLayout, clusterLayout, fieldLayout, histogramLayout } from '../cloud/layout'

// Everything a finder screen shows is derived here from three inputs: the catalogue, the answers
// in the URL, and what the visitor is doing right now (a draft pick, a hovered tile). Committed
// answers live in the URL; the draft lives in state until "Continue".

export const DONE = 'done'

export type FinderSearch = Record<string, string | undefined>

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
    (next: Answers, at?: string) =>
      navigate({ to: '.', search: at ? { ...next, at } : next, resetScroll: false }),
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
  const showResults = useCallback(() => go(answers, DONE), [answers, go])
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

  // ---- Cloud ---------------------------------------------------------------------------------
  const cloud = useMemo(
    () => cloudFor({ def, items, answers, effective, step, ranked, hovered, draft, locale }),
    [def, items, answers, effective, step, ranked, hovered, draft, locale],
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
    cloud,
    commit,
    goTo,
    back,
    canGoBack,
    reset,
    showResults,
    blockerOf,
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

const euroShort = (locale: Locale) => (v: number) =>
  new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v)

function cloudFor({
  def,
  items,
  answers,
  effective,
  step,
  ranked,
  hovered,
  draft,
  locale,
}: {
  def: ReturnType<typeof finderOf>
  items: CatalogItem[]
  answers: Answers
  effective: Answers
  step: Step<CatalogItem> | null
  ranked: ReturnType<typeof rank<CatalogItem>>
  hovered: string | null
  draft: string | undefined
  locale: Locale
}): { key: string; layout: CloudLayout } {
  const ids = items.map(def.id)
  const order = new Map(ranked.map((r, i) => [def.id(r.item), i]))
  const byId = new Map(items.map((item) => [def.id(item), item]))

  if (!step) {
    const remaining = new Set(ranked.map((r) => def.id(r.item)))
    return {
      key: DONE,
      layout: fieldLayout({
        ids,
        remaining,
        order,
        tone: (id) => ((order.get(id) ?? 9) < 3 ? 'sel' : 'in'),
      }),
    }
  }

  const base = filter(def, items, answers, { without: step.key })
  const remaining = new Set(base.map(def.id))
  // Rank order for packing: the current picture's ranking, falling back to the base order.
  const packing = new Map(order)
  base.forEach((item, i) => {
    const id = def.id(item)
    if (!packing.has(id)) packing.set(id, ranked.length + i)
  })
  const common = { ids, remaining, order: packing }

  if (step.kind === 'range') {
    return {
      key: step.key,
      layout: histogramLayout({
        ...common,
        value: (id) => step.value(byId.get(id) as CatalogItem),
        bounds: step.bounds,
        range: (() => {
          const r = readRange(draft)
          return r && r !== ANY ? r : null
        })(),
        format: euroShort(locale),
      }),
    }
  }

  const kept = new Set(filter(def, base, effective).map(def.id))
  if (step.weightOnly)
    return { key: step.key, layout: fieldLayout({ ...common, tone: () => 'in' }) }

  if (step.kind === 'musts') {
    const hot = hovered ? step.options.find((o) => o.id === hovered) : null
    const anyPicked = !!draft
    return {
      key: step.key,
      layout: fieldLayout({
        ...common,
        tone: (id) => {
          const item = byId.get(id) as CatalogItem
          if (hot?.match(item) && kept.has(id)) return 'hot'
          return kept.has(id) ? (anyPicked ? 'sel' : 'in') : 'dim'
        },
      }),
    }
  }

  const picked = readChoice(step, draft)
  const selected = new Set(picked && picked !== ANY ? picked : [])
  const counts = optionCounts(def, items, answers, step.key).counts
  return {
    key: step.key,
    layout: clusterLayout({
      ...common,
      selected,
      hot: hovered,
      groups: step.options.map((o) => ({
        id: o.id,
        text: o.label[locale],
        count: counts[o.id] ?? 0,
        members: (id: string) => o.match(byId.get(id) as CatalogItem),
      })),
    }),
  }
}
