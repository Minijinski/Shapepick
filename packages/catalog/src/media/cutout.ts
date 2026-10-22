// Cutting a product out of its photo, on pixels alone: no DOM, so the same code runs in the site's
// photo worker, on its main thread where workers cannot draw, and in the ingest's scripts.
//
// Shops shoot a product on white or a light grey (some publish it already cut out), often with
// company (the switch it ships with, spare keycaps). The ground reaching the photo's edges becomes
// transparent, the largest shape left is the product (with any shape nearly as large beside it:
// the other half of a split board), and the photo is cropped to it, less the cable trailing off it.

/** RGBA pixels, row by row: a canvas's ImageData, or a decoded image's raw buffer. */
export type Pixels = { data: Uint8ClampedArray; width: number; height: number }

/**
 * Where the product is in the photo, how many pixels it covers, how many separate shapes make it
 * (two for a split board; more is several products side by side), and how much detail it shows:
 * the share of its pixels on a sharp edge (keycaps give plenty, the bottom of a case hardly any).
 */
export type Box = {
  x: number
  y: number
  w: number
  h: number
  area: number
  parts: number
  detail: number
}

type Rgb = [number, number, number]

/** How far a channel may stray from the paper's colour and still be paper (JPEG noise). */
const TOLERANCE = 14
/** What passes for photo paper: every channel at least `light`, all within `tint` of each other. */
const PAPER = { light: 215, tint: 16 }
/**
 * A shape at least this share of the largest one's area, beside it, belongs to the product too
 * (the other half of a split board). Above or below it, it is something shown with the product: a
 * lid, a wrist rest set apart, a set of keycaps.
 */
const PART = 0.35
/** Below this share of the photo, the largest shape is a speck: nothing to cut out. */
const MIN_SHARE = 0.01
/**
 * A row or column of the product's box covered less than this is a cable or a strap trailing
 * off the product: the box is trimmed from its edges in, past every such line.
 */
const THIN = 0.08
/** Change in brightness between two neighbouring points that makes an edge (0 … 510). */
const EDGE = 30
/** Points across the product its detail is read on: the same reading whatever the photo's size. */
const DETAIL_GRID = 400

/**
 * What the photo was shot on, read on its edges: transparency (it comes cut out), a light neutral
 * colour (a studio white or grey), or anything else (null: a scene, a coloured backdrop).
 */
function paperOf(data: Uint8ClampedArray, w: number, h: number): Rgb | 'clear' | null {
  const reds: number[] = []
  const greens: number[] = []
  const blues: number[] = []
  let clear = 0
  const read = (i: number) => {
    const o = i * 4
    if ((data[o + 3] ?? 0) < 128) {
      clear++
      return
    }
    reds.push(data[o] ?? 0)
    greens.push(data[o + 1] ?? 0)
    blues.push(data[o + 2] ?? 0)
  }
  for (let x = 0; x < w; x++) {
    read(x)
    read((h - 1) * w + x)
  }
  for (let y = 1; y < h - 1; y++) {
    read(y * w)
    read(y * w + w - 1)
  }
  if (clear >= reds.length) return 'clear'
  const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1] ?? 0
  const paper: Rgb = [median(reds), median(greens), median(blues)]
  const light = Math.min(...paper)
  return light >= PAPER.light && Math.max(...paper) - light <= PAPER.tint ? paper : null
}

/**
 * Makes everything but the product transparent and returns its box (null: nothing to cut out).
 * The ground is what the photo was shot on, where it reaches the edges; the product, the largest
 * shape left and any shape nearly as large beside it. Pixels on the product's rim are a blend of it and the
 * paper: the paper is taken back out of them, so the edge stays smooth on ours.
 */
export function isolate({ data, width: w, height: h }: Pixels): Box | null {
  const paper = paperOf(data, w, h)
  if (!paper) return null
  const n = w * h
  const channel = (o: number) => data[o] ?? 0
  const onPaper = (i: number) => {
    const o = i * 4
    if (channel(o + 3) < 128) return true
    return (
      paper !== 'clear' &&
      Math.abs(channel(o) - paper[0]) <= TOLERANCE &&
      Math.abs(channel(o + 1) - paper[1]) <= TOLERANCE &&
      Math.abs(channel(o + 2) - paper[2]) <= TOLERANCE
    )
  }

  // The ground: a flood fill of the paper from the edges.
  const ground = new Uint8Array(n)
  const queue = new Int32Array(n)
  let head = 0
  let tail = 0
  const flood = (i: number) => {
    if (ground[i] || !onPaper(i)) return
    ground[i] = 1
    queue[tail++] = i
  }
  for (let x = 0; x < w; x++) {
    flood(x)
    flood((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    flood(y * w)
    flood(y * w + w - 1)
  }
  // Less than half of the edges on paper: the product fills the photo, nothing to cut out.
  if (tail < w + h) return null
  while (head < tail) {
    const i = queue[head++] ?? 0
    const x = i % w
    if (x > 0) flood(i - 1)
    if (x < w - 1) flood(i + 1)
    if (i >= w) flood(i - w)
    if (i < n - w) flood(i + w)
  }

  // The shapes left on it, each with its area and box.
  const label = new Int32Array(n)
  const shapes: { size: number; x0: number; y0: number; x1: number; y1: number }[] = []
  for (let start = 0; start < n; start++) {
    if (ground[start] || label[start]) continue
    const id = shapes.length + 1
    const shape = { size: 0, x0: w, y0: h, x1: 0, y1: 0 }
    head = 0
    tail = 0
    label[start] = id
    queue[tail++] = start
    const join = (i: number) => {
      if (ground[i] || label[i]) return
      label[i] = id
      queue[tail++] = i
    }
    while (head < tail) {
      const i = queue[head++] ?? 0
      const x = i % w
      const y = (i - x) / w
      shape.size++
      if (x < shape.x0) shape.x0 = x
      if (x > shape.x1) shape.x1 = x
      if (y < shape.y0) shape.y0 = y
      if (y > shape.y1) shape.y1 = y
      if (x > 0) join(i - 1)
      if (x < w - 1) join(i + 1)
      if (i >= w) join(i - w)
      if (i < n - w) join(i + w)
    }
    shapes.push(shape)
  }
  const main = shapes.reduce<(typeof shapes)[number] | null>(
    (best, s) => (!best || s.size > best.size ? s : best),
    null,
  )
  if (!main || main.size < n * MIN_SHARE) return null
  /** Whether a shape stands beside the largest one: their rows overlap by half the shorter. */
  const beside = (s: (typeof shapes)[number]) =>
    Math.min(s.y1, main.y1) - Math.max(s.y0, main.y0) >=
    0.5 * Math.min(s.y1 - s.y0, main.y1 - main.y0)
  const kept = new Uint8Array(shapes.length + 1)
  let x0 = w
  let y0 = h
  let x1 = 0
  let y1 = 0
  let parts = 0
  shapes.forEach((s, k) => {
    if (s !== main && (s.size < main.size * PART || !beside(s))) return
    kept[k + 1] = 1
    parts++
    x0 = Math.min(x0, s.x0)
    y0 = Math.min(y0, s.y0)
    x1 = Math.max(x1, s.x1)
    y1 = Math.max(y1, s.y1)
  })

  const product = (i: number) => kept[label[i] ?? 0] === 1
  // The USB cable most shops leave trailing off the board would stretch its box: the box is
  // trimmed back to the product's body (twice, for a cable that leaves from a corner).
  const across = (y: number) => {
    let count = 0
    for (let x = x0; x <= x1; x++) if (product(y * w + x)) count++
    return count
  }
  const down = (x: number) => {
    let count = 0
    for (let y = y0; y <= y1; y++) if (product(y * w + x)) count++
    return count
  }
  for (let pass = 0; pass < 2; pass++) {
    const row = THIN * (x1 - x0 + 1)
    while (y0 < y1 && across(y0) < row) y0++
    while (y1 > y0 && across(y1) < row) y1--
    const column = THIN * (y1 - y0 + 1)
    while (x0 < x1 && down(x0) < column) x0++
    while (x1 > x0 && down(x1) < column) x1--
  }

  let area = 0
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x
      const o = i * 4
      if (!product(i)) {
        data[o + 3] = 0
        continue
      }
      area++
      const rim =
        (x > 0 && !product(i - 1)) ||
        (x < w - 1 && !product(i + 1)) ||
        (y > 0 && !product(i - w)) ||
        (y < h - 1 && !product(i + w))
      // A photo that comes cut out has its rim blended already.
      if (!rim || paper === 'clear' || channel(o + 3) < 255) continue
      // Over the paper, this pixel is its colour at some opacity: the lowest one that explains it.
      let a = 0
      for (let c = 0; c < 3; c++) {
        const p = channel(o + c)
        const q = paper[c] ?? 255
        a = Math.max(a, p < q ? (q - p) / q : p > q ? (p - q) / (255 - q) : 0)
      }
      data[o + 3] = a * 255
      if (!a) continue
      for (let c = 0; c < 3; c++) {
        const q = paper[c] ?? 255
        data[o + c] = q + (channel(o + c) - q) / a
      }
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, area, parts, detail: detailOf() }

  /**
   * Share of the product's points on an edge with their right or lower neighbour, read on a grid
   * of about `DETAIL_GRID` points across, so that a photo's size does not change the reading.
   */
  function detailOf() {
    const step = Math.max(1, Math.round(Math.max(x1 - x0, y1 - y0) / DETAIL_GRID))
    const light = (i: number) =>
      0.3 * channel(i * 4) + 0.59 * channel(i * 4 + 1) + 0.11 * channel(i * 4 + 2)
    let edges = 0
    let seen = 0
    for (let y = y0; y + step <= y1; y += step) {
      for (let x = x0; x + step <= x1; x += step) {
        const i = y * w + x
        const right = i + step
        const below = i + step * w
        if (!product(i) || !product(right) || !product(below)) continue
        seen++
        const here = light(i)
        if (Math.abs(here - light(right)) + Math.abs(here - light(below)) > EDGE) edges++
      }
    }
    return seen ? edges / seen : 0
  }
}
