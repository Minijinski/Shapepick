import type { CatalogItem } from '../domain/items'
import type { KeyboardSpecs, MonitorSpecs } from '../domain/schemas'

// The geometry of a product's drawing, from its specs alone: the keys of a board, the frame and
// stand of a monitor, and the box they fill. The site draws products from it (apps/web glyphs),
// lays its canvas out with it before drawing anything, and judges photos against it, here and in
// the ingest: a photo stands in for the drawing only if it shows the product the same way.

// ==== Keyboards ================================================================================

/** Key widths in units (1u = one alpha key); a negative width is a gap. */
type Rows = number[][]
export type Block = { x: number; y: number; rows: Rows }
export type Key = { x: number; y: number; w: number; accent: boolean }

const ONE = (n: number) => Array.from({ length: n }, () => 1)
const MAIN: Rows = [
  [...ONE(13), 2],
  [1.5, ...ONE(12), 1.5],
  [1.75, ...ONE(11), 2.25],
  [2.25, ...ONE(10), 2.75],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
]
const F_ROW = [1, -1, ...ONE(4), -0.5, ...ONE(4), -0.5, ...ONE(4)]
const NUMPAD: Rows = [ONE(4), ONE(4), ONE(3), ONE(4), [2, 1, 1]]
const NAV: Rows = [ONE(3), ONE(3), [], [-1, 1], ONE(3)]
const withColumn = (rows: Rows): Rows => rows.map((r) => [...r, 1])
const scaleRows = (rows: Rows, to: number): Rows =>
  rows.map((r) => {
    const total = r.reduce((s, w) => s + Math.abs(w), 0)
    return r.map((w) => (w * to) / total)
  })

const layouts: Record<KeyboardSpecs['formFactor'], Block[]> = {
  full: [
    { x: 0, y: 0, rows: [F_ROW] },
    { x: 0, y: 1.25, rows: MAIN },
    { x: 15.25, y: 0, rows: [ONE(3)] },
    { x: 15.25, y: 1.25, rows: NAV },
    { x: 18.5, y: 1.25, rows: NUMPAD },
  ],
  f96: [
    { x: 0, y: 0, rows: [ONE(19)] },
    { x: 0, y: 1, rows: MAIN },
    { x: 15, y: 1, rows: NUMPAD },
  ],
  tkl: [
    { x: 0, y: 0, rows: [F_ROW] },
    { x: 0, y: 1.25, rows: MAIN },
    { x: 15.25, y: 0, rows: [ONE(3)] },
    { x: 15.25, y: 1.25, rows: NAV },
  ],
  f75: [
    {
      x: 0,
      y: 0,
      rows: [[1, -0.25, ...ONE(4), -0.25, ...ONE(4), -0.25, ...ONE(4), -0.25, 1]],
    },
    { x: 0, y: 1.1, rows: withColumn(MAIN) },
  ],
  f65: [{ x: 0, y: 0, rows: withColumn(MAIN) }],
  f60: [{ x: 0, y: 0, rows: MAIN }],
  f40: [{ x: 0, y: 0, rows: scaleRows(MAIN.slice(1), 12.5) }],
  split: [
    { x: 0, y: 0, rows: scaleRows(MAIN, 7.5) },
    { x: 9.5, y: 0, rows: scaleRows(MAIN, 7.5) },
  ],
  alice: [
    { x: 0, y: 0, rows: scaleRows(MAIN, 8) },
    { x: 8.6, y: 0, rows: scaleRows(MAIN, 8) },
  ],
  numpad: [{ x: 0, y: 0, rows: [ONE(4), ...NUMPAD] }],
}

/** The blocks of keys a board is drawn with (a split board's halves are two blocks). */
export const keyboardBlocks = (formFactor: KeyboardSpecs['formFactor']) => layouts[formFactor]

const keysCache = new Map<
  KeyboardSpecs['formFactor'],
  { keys: Key[]; width: number; height: number }
>()

/** The keys of a board, in key units, in reading order, and the area they span. */
export function keyboardKeys(formFactor: KeyboardSpecs['formFactor']) {
  const cached = keysCache.get(formFactor)
  if (cached) return cached
  const keys: Key[] = []
  let width = 0
  let height = 0
  for (const block of layouts[formFactor]) {
    block.rows.forEach((row, r) => {
      let x = block.x
      row.forEach((w, i) => {
        if (w > 0) {
          const accent =
            (r === 0 && i === 0 && block.y === 0 && block.x === 0) || (w >= 2 && w < 2.5 && r === 2)
          keys.push({ x, y: block.y + r, w, accent })
        }
        x += Math.abs(w)
      })
      width = Math.max(width, x)
      height = Math.max(height, block.y + r + 1)
    })
  }
  const made = { keys, width, height }
  keysCache.set(formFactor, made)
  return made
}

/** A board's case around its keys, in key units. */
export function keyboardCase(formFactor: KeyboardSpecs['formFactor'], lowProfile = false) {
  const { width, height } = keyboardKeys(formFactor)
  const pad = lowProfile ? 0.25 : 0.45
  const halves = formFactor === 'split' || formFactor === 'alice'
  return { pad, halves, caseW: width + pad * 2, caseH: height + pad * 2 }
}

// ==== Monitors =================================================================================

export const aspectRatio: Record<MonitorSpecs['aspect'], number> = {
  '16:9': 16 / 9,
  '16:10': 16 / 10,
  '21:9': 64 / 27,
  '32:9': 32 / 9,
  '3:2': 3 / 2,
}

/** A monitor's screen, bezel and stand, in inches. */
export function monitorBox(aspect: MonitorSpecs['aspect'], diagonalIn: number) {
  const ratio = aspectRatio[aspect]
  const h = diagonalIn / Math.sqrt(1 + ratio * ratio)
  const w = h * ratio
  const bezel = 0.45
  const standH = Math.max(3.5, h * 0.32)
  return { w, h, bezel, standH, totalW: w + bezel * 2, totalH: h + bezel * 2 + standH }
}

// ==== Any product ==============================================================================

/** The box a product's drawing fills (its viewBox), in key units or inches. */
export function drawingBox(item: CatalogItem): { w: number; h: number } {
  if (item.category === 'keyboard') {
    const { formFactor, lowProfile = false } = item.specs
    const { halves, caseW, caseH } = keyboardCase(formFactor, lowProfile)
    return { w: caseW, h: caseH + (halves ? 1.6 : 0) }
  }
  const { totalW, totalH } = monitorBox(item.specs.aspect, item.specs.diagonalIn)
  return { w: totalW + 0.4, h: totalH + 0.4 }
}

/**
 * How far a photo's proportions may stray from its drawing's (photo over drawing). Measured on the
 * shops' photos: top views land within 0.7–1.15; shots from a low angle, or with a mouse alongside,
 * beyond. A board that fills its box almost whole is seen from above whatever its proportions: it
 * may come with its wrist rest (down to 0.5) or be a little shorter than its drawing (up to 1.35).
 * Split and Alice drawings only sketch their shape, so their proportions are not checked.
 */
const PROPORTIONS = { min: 0.7, max: 1.15, minFlat: 0.5, maxFlat: 1.35 }
/** Share of its box a keyboard seen from above covers at least: a tilted one leaves its corners. */
const MIN_FILL = 0.8
/** From this share up (and this one, for a shorter board), only a flat top view fills its box. */
const FLAT_FILL = { rest: 0.93, short: 0.9 }
/** Below this detail, a board shows no keys: its underside, a plain case, a box. */
const MIN_DETAIL = 0.035
/**
 * A monitor seen from the front is symmetric left to right (its stand centred); seen at an angle,
 * its mirror image covers it much less. Proportions alone let a three-quarter view through.
 */
const MIN_SYMMETRY = 0.88

/**
 * Whether a cut-out photo shows its product as its drawing does, square on (a keyboard from
 * above, a monitor from the front), with nothing alongside: only then does it stand in for the
 * drawing on the canvas.
 */
export function squareOn(
  item: CatalogItem,
  cut: {
    width: number
    height: number
    fill: number
    parts?: number
    detail?: number
    symmetry?: number
  },
): boolean {
  const keyboard = item.category === 'keyboard'
  if (!keyboard && ((cut.symmetry ?? 1) < MIN_SYMMETRY || (cut.parts ?? 1) > 2)) return false
  if (keyboard) {
    if (cut.fill < MIN_FILL || (cut.detail ?? 1) < MIN_DETAIL) return false
    const split = item.specs.formFactor === 'split' || item.specs.formFactor === 'alice'
    // Three shapes and more: several boards, or a board among its parts.
    if ((cut.parts ?? 1) > 2) return false
    if (split) return true
  }
  const box = drawingBox(item)
  const ratio = cut.width / cut.height / (box.w / box.h)
  const min = keyboard && cut.fill >= FLAT_FILL.rest ? PROPORTIONS.minFlat : PROPORTIONS.min
  const max = keyboard && cut.fill >= FLAT_FILL.short ? PROPORTIONS.maxFlat : PROPORTIONS.max
  return ratio >= min && ratio <= max
}
