import type { Text } from '../i18n'

// A finder is content plus predicates: the wording, order and options of each screen live in a
// definition (keyboards.ts, monitors.ts); engine.ts decides what an answer does to the catalog.

/** Raw answers exactly as the URL carries them: `size=f75,f65`, `budget=0-150`, `use=gaming`. */
export type Answers = Record<string, string>

export const ANY = 'any'

export type Option<I> = {
  id: string
  label: Text
  hint?: Text
  match: (item: I) => boolean
}

type StepCommon<I> = {
  key: string
  /** Short name, used on the answer rail and in "blocked by" notes. */
  label: Text
  title: Text
  help?: Text
  /** Branching: a step that does not apply is neither asked nor used to filter. */
  applies?: (answers: Answers) => boolean
  /** Never filters; the answer only picks the ranking profile (the "use" question). */
  weightOnly?: boolean
  /** No "no preference" tile: everyone can make this decision. */
  required?: boolean
  // Phantom field so steps stay tied to their item type.
  readonly _item?: I
}

export type ChoiceStep<I> = StepCommon<I> & {
  /** single: one option · multi: any of the picked options (OR) · musts: all of them (AND) */
  kind: 'single' | 'multi' | 'musts'
  options: Option<I>[]
}

export type RangeStep<I> = StepCommon<I> & {
  kind: 'range'
  value: (item: I) => number
  bounds: [number, number]
  snap: number
}

export type Step<I> = ChoiceStep<I> | RangeStep<I>

export type Criterion<I> = {
  key: string
  /** The line a result card shows when this criterion is a strength or a weakness. */
  label: Text
  /** 0 (worst) … 1 (best) for this item. */
  score: (item: I) => number
}

export type FinderDefinition<I> = {
  category: 'keyboard' | 'monitor'
  steps: Step<I>[]
  criteria: Criterion<I>[]
  /** Criterion weights per answer of the profile step, plus a `default` profile. */
  profiles: Record<string, Record<string, number>>
  profileStep: string
  id: (item: I) => string
  price: (item: I) => number
  /** 0 … 1 prior (editorial score, popularity) that settles near-ties between equal fits. */
  prior: (item: I) => number
}

export type Ranked<I> = {
  item: I
  /** 0 … 1, what the card prints as a match percentage. */
  score: number
  pros: Text[]
  cons: Text[]
}
