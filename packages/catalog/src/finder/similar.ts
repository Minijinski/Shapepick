import type { ChoiceStep, FinderDefinition } from './types'

// Products like a given one, which its sheet suggests: those that answer the questions saying what
// a product is (the definition's `likeness`: its size, its technology…) the way it does, at a price
// close to its own, and no more than two of a maker, so that other brands show too. A product's
// answer to a question is every option it meets (a board sold in AZERTY and in US QWERTY meets
// both); two answers are as alike as the share of options they have in common (Jaccard). Pure and
// stable: the server and the browser suggest the same products, and the links stay put for
// search engines whatever the visitor answered.

/** What a price twice as high, or half as high, costs a product's likeness: ln 2 × this. */
const PRICE_WEIGHT = 0.25

/** The options a product meets. */
const optionsMet = <I>(step: ChoiceStep<I>, item: I) =>
  new Set(step.options.filter((o) => o.match(item)).map((o) => o.id))

/** The options two answers share, over those either meets: 1 alike, 0 nothing in common. */
function overlap(a: Set<string>, b: Set<string>) {
  // Two products the question cannot place (no option fits either) are alike there.
  if (!a.size && !b.size) return 1
  let shared = 0
  for (const id of a) if (b.has(id)) shared++
  return shared / (a.size + b.size - shared)
}

/** How far apart two prices are, as a ratio: 0 for the same price, ln 2 for twice as much. */
const priceGap = (a: number, b: number) =>
  a > 0 && b > 0 ? Math.abs(Math.log(a / b)) : a === b ? 0 : 1

/**
 * Up to `count` products of `items` most like `item`, the most alike first (ties by id). At most
 * `perMaker` of a maker while others are left to suggest; never `item` itself.
 */
export function similar<I>(
  def: FinderDefinition<I>,
  items: I[],
  item: I,
  { count = 4, perMaker = 2 }: { count?: number; perMaker?: number } = {},
): I[] {
  const id = def.id(item)
  const questions = (def.likeness ?? []).flatMap((likeness) => {
    const step = def.steps.find((s) => s.key === likeness.key)
    if (!step || step.kind === 'range') return []
    return [{ ...likeness, step, met: optionsMet(step, item) }]
  })
  const total = questions.reduce((sum, q) => sum + q.weight, 0)
  const price = def.price(item)

  const ranked = items.flatMap((other) => {
    if (def.id(other) === id) return []
    let alike = 0
    for (const q of questions) {
      const share = overlap(q.met, optionsMet(q.step, other))
      if (q.hard && share === 0) return []
      alike += q.weight * share
    }
    const value = (total ? alike / total : 0) - PRICE_WEIGHT * priceGap(def.price(other), price)
    return [{ other, value: Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY }]
  })
  ranked.sort((a, b) => b.value - a.value || def.id(a.other).localeCompare(def.id(b.other)))

  // Makers take a limited share; the products set aside make up the count only if nothing else can.
  const picked: I[] = []
  const aside: I[] = []
  const perBrand = new Map<string, number>()
  for (const { other } of ranked) {
    if (picked.length === count) break
    const maker = def.maker?.(other)
    const used = maker == null ? 0 : (perBrand.get(maker) ?? 0)
    if (maker != null && used >= perMaker) {
      aside.push(other)
      continue
    }
    if (maker != null) perBrand.set(maker, used + 1)
    picked.push(other)
  }
  return [...picked, ...aside].slice(0, count)
}
