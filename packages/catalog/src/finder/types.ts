import type { Category } from '../domain/enums'
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
  /** The question's explanation. A term it defines is marked `**Term**: …` and opens a line. */
  help?: Text
  /** Branching: a step that does not apply is neither asked nor used to filter. */
  applies?: (answers: Answers) => boolean
  /**
   * Never filters: the answer only steers the ranking (the "use" question picks the profile; a
   * grip sets what a criterion measures).
   */
  weightOnly?: boolean
  /** No "no preference" tile: everyone can make this decision. */
  required?: boolean
  /**
   * Never asked: answered from its own control (the brand filter). It narrows the catalogue like
   * any answer, but takes no place in the questionnaire, its progress or the match.
   */
  aside?: boolean
  /** The words of the "no preference" answer, when others fit better ("Je ne sais pas"). */
  anyLabel?: Text
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
  /** The line a result card shows when this criterion is a strength. */
  label: Text
  /**
   * The line it shows when it is a weakness ("Fréquence modeste"); the label when absent. A
   * function when the weakness depends on the item and the answers ("Grande pour ta main").
   */
  weakLabel?: Text | ((item: I, answers: Answers) => Text)
  /**
   * A warning rather than a quality (an OLED's burn-in): never cited as a strength, and always
   * worth citing as a weakness, however light its weight.
   */
  caveat?: boolean
  /**
   * 0 (worst) … 1 (best) for this item. Most criteria read the item alone; one that measures the
   * item against an answer (a grip) reads the live answers, those of questions that apply.
   */
  score: (item: I, answers: Answers) => number
  /**
   * Whether the item's sheet gives what the score reads. One that does not counts as the median
   * of its peers that do: a missing figure is neither a flaw nor a strength.
   */
  known?: (item: I) => boolean
  /** Which items an item with a missing figure is compared with (default: all of them). */
  peers?: (item: I) => string
  /**
   * Whether the answers give it something to measure (the fit to a grip, once one is given):
   * until then it sits out of the fit. A criterion that reads the answers never declares `known`,
   * since what stands in for a missing figure is worked out once per catalogue.
   */
  active?: (answers: Answers) => boolean
}

/**
 * A question that says what a product is (its size, its technology), and how much answering it
 * alike makes two products alike. `hard`: two products that answer it with nothing in common are
 * never alike, however close the rest (a mouse for the other hand).
 */
export type Likeness = { key: string; weight: number; hard?: boolean }

export type FinderDefinition<I> = {
  category: Category
  steps: Step<I>[]
  criteria: Criterion<I>[]
  /** Criterion weights per answer of the profile step, plus a `default` profile. */
  profiles: Record<string, Record<string, number>>
  profileStep: string
  id: (item: I) => string
  price: (item: I) => number
  /**
   * 0 … 1 prior (editorial score, popularity): a quarter of the fit once it tells the catalogue's
   * items apart. While every item has the same one, it sits out.
   */
  prior: (item: I) => number
  /**
   * Between two items with exactly the same match and the same price, which comes first: negative
   * for `a`, positive for `b`. What it leaves level goes by id.
   */
  settle?: (a: I, b: I) => number
  /** Who makes the item: among items with the same match, the ranking takes makers in turn. */
  maker?: (item: I) => string
  /** The questions a product's sheet reads to suggest products like it (similar.ts). */
  likeness?: Likeness[]
}

export type Ranked<I> = {
  item: I
  /** 0 … 1, what the card prints as a match percentage. */
  score: number
  /**
   * 0 … 1, how well it suits the visitor's use: the profile's fit, with the editorial prior once it
   * tells items apart.
   */
  fit: number
  /** How many answers narrow the catalogue: a ranked item meets every one of them. */
  met: number
  pros: Text[]
  cons: Text[]
  /**
   * The answers it misses, by their step's label: only a product the answers rule out but that
   * comes close (`nearMisses`) has any. `met` then counts those it meets.
   */
  misses?: Text[]
}
