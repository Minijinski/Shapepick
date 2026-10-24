// Shapes of the home panels and of the infinite canvas tile. Pure functions of the viewport, so
// the canvas that draws the panels and the links that sit on top of them (hover, focus, click)
// always agree to the pixel.

import { radii } from '~/styles/radii'

export type Pt = { x: number; y: number }
/** Top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Pt, Pt, Pt, Pt]
export type Viewport = { w: number; h: number }

/** Tilt of the panels' dividers, from vertical. */
const TILT = (16 * Math.PI) / 180

export const isCompact = (vp: Viewport) => vp.w < 768

/**
 * How far down a category's canvas fades into paper under the header (px), past a phone's width:
 * the finder's top gradient, whose height in Finder.tsx (`clamp(10rem, 24dvh, 16rem)`) says the
 * same. A shorter screen gives it less of its height.
 */
export const topVeil = (vp: Viewport) => Math.min(256, Math.max(160, vp.h * 0.24))

/**
 * On a phone the home's panels are rows, one under the other below the title, and the page
 * scrolls: slats a third of a phone wide leave no room for a name or for the title above them,
 * nor slats as short as a phone on its side. (`_slats` in panda.config.ts says the same in CSS.)
 */
export const bandsInRows = (vp: Viewport) => isCompact(vp) || vp.h < 480

/** The header's height, and the side margin, gap between rows and bottom margin of the rows (px). */
const ROWS = { header: 64, side: 8, gutter: 8, bottom: 8 }

/**
 * A phone's home, in page px: the title's room under the header, then one row per panel. The
 * first three rows share the rest of the first screen, within bounds; more rows scroll into view.
 * styles.css repeats these numbers for the server render and the preloader (`--rows-*`).
 */
export function rowsFrame(vp: Viewport, count: number) {
  // A phone on its side keeps less room for the title (two lines there).
  const hero = Math.min(240, Math.max(vp.h < 480 ? 132 : 180, vp.h * 0.26))
  const top = ROWS.header + hero
  const first = Math.max(1, Math.min(count, 3))
  const room = (vp.h - top - ROWS.bottom - ROWS.gutter * (first - 1)) / first
  const band = Math.min(220, Math.max(152, room))
  return {
    hero,
    top,
    band,
    side: ROWS.side,
    gutter: ROWS.gutter,
    /** The page's scrollable height. */
    height: top + count * band + Math.max(0, count - 1) * ROWS.gutter + ROWS.bottom,
  }
}

/** The paper margin around the panels: header room on top, a thin frame elsewhere. */
export function frameOf(vp: Viewport) {
  const compact = isCompact(vp)
  return {
    top: compact ? 60 : 68,
    side: compact ? 8 : 14,
    bottom: compact ? 8 : 14,
    gutter: compact ? 8 : 14,
    // The panels round their corners like every other panel of the site.
    radius: radii.panel,
  }
}

/** Narrow panels get a gentler slant so they never fold into slivers; rows stand straight. */
export function tiltFor(vp: Viewport, count: number) {
  if (bandsInRows(vp)) return 0
  const f = frameOf(vp)
  const width = (vp.w - 2 * f.side) / Math.max(count, 1)
  const half = (vp.h - f.top - f.bottom) / 2
  return Math.min(TILT, Math.atan((width * 0.3) / Math.max(half, 1)))
}

/**
 * One panel per category. The frame's outer edges stay vertical and the dividers between panels
 * lean right at the top, so the panels read as tilted slats inside a straight frame. On a phone,
 * straight rows under the title instead, in page px (the scene shifts them as the page scrolls).
 */
export function bandQuads(vp: Viewport, count: number): Quad[] {
  if (bandsInRows(vp)) {
    const r = rowsFrame(vp, count)
    return Array.from({ length: count }, (_, i) => {
      const y0 = r.top + i * (r.band + r.gutter)
      const y1 = y0 + r.band
      return [
        { x: r.side, y: y0 },
        { x: vp.w - r.side, y: y0 },
        { x: vp.w - r.side, y: y1 },
        { x: r.side, y: y1 },
      ] as Quad
    })
  }
  const f = frameOf(vp)
  const top = f.top
  const bottom = vp.h - f.bottom
  const left = f.side
  const right = vp.w - f.side
  const slant = ((bottom - top) / 2) * Math.tan(tiltFor(vp, count))
  const quads: Quad[] = []
  for (let i = 0; i < count; i++) {
    const x0 = left + ((right - left) * i) / count
    const x1 = left + ((right - left) * (i + 1)) / count
    const lt = i === 0 ? left : x0 + slant + f.gutter / 2
    const lb = i === 0 ? left : x0 - slant + f.gutter / 2
    const rt = i === count - 1 ? right : x1 + slant - f.gutter / 2
    const rb = i === count - 1 ? right : x1 - slant - f.gutter / 2
    quads.push([
      { x: lt, y: top },
      { x: rt, y: top },
      { x: rb, y: bottom },
      { x: lb, y: bottom },
    ])
  }
  return quads
}

export const fullQuad = (vp: Viewport): Quad => [
  { x: 0, y: 0 },
  { x: vp.w, y: 0 },
  { x: vp.w, y: vp.h },
  { x: 0, y: vp.h },
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const lerpQuad = (a: Quad, b: Quad, t: number): Quad =>
  a.map((p, i) => {
    const q = b[i] as Pt
    return { x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) }
  }) as Quad

export const centroid = (q: Quad): Pt => ({
  x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
  y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
})

export function boundsOf(q: Quad) {
  const xs = q.map((p) => p.x)
  const ys = q.map((p) => p.y)
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** Whether a point lies inside a quad (convex, corners in order). */
export function insideQuad(q: Quad, p: Pt) {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i] as Pt
    const b = q[(i + 1) % 4] as Pt
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (cross === 0) continue
    if (sign === 0) sign = Math.sign(cross)
    else if (Math.sign(cross) !== sign) return false
  }
  return true
}

/** x of the quad's left (or right) edge at height y. */
export function edgeAt(q: Quad, side: 'left' | 'right', y: number) {
  const [a, b] = side === 'left' ? [q[0], q[3]] : [q[1], q[2]]
  const t = (y - a.y) / (b.y - a.y || 1)
  return lerp(a.x, b.x, Math.min(1, Math.max(0, t)))
}

/** Traces the quad with rounded corners (radius clamped to half the shortest edge). */
export function traceRounded(path: CanvasPath, q: Quad, radius: number) {
  const edges = q.map((p, i) => {
    const n = q[(i + 1) % 4] as Pt
    return Math.hypot(n.x - p.x, n.y - p.y)
  })
  const r = Math.max(0, Math.min(radius, Math.min(...edges) / 2 - 0.5))
  const last = q[3]
  const first = q[0]
  path.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
  for (let i = 0; i < 4; i++) {
    const a = q[i] as Pt
    const b = q[(i + 1) % 4] as Pt
    if (r > 0) path.arcTo(a.x, a.y, b.x, b.y, r)
    else path.lineTo(a.x, a.y)
  }
  path.closePath()
}

/** The same quad as a CSS clip-path, for the links laid over the canvas. */
export const clipPathOf = (q: Quad) =>
  `polygon(${q.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})`

/** Stable 0..1 value from an id: placement jitter, shuffles. */
export function hash01(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

/**
 * The repeating tile of a category's canvas: cells in rows offset like bricks, each with a stable
 * jitter (-1..1) that the canvas scales by the room its product leaves, so the field reads as
 * scattered rather than gridded. A small catalogue is laid out several times, each copy shuffled
 * differently, so its repetition is far apart. Deterministic: the same catalogue always lands in
 * the same places.
 */
export function tileLayout(ids: string[], cell: { w: number; h: number }, copies = 1) {
  const order = Array.from({ length: copies }, (_, copy) =>
    [...ids].sort((a, b) => hash01(`${a}#${copy}`) - hash01(`${b}#${copy}`) || a.localeCompare(b)),
  ).flat()
  const n = Math.max(order.length, 1)
  const cols = Math.max(2, Math.ceil(Math.sqrt(n)))
  const rows = Math.max(2, Math.ceil(n / cols))
  const cells = order.map((id, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const key = `${id}#${Math.floor(i / Math.max(ids.length, 1))}`
    return {
      id,
      cx: (col + 0.5 + (row % 2) * 0.5) * cell.w,
      cy: (row + 0.5) * cell.h,
      jx: hash01(`${key}:x`) * 2 - 1,
      jy: hash01(`${key}:y`) * 2 - 1,
    }
  })
  return { cells, w: cols * cell.w, h: rows * cell.h }
}
