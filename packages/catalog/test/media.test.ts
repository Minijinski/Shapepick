import { describe, expect, it } from 'vitest'
import type { CatalogItem } from '../src'
import { drawingBox, squareOn } from '../src/media'
import { keyboards, monitors } from './fixtures'

// The canvas lets a photo stand in for a product's drawing only when it shows the product square
// on (`squareOn`). The cuts below were measured on real photos (2026-10-24): what must now pass,
// and the angled shots, banners and turned screens that must still be refused.

type Measure = { fill: number; parts?: number; detail?: number; symmetry?: number }
/** A cut whose proportions are `ratio` times those of the item's drawing. */
const cut = (item: CatalogItem, ratio: number, measure: Measure) => {
  const box = drawingBox(item)
  return { width: ratio * (box.w / box.h) * 1000, height: 1000, ...measure }
}
const keyboard = (form: string) => {
  const found = keyboards.find((k) => k.specs.formFactor === form)
  if (!found) throw new Error(`no ${form} board in the demo catalogue`)
  return found
}
const monitor = monitors.find((m) => m.specs.aspect === '16:9')
if (!monitor) throw new Error('no 16:9 monitor in the demo catalogue')

describe('squareOn, split keyboards', () => {
  const split = keyboard('split')
  it('passes halves joined by their cable, seen from above (Keychron Q11)', () => {
    expect(
      squareOn(split, cut(split, 1.2, { fill: 0.726, symmetry: 0.876, detail: 0.225, parts: 1 })),
    ).toBe(true)
  })
  it('still refuses a split board seen at an angle', () => {
    expect(
      squareOn(split, cut(split, 0.65, { fill: 0.72, symmetry: 0.6, detail: 0.2, parts: 1 })),
    ).toBe(false)
  })
  it('still refuses its underside', () => {
    expect(
      squareOn(split, cut(split, 1.2, { fill: 0.73, symmetry: 0.9, detail: 0.02, parts: 2 })),
    ).toBe(false)
  })
  it('refuses a round icon on its page, symmetric as it is', () => {
    expect(
      squareOn(split, cut(split, 0.41, { fill: 0.791, symmetry: 0.999, detail: 0.1, parts: 1 })),
    ).toBe(false)
  })
  it('keeps the one-piece rule for other boards', () => {
    const board = keyboard('f75')
    expect(
      squareOn(board, cut(board, 1, { fill: 0.726, symmetry: 0.95, detail: 0.2, parts: 1 })),
    ).toBe(false)
  })
})

describe('squareOn, monitors', () => {
  it('keeps a plain front view', () => {
    expect(squareOn(monitor, cut(monitor, 1, { fill: 0.72, symmetry: 0.96, parts: 1 }))).toBe(true)
  })
  it('passes a front view widened by side shields (BenQ ZOWIE)', () => {
    expect(squareOn(monitor, cut(monitor, 1.265, { fill: 0.712, symmetry: 1, parts: 1 }))).toBe(
      true,
    )
  })
  it('passes a front view on a tall, thin stand (LG Smart Monitor Swing)', () => {
    expect(squareOn(monitor, cut(monitor, 0.43, { fill: 0.455, symmetry: 0.982, parts: 1 }))).toBe(
      true,
    )
  })
  it('still refuses a wide banner', () => {
    expect(squareOn(monitor, cut(monitor, 1.19, { fill: 0.988, symmetry: 0.996, parts: 1 }))).toBe(
      false,
    )
  })
  it('still refuses a screen turned to portrait', () => {
    expect(squareOn(monitor, cut(monitor, 0.45, { fill: 0.8, symmetry: 0.97, parts: 1 }))).toBe(
      false,
    )
  })
  it('still refuses a three-quarter view', () => {
    expect(squareOn(monitor, cut(monitor, 0.805, { fill: 0.67, symmetry: 0.779, parts: 1 }))).toBe(
      false,
    )
    expect(squareOn(monitor, cut(monitor, 1.25, { fill: 0.7, symmetry: 0.9, parts: 1 }))).toBe(
      false,
    )
  })
})
