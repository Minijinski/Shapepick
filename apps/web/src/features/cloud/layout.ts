// Where every product sits in the data cloud for the current question. Pure and deterministic
// (no randomness, no viewport): the server renders the same picture the browser animates from.
// Coordinates live in a fixed VIEW box the SVG scales to the stage.

export const VIEW = { w: 1000, h: 520 } as const

export type DotState = 'out' | 'in' | 'dim' | 'sel' | 'hot'
export type Dot = {
  id: string
  x: number
  y: number
  r: number
  state: DotState
  rank: number | null
}
export type ClusterLabel = {
  id: string
  x: number
  y: number
  text: string
  count: number
  tone: 'sel' | 'hot' | 'dim' | 'in' | 'dead'
}
export type Tick = { x: number; text: string }
export type CloudLayout = {
  dots: Dot[]
  labels: ClusterLabel[]
  ticks: Tick[]
  baseline: number | null
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/** Dot spacing that keeps a small catalogue airy and a large one compact. */
export const spacingFor = (n: number, area = 1) =>
  Math.min(30, Math.max(9, (210 * Math.sqrt(area)) / Math.sqrt(Math.max(n, 1))))
const SPACING = 13

/** Stable 0..1 value from an id, for the outer ring and small jitters. */
export function hash01(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

/** Sunflower packing: index 0 at the centre, so the best-ranked item sits in the middle. */
const sunflower = (i: number, cx: number, cy: number, spacing = SPACING) => {
  const radius = spacing * 0.62 * Math.sqrt(i + 0.5)
  const angle = i * GOLDEN
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) * 0.92 }
}
const clusterRadius = (n: number, spacing = SPACING) =>
  spacing * 0.62 * Math.sqrt(Math.max(n, 1)) + 6

/** Eliminated items drift to a faint ring around the stage. */
const ring = (id: string) => {
  const a = hash01(id) * Math.PI * 2
  const wobble = 0.92 + hash01(`${id}~`) * 0.12
  return {
    x: VIEW.w / 2 + Math.cos(a) * VIEW.w * 0.48 * wobble,
    y: VIEW.h * 0.48 + Math.sin(a) * VIEW.h * 0.5 * wobble,
  }
}

const RADIUS: Record<DotState, number> = { out: 2.2, dim: 4.2, in: 5, sel: 5.6, hot: 6 }

type Common = {
  ids: string[]
  /** Items left by every answer except the current question's. */
  remaining: Set<string>
  /** Ranking order of the remaining items (best first). */
  order: Map<string, number>
}

/** Dots grow with the spacing so a small catalogue still reads as solid points. */
const dotScale = (spacing: number) => Math.min(1.9, Math.max(0.8, spacing / 14))

function place(
  common: Common,
  positioned: Map<string, { x: number; y: number; state: DotState }>,
  scale = 1,
): Dot[] {
  return common.ids.map((id) => {
    const p = positioned.get(id)
    const rank = common.order.get(id) ?? null
    if (!p) {
      const { x, y } = ring(id)
      return { id, x, y, r: RADIUS.out, state: 'out', rank: null }
    }
    const bump = rank != null && rank < 3 ? 1.6 : 0
    return { id, x: p.x, y: p.y, r: RADIUS[p.state] * scale + bump, state: p.state, rank }
  })
}

const byRank = (common: Common) => (a: string, b: string) =>
  (common.order.get(a) ?? 1e9) - (common.order.get(b) ?? 1e9) || a.localeCompare(b)

/** One packed disc per option, labelled with its live count. */
export function clusterLayout(
  common: Common & {
    groups: { id: string; text: string; count: number; members: (id: string) => boolean }[]
    selected: Set<string>
    hot: string | null
  },
): CloudLayout {
  const { groups, selected, hot } = common
  const members = new Map<string, string[]>(groups.map((g) => [g.id, []]))
  const leftover: string[] = []
  const sorted = [...common.remaining].sort(byRank(common))
  for (const id of sorted) {
    // An item that fits several options joins a picked one first, so picked clusters show everything they keep.
    const group =
      groups.find((g) => selected.has(g.id) && g.members(id)) ?? groups.find((g) => g.members(id))
    if (group) members.get(group.id)?.push(id)
    else leftover.push(id)
  }
  const visible = groups.filter((g) => (members.get(g.id)?.length ?? 0) > 0 || g.count === 0)
  const columns = Math.max(visible.length, 1)
  const largest = Math.max(1, ...visible.map((g) => members.get(g.id)?.length ?? 0))
  const spacing = Math.min(
    spacingFor(largest, 0.35),
    (VIEW.w * 0.74) / columns / (1.3 * Math.sqrt(largest) + 1),
  )
  const span = VIEW.w * (columns > 5 ? 0.74 : 0.6)
  const left = (VIEW.w - span) / 2
  const cy = VIEW.h * 0.44
  const positioned = new Map<string, { x: number; y: number; state: DotState }>()
  const labels: ClusterLabel[] = []
  const anySelected = selected.size > 0

  visible.forEach((group, i) => {
    const cx = columns === 1 ? VIEW.w / 2 : left + (span * i) / (columns - 1)
    const list = members.get(group.id) ?? []
    const isHot = hot === group.id
    const isSel = selected.has(group.id)
    const state: DotState = isHot ? 'hot' : isSel ? 'sel' : anySelected ? 'dim' : 'in'
    list.forEach((id, j) => {
      positioned.set(id, { ...sunflower(j, cx, cy, spacing), state })
    })
    labels.push({
      id: group.id,
      x: cx,
      // With many columns, every other label drops a line so neighbours never collide.
      y: cy + clusterRadius(largest, spacing) + 22 + (columns > 5 && i % 2 === 1 ? 34 : 0),
      text: group.text,
      count: group.count,
      tone: group.count === 0 ? 'dead' : isHot ? 'hot' : isSel ? 'sel' : anySelected ? 'dim' : 'in',
    })
  })
  // Items no option describes (a membrane board on the switch-feel screen) wait off to the side.
  leftover.forEach((id, j) => {
    positioned.set(id, { ...sunflower(j, VIEW.w * 0.93, VIEW.h * 0.12, 9), state: 'dim' })
  })
  return { dots: place(common, positioned, dotScale(spacing)), labels, ticks: [], baseline: null }
}

/** Everything left in one disc; `tone` decides which dots read as kept or hovered. */
export function fieldLayout(common: Common & { tone?: (id: string) => DotState }): CloudLayout {
  const positioned = new Map<string, { x: number; y: number; state: DotState }>()
  const sorted = [...common.remaining].sort(byRank(common))
  const spacing = spacingFor(sorted.length)
  sorted.forEach((id, j) => {
    positioned.set(id, {
      ...sunflower(j, VIEW.w / 2, VIEW.h * 0.42, spacing),
      state: common.tone?.(id) ?? 'in',
    })
  })
  return {
    dots: place(common, positioned, dotScale(spacing)),
    labels: [],
    ticks: [],
    baseline: null,
  }
}

/** A dot plot of prices: one column per price band, stacked upwards, the kept range in ink. */
export function histogramLayout(
  common: Common & {
    value: (id: string) => number
    bounds: [number, number]
    range: [number, number | null] | null
    format: (value: number) => string
  },
): CloudLayout {
  const [lo, hi] = common.bounds
  const bins = 40
  const left = VIEW.w * 0.12
  const width = VIEW.w * 0.76
  const baseline = VIEW.h * 0.6
  const step = 11
  const heights = new Array(bins).fill(0) as number[]
  const positioned = new Map<string, { x: number; y: number; state: DotState }>()
  for (const id of [...common.remaining].sort(byRank(common))) {
    const v = common.value(id)
    const bin = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)))
    const h = heights[bin] ?? 0
    heights[bin] = h + 1
    const kept =
      !common.range || (v >= common.range[0] && (common.range[1] == null || v <= common.range[1]))
    positioned.set(id, {
      x: left + (width * (bin + 0.5)) / bins,
      y: baseline - step / 2 - h * step,
      state: common.range ? (kept ? 'sel' : 'dim') : 'in',
    })
  }
  const ticks: Tick[] = Array.from({ length: 5 }, (_, i) => {
    const value = lo + ((hi - lo) * i) / 4
    return {
      x: left + (width * i) / 4,
      text: i === 4 ? `${common.format(value)}+` : common.format(value),
    }
  })
  return { dots: place(common, positioned), labels: [], ticks, baseline }
}
