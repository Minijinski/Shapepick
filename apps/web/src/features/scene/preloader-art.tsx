import type { Category } from '@choose/catalog'
import { keyboardKeys } from '@choose/catalog/media'
import type { CSSProperties, ReactElement } from 'react'

// The drawings the preloader fills in, one per category, in the canvas's sketch style: units
// (keys, pixels, the dots of a shell) that ink in one after the other as the scene gets ready, in
// their order in the markup, and an accent (`data-accent`: the Enter key, the power light, the
// logo) that turns signal orange once everything is in. The first units ink in CSS before the
// page wakes up (`data-css`, each with its delay), the rest with the real progress (Preloader.tsx).
// A unit marked `data-tone="signal"` inks in orange rather than ink (the mouse's buttons).

/** The units inked in CSS before the page wakes up: how many, one every `step` ms from `start`. */
export type CssInk = { units: number; step: number; start: number }

type ArtProps = { ink: CssInk; className?: string }

const OUTLINE = '#A8A399'
const IDLE = '#C9C5BB'

/** What the first `ink.units` units carry to ink in CSS, in turn. */
const inked = (i: number, ink: CssInk) =>
  i < ink.units
    ? ({
        'data-css': '',
        style: { animationDelay: `${Math.round(ink.start + i * ink.step)}ms` } as CSSProperties,
      } as const)
    : {}

// ---- Keyboard: a 75 % board whose keys ink in row by row ---------------------------------------

const BOARD = keyboardKeys('f75')
const BOARD_PAD = 0.45
const BOARD_VIEW = { w: BOARD.width + BOARD_PAD * 2, h: BOARD.height + BOARD_PAD * 2 }
const ENTER = BOARD.keys.findIndex((k) => k.accent && k.w >= 2)

function KeyboardArt({ ink, className }: ArtProps) {
  return (
    <svg viewBox={`0 0 ${BOARD_VIEW.w} ${BOARD_VIEW.h}`} aria-hidden className={className}>
      <rect
        x={0.03}
        y={0.03}
        width={BOARD_VIEW.w - 0.06}
        height={BOARD_VIEW.h - 0.06}
        rx={0.6}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={0.06}
        strokeDasharray="0.3 0.2"
      />
      {BOARD.keys.map((k, i) => (
        <rect
          key={`${k.x}-${k.y}`}
          data-unit={i}
          data-accent={i === ENTER ? '' : undefined}
          x={BOARD_PAD + k.x + 0.06}
          y={BOARD_PAD + k.y + 0.06}
          width={k.w - 0.12}
          height={0.88}
          rx={0.14}
          strokeWidth={0.04}
          {...inked(i, ink)}
        />
      ))}
    </svg>
  )
}

// ---- Monitor: a 16:9 screen whose pixels light up in a diagonal sweep ---------------------------

const COLS = 16
const ROWS = 9
const PIXEL = 1.825
const SCREEN = { x: 1.4, y: 1.4 }
const MONITOR_VIEW = { w: 32, h: 24.6 }
/** The pixels, top-left first, sweeping diagonally down to the bottom-right corner. */
const PIXELS = Array.from({ length: COLS * ROWS }, (_, i) => ({
  col: i % COLS,
  row: Math.floor(i / COLS),
})).sort((a, b) => a.col + a.row * 1.4 - (b.col + b.row * 1.4))

function MonitorArt({ ink, className }: ArtProps) {
  return (
    <svg viewBox={`0 0 ${MONITOR_VIEW.w} ${MONITOR_VIEW.h}`} aria-hidden className={className}>
      <rect
        x={0.4}
        y={0.4}
        width={31.2}
        height={18.4}
        rx={0.9}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={0.1}
      />
      {PIXELS.map((p, i) => (
        <rect
          key={`${p.col}-${p.row}`}
          data-unit={i}
          x={SCREEN.x + p.col * PIXEL + 0.09}
          y={SCREEN.y + p.row * PIXEL + 0.09}
          width={PIXEL - 0.18}
          height={PIXEL - 0.18}
          rx={0.14}
          strokeWidth={0.05}
          {...inked(i, ink)}
        />
      ))}
      <circle data-accent cx={16} cy={18.32} r={0.3} fill={IDLE} stroke="none" />
      <path
        d="M14.5 18.8 L14.1 22.6 L17.9 22.6 L17.5 18.8"
        fill="none"
        stroke={OUTLINE}
        strokeWidth={0.1}
        strokeLinejoin="round"
      />
      <rect
        x={10.5}
        y={22.6}
        width={11}
        height={1.5}
        rx={0.75}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={0.1}
      />
    </svg>
  )
}

// ---- Mouse: a shell seen from above, its dots inking in a ripple from the palm ----------------

// A symmetrical gaming mouse, modelled on a PRO X2 SUPERSTRIKE: the palm behind, the two buttons
// in front, split by a seam, and the wheel between them.
const SHELL =
  'M30 3C42 3 50 8 52 18C53 28 51 34 51 42C51 52 55 58 55 68C55 90 44 101 30 101C16 101 5 90 5 68C5 58 9 52 9 42C9 34 7 28 8 18C10 8 18 3 30 3Z'
const PALM =
  'M9 42Q19.5 46 30 46Q40.5 46 51 42C51 52 55 58 55 68C55 90 44 101 30 101C16 101 5 90 5 68C5 58 9 52 9 42Z'
const SEAMS = 'M9 42Q30 50 51 42M30 3V12M30 27V46'
const WHEEL = { x: 27.2, y: 12, w: 5.6, h: 15 }
/** The logo on the palm, which lights up once everything is in. */
const LOGO = { x: 30, y: 80, r: 2.8, hole: 1.5 }
const MOUSE_VIEW = { w: 60, h: 104 }
/** The dots' grid: how far apart they are, and how big. */
const DOT_STEP = 4.6
const DOT_R = 1.5

type Pt = [number, number]

/** A point along a Bézier curve, one axis at a time: quadratic with three values, cubic with four. */
const along = (t: number, [a, b, c, d]: number[]) => {
  const u = 1 - t
  return d == null
    ? u * u * (a ?? 0) + 2 * u * t * (b ?? 0) + t * t * (c ?? 0)
    : u * u * u * (a ?? 0) + 3 * u * u * t * (b ?? 0) + 3 * u * t * t * (c ?? 0) + t * t * t * d
}

/** One of our paths (M, C and Q, absolute, one segment per command), as a polygon to test. */
function polygonOf(d: string): Pt[] {
  const tokens = d.match(/[MCQZ]|-?\d*\.?\d+/g) ?? []
  const points: Pt[] = []
  let i = 0
  let at: Pt = [0, 0]
  const pt = (): Pt => [Number(tokens[i++]), Number(tokens[i++])]
  while (i < tokens.length) {
    const command = tokens[i++]
    if (command === 'M') {
      at = pt()
      points.push(at)
    } else if (command === 'C' || command === 'Q') {
      const curve = [at, ...(command === 'C' ? [pt(), pt(), pt()] : [pt(), pt()])]
      const xs = curve.map((p) => p[0])
      const ys = curve.map((p) => p[1])
      for (let k = 1; k <= 8; k++) points.push([along(k / 8, xs), along(k / 8, ys)])
      at = curve[curve.length - 1] as Pt
    }
  }
  return points
}

/** Whether a point is inside a polygon (even-odd). */
function inside(polygon: Pt[], x: number, y: number) {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i] as Pt
    const [xj, yj] = polygon[j] as Pt
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

const round = (v: number) => Math.round(v * 100) / 100

/**
 * The dots, a staggered grid over the shell, nearest the logo first: the ink spreads out from the
 * palm and reaches the buttons, whose dots ink in orange, last. Pure geometry: the preloader is in
 * the server's HTML.
 */
const DOTS = (() => {
  const shell = polygonOf(SHELL)
  const palm = polygonOf(PALM)
  const rise = DOT_STEP * Math.sin(Math.PI / 3)
  const dots: { x: number; y: number; button: boolean; from: number }[] = []
  for (let row = 0; 3 + DOT_STEP / 2 + row * rise < 101; row++) {
    const y = 3 + DOT_STEP / 2 + row * rise
    for (let x = 5 + (row % 2 ? DOT_STEP / 2 : 0); x < 56; x += DOT_STEP) {
      if (!inside(shell, x, y)) continue
      // Room around the logo and under the wheel, so both read clearly.
      const from = Math.hypot(x - LOGO.x, y - LOGO.y)
      if (from < LOGO.r + 1.2) continue
      const underWheel =
        x > WHEEL.x - 1 && x < WHEEL.x + WHEEL.w + 1 && y > WHEEL.y - 1 && y < WHEEL.y + WHEEL.h + 1
      if (underWheel) continue
      dots.push({ x: round(x), y: round(y), button: !inside(palm, x, y), from })
    }
  }
  return dots.sort((a, b) => a.from - b.from)
})()

/** The logo: a ring, drawn as a filled shape (a lit accent is filled orange). */
const ring = (r: number) =>
  `M${LOGO.x - r} ${LOGO.y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`

function MouseArt({ ink, className }: ArtProps) {
  return (
    <svg viewBox={`0 0 ${MOUSE_VIEW.w} ${MOUSE_VIEW.h}`} aria-hidden className={className}>
      {DOTS.map((dot, i) => (
        <circle
          key={`${dot.x}-${dot.y}`}
          data-unit={i}
          data-tone={dot.button ? 'signal' : undefined}
          cx={dot.x}
          cy={dot.y}
          r={DOT_R}
          strokeWidth={0.22}
          {...inked(i, ink)}
        />
      ))}
      <path d={SHELL} fill="none" stroke={OUTLINE} strokeWidth={0.5} />
      <path d={SEAMS} fill="none" stroke={OUTLINE} strokeWidth={0.4} strokeLinecap="round" />
      <rect
        data-unit={DOTS.length}
        x={WHEEL.x}
        y={WHEEL.y}
        width={WHEEL.w}
        height={WHEEL.h}
        rx={WHEEL.w / 2}
        strokeWidth={0.4}
        {...inked(DOTS.length, ink)}
      />
      <path
        data-accent
        d={`${ring(LOGO.r)}${ring(LOGO.hole)}`}
        fillRule="evenodd"
        fill={IDLE}
        stroke="none"
        strokeWidth={0.05}
      />
    </svg>
  )
}

/** Each category's drawing, and how many units it inks in. */
export const preloaderArt: Record<
  Category,
  { Art: (props: ArtProps) => ReactElement; units: number }
> = {
  keyboard: { Art: KeyboardArt, units: BOARD.keys.length },
  monitor: { Art: MonitorArt, units: PIXELS.length },
  mouse: { Art: MouseArt, units: DOTS.length + 1 },
}
