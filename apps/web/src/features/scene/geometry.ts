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

/** Stable 32-bit hash of a string (FNV-1a). */
function hash32(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Stable 0..1 value from an id: shuffles, starting points. */
export const hash01 = (id: string) => (hash32(id) % 10000) / 10000

/** Numbers in 0..1 from a seed (mulberry32): the same seed always gives the same ones. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The shortest way across a tile that repeats every `period`: `d` or one of its wrapped twins. */
const across = (d: number, period: number) => d - period * Math.round(d / period)
const wrapped = (v: number, period: number) => ((v % period) + period) % period

/**
 * How the tile's places spread: closer than `reach` (in cells) two places push each other apart,
 * `step` of what they lack per pass, over `passes`; a small catalogue's copies trade places at most
 * `swaps` times to stand further apart; then products closer than `gap` (a share of the cell's
 * shorter side) for their sizes part, over at most `gapPasses`.
 */
const SCATTER = { reach: 0.92, passes: 16, step: 0.35, swaps: 24, gap: 0.16, gapPasses: 12 }

/** A place being spread: where it is, half its product's size, and the push it gathers in a pass. */
type Dot = {
  index: number
  x: number
  y: number
  hw: number
  hh: number
  mx: number
  my: number
  bucket: number
  next: Dot | null
}

/** One copy of a product, and the place it holds. */
type Spot = { id: string; w: number; h: number; dot: Dot }

const dotAt = (index: number, x: number, y: number, hw = 0, hh = 0): Dot => ({
  index,
  x,
  y,
  hw,
  hh,
  mx: 0,
  my: 0,
  bucket: 0,
  next: null,
})

/**
 * A tile that wraps, cut in buckets at least `reach` wide, so the dots near one another are found
 * in the buckets around theirs instead of among all of them.
 */
class Torus {
  private readonly cols: number
  private readonly rows: number
  private readonly heads: (Dot | null)[]
  private readonly around: number[][] = []

  constructor(
    readonly w: number,
    readonly h: number,
    reach: number,
  ) {
    this.cols = Math.max(1, Math.floor(w / reach))
    this.rows = Math.max(1, Math.floor(h / reach))
    this.heads = new Array(this.cols * this.rows).fill(null)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // Each neighbour once, even on a tile only a bucket or two across.
        const list: number[] = []
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const k = wrapped(r + dr, this.rows) * this.cols + wrapped(c + dc, this.cols)
            if (!list.includes(k)) list.push(k)
          }
        }
        this.around.push(list)
      }
    }
  }

  /** Calls `visit` once for every two dots in neighbouring buckets. */
  pairs(dots: Dot[], visit: (a: Dot, b: Dot) => void) {
    const { cols, rows, heads } = this
    heads.fill(null)
    for (const dot of dots) {
      const c = Math.min(cols - 1, Math.floor((dot.x / this.w) * cols))
      const r = Math.min(rows - 1, Math.floor((dot.y / this.h) * rows))
      dot.bucket = r * cols + c
      dot.next = heads[dot.bucket] ?? null
      heads[dot.bucket] = dot
    }
    for (const a of dots) {
      for (const k of this.around[a.bucket] ?? []) {
        for (let b = heads[k] ?? null; b; b = b.next) if (b.index > a.index) visit(a, b)
      }
    }
  }

  /** Moves every dot by the push it gathered, back inside the tile. */
  settle(dots: Dot[]) {
    for (const dot of dots) {
      dot.x = wrapped(dot.x + dot.mx, this.w)
      dot.y = wrapped(dot.y + dot.my, this.h)
      dot.mx = 0
      dot.my = 0
    }
  }
}

/**
 * The repeating tile of a category's canvas: one place per product, scattered evenly over the tile
 * (blue noise) rather than in rows, one cell's area each. Places spread in units of the cell, whose
 * proportions follow the products' (a keyboard's is wide), then products too close for their sizes
 * part. A small catalogue is laid out several times, each copy shuffled differently and every copy
 * of a product as far as it can get from the others, so its repetition is far apart.
 * Deterministic: the same catalogue always lands in the same places.
 */
export function tileLayout(
  items: readonly { id: string; w: number; h: number }[],
  cell: { w: number; h: number },
  copies = 1,
) {
  const n = items.length * copies
  if (!n) return { cells: [], w: 2 * cell.w, h: 2 * cell.h }
  const random = seeded(hash32(items.map((item) => item.id).join('|')) ^ copies)
  // In cells: a square of one cell per place.
  const w = Math.sqrt(n)
  const h = n / w
  // Each place starts at random in a stratum of its own, so none start piled up, then the places
  // too close push each other apart, pass after pass, until they are spread evenly.
  const cols = Math.ceil(w)
  const rows = Math.ceil(n / cols)
  const strata = Array.from({ length: cols * rows }, (_, i) => i)
  for (let i = strata.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const s = strata[i] ?? i
    strata[i] = strata[j] ?? j
    strata[j] = s
  }
  const dots = strata
    .slice(0, n)
    .map((s, index) =>
      dotAt(
        index,
        ((s % cols) + random()) * (w / cols),
        (Math.floor(s / cols) + random()) * (h / rows),
      ),
    )
  const { reach, step } = SCATTER
  const unit = new Torus(w, h, reach)
  for (let pass = 0; pass < SCATTER.passes; pass++) {
    unit.pairs(dots, (a, b) => {
      const dx = across(a.x - b.x, w)
      const dy = across(a.y - b.y, h)
      const d2 = dx * dx + dy * dy
      if (d2 >= reach * reach) return
      const d = Math.sqrt(d2)
      // Two places on top of each other part sideways.
      const [ux, uy, push] = d > 1e-9 ? [dx, dy, ((reach - d) / d) * step * 0.5] : [1, 0, 0.01]
      a.mx += ux * push
      a.my += uy * push
      b.mx -= ux * push
      b.my -= uy * push
    })
    unit.settle(dots)
  }

  // Products to places: each one's first copy at random, every further copy at the free place
  // farthest from its earlier ones, so a small catalogue never shows a product twice side by side.
  const between = (a: Pt, b: Pt) => across(a.x - b.x, w) ** 2 + across(a.y - b.y, h) ** 2
  const shuffled = (copy: number) =>
    [...items].sort(
      (a, b) => hash01(`${a.id}#${copy}`) - hash01(`${b.id}#${copy}`) || a.id.localeCompare(b.id),
    )
  const taken = new Set<Dot>()
  const byProduct = new Map<string, Spot[]>()
  const owners: Spot[] = []
  for (let copy = 0; copy < copies; copy++) {
    for (const item of shuffled(copy)) {
      const mine = byProduct.get(item.id) ?? []
      let dot = copy ? undefined : dots[owners.length]
      let far = -1
      for (const free of copy ? dots : []) {
        if (taken.has(free)) continue
        const near = Math.min(...mine.map((spot) => between(free, spot.dot)))
        if (near > far) {
          far = near
          dot = free
        }
      }
      if (!dot) continue
      const spot = { ...item, dot }
      taken.add(dot)
      byProduct.set(item.id, [...mine, spot])
      owners.push(spot)
    }
  }
  // The greedy picks leave the last products little choice: while the closest two copies of a
  // product can get further apart by trading places with another product's copy (which must not
  // end up closer to its own), they do.
  const apart = (spots: readonly Pt[]) => {
    let near = Number.POSITIVE_INFINITY
    spots.forEach((a, i) => {
      for (const b of spots.slice(i + 1)) near = Math.min(near, between(a, b))
    })
    return near
  }
  for (let round = 0; copies > 1 && round < SCATTER.swaps; round++) {
    let worst: Spot[] = []
    let least = Number.POSITIVE_INFINITY
    for (const spots of byProduct.values()) {
      const near = apart(spots.map((spot) => spot.dot))
      if (near < least) {
        least = near
        worst = spots
      }
    }
    let trade: [Spot, Spot] | null = null
    let gain = least
    for (const mine of worst) {
      for (const other of owners) {
        if (other.id === mine.id) continue
        const theirs = byProduct.get(other.id) ?? []
        const after = Math.min(
          apart(worst.map((spot) => (spot === mine ? other.dot : spot.dot))),
          apart(theirs.map((spot) => (spot === other ? mine.dot : spot.dot))),
        )
        if (after > gain) {
          gain = after
          trade = [mine, other]
        }
      }
    }
    if (!trade) break
    const [a, b] = trade
    const dot = a.dot
    a.dot = b.dot
    b.dot = dot
  }

  // In world px: products closer than the gap for their sizes part, along the side where they
  // lack the least room (the smallest move).
  const tw = w * cell.w
  const th = h * cell.h
  const gap = SCATTER.gap * Math.min(cell.w, cell.h)
  const placed = owners.map((o, index) =>
    dotAt(index, o.dot.x * cell.w, o.dot.y * cell.h, o.w / 2, o.h / 2),
  )
  const largest = Math.max(...owners.map((o) => Math.max(o.w, o.h)))
  const world = new Torus(tw, th, largest + gap)
  for (let pass = 0; pass < SCATTER.gapPasses; pass++) {
    let close = 0
    world.pairs(placed, (a, b) => {
      const dx = across(a.x - b.x, tw)
      const dy = across(a.y - b.y, th)
      const lackX = gap - (Math.abs(dx) - a.hw - b.hw)
      const lackY = gap - (Math.abs(dy) - a.hh - b.hh)
      if (lackX <= 0 || lackY <= 0) return
      close++
      if (lackX < lackY) {
        const s = (lackX / 2) * (dx < 0 ? -1 : 1)
        a.mx += s
        b.mx -= s
      } else {
        const s = (lackY / 2) * (dy < 0 ? -1 : 1)
        a.my += s
        b.my -= s
      }
    })
    if (!close) break
    world.settle(placed)
  }
  const cells = owners.map((o, i) => {
    const dot = placed[i] as Dot
    return { id: o.id, x: dot.x, y: dot.y }
  })
  return { cells, w: tw, h: th }
}
