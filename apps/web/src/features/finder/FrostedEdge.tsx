import type { CSSProperties } from 'react'
import { css, cx } from 'styled-system/css'

// The canvas frosting lightly along the screen's left edge, under the journey's column: the steps
// stay legible over the products drifting behind, which still show through, and nothing shows
// where the frost starts. A single blur faded out leaves a line there (a product's sharp half
// beside a blurred copy of the other); here three layers, each blurring more than the one before,
// lie over bands overlapping their neighbours', so the blur grows steadily towards the edge while a
// light paper tint, eased too, joins it. A blur only sees the canvas while no ancestor fades, masks
// or filters (a "backdrop root"): the layers fade in and out themselves (`data-enter="veil"`),
// never their box.

/** Each layer's blur (px), from the inner end of the frost to where it is whole. */
const BLURS = [1, 2.5, 5]
/** How much of the width, from the screen's edge, the frost is whole: under the column's words. */
const WHOLE = 0.56
/** The paper over the canvas where the frost is whole: enough for the words, not a wall. */
const TINT = 0.66
/** How tall the frost's rise along its top edge is (rem). */
const RISE = 6

const smooth = (t: number) => t * t * (3 - 2 * t)
const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits
const pct = (n: number) => `${round(n * 100, 2)}%`
const paper = (a: number) => `rgba(243,241,236,${round(a, 3)})`

/** The frost's rise along its top edge, eased: laid over every layer's own mask. */
const rise = `linear-gradient(to bottom, ${Array.from(
  { length: 7 },
  (_, i) => `rgba(0,0,0,${round(smooth(i / 6), 3)}) ${round((RISE * i) / 6, 2)}rem`,
).join(', ')})`

/**
 * Where the `j`th band boundary falls (share of the width, from the screen's edge): from the inner
 * end of the frost (j = 0) to where it is whole (j = BLURS.length).
 */
const at = (j: number) => 1 - (j * (1 - WHOLE)) / BLURS.length

/**
 * The band a layer blurs over, from the screen's edge: rising from the inner side over one step,
 * whole over the next, falling away over the one after; the strongest ones stay whole out to the
 * edge, under the words.
 */
function band(i: number) {
  const n = BLURS.length
  return i + 2 <= n
    ? `linear-gradient(to right, transparent ${pct(at(i + 2))}, #000 ${pct(at(i + 1))}, #000 ${pct(at(i))}, transparent ${pct(at(i - 1))})`
    : `linear-gradient(to right, #000 ${pct(at(i))}, transparent ${pct(at(i - 1))})`
}

const LAYERS: CSSProperties[] = BLURS.map((blur, index) => {
  const mask = `${band(index + 1)}, ${rise}`
  return {
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    maskImage: mask,
    WebkitMaskImage: mask,
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
  }
})

/** The paper tint: whole under the words, then easing out to nothing at the frost's inner end. */
const TINTED: CSSProperties = {
  background: `linear-gradient(to right, ${[
    `${paper(TINT)} 0%`,
    ...Array.from({ length: 8 }, (_, i) => {
      const t = i / 7
      return `${paper(TINT * (1 - smooth(t)))} ${pct(WHOLE + t * (1 - WHOLE))}`
    }),
  ].join(', ')})`,
  maskImage: rise,
  WebkitMaskImage: rise,
}

const layer = css({ position: 'absolute', inset: '0', pointerEvents: 'none' })
const enter = css({
  animation: 'fadeIn 0.9s token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
})

export function FrostedEdge({
  className,
  delay,
}: {
  /** Where it lies (its inset), and how it stacks under what stands on it. */
  className?: string
  /** When it fades in (s); null: it is already there (taken over from the last category). */
  delay: number | null
}) {
  const entering = delay != null
  const timed = (style: CSSProperties) =>
    entering ? { ...style, animationDelay: `${delay}s` } : style
  return (
    <div
      aria-hidden
      className={cx(css({ position: 'absolute', pointerEvents: 'none' }), className)}
    >
      {LAYERS.map((style, index) => (
        <span
          key={BLURS[index]}
          data-enter="veil"
          className={cx(layer, entering && enter)}
          style={timed(style)}
        />
      ))}
      <span data-enter="veil" className={cx(layer, entering && enter)} style={timed(TINTED)} />
    </div>
  )
}
