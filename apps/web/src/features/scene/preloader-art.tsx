import type { Category } from '@choose/catalog'
import { keyboardKeys } from '@choose/catalog/media'
import type { CSSProperties, ReactElement } from 'react'

// The drawings the preloader fills in, one per category, in the canvas's sketch style: units
// (keys, pixels, the rings of a shell) that ink in one after the other as the scene gets ready, in
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

// ---- Mouse: a shell seen from above, its palm inking in ring by ring, then its buttons -------

// A symmetrical gaming mouse, modelled on a PRO X2 SUPERSTRIKE: the palm behind, the two buttons
// in front, split by a seam, and the wheel between them.
const SHELL =
  'M30 3C42 3 50 8 52 18C53 28 51 34 51 42C51 52 55 58 55 68C55 90 44 101 30 101C16 101 5 90 5 68C5 58 9 52 9 42C9 34 7 28 8 18C10 8 18 3 30 3Z'
const PALM =
  'M9 42Q19.5 46 30 46Q40.5 46 51 42C51 52 55 58 55 68C55 90 44 101 30 101C16 101 5 90 5 68C5 58 9 52 9 42Z'
const LEFT_BUTTON = 'M30 3C18 3 10 8 8 18C7 28 9 34 9 42Q19.5 46 30 46Z'
const RIGHT_BUTTON = 'M30 3C42 3 50 8 52 18C53 28 51 34 51 42Q40.5 46 30 46Z'
const SEAMS = 'M9 42Q30 50 51 42M30 3V12M30 27V46'
const WHEEL = { x: 27.2, y: 12, w: 5.6, h: 15 }
/** The logo on the palm, which lights up once everything is in. */
const LOGO = { x: 30, y: 80, r: 2.8, hole: 1.5 }
const MOUSE_VIEW = { w: 60, h: 104 }
/** The palm's rings, from its edge in, and the point they close in on. */
const RINGS = 12
const RING_CENTRE = { x: 30, y: 72 }

/** One of our paths (absolute commands, coordinate pairs only), scaled about the rings' centre. */
const shrunk = (d: string, by: number) => {
  let i = 0
  return d.replace(/-?\d*\.?\d+/g, (n) => {
    const centre = i++ % 2 ? RING_CENTRE.y : RING_CENTRE.x
    return String(Math.round((centre + (Number(n) - centre) * by) * 100) / 100)
  })
}

/**
 * The palm, cut into rings that follow its outline, outermost first: it fills from its edge in,
 * the way a shell takes shape, the last ring closing on the middle.
 */
const PALM_RINGS = Array.from({ length: RINGS }, (_, k) => {
  const outer = shrunk(PALM, 1 - (k / RINGS) * 0.96)
  return k < RINGS - 1 ? `${outer}${shrunk(PALM, 1 - ((k + 1) / RINGS) * 0.96)}` : outer
})

/** The logo: a ring, drawn as a filled shape (a lit accent is filled orange). */
const ring = (r: number) =>
  `M${LOGO.x - r} ${LOGO.y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`

/** The palm's rings, then the two buttons (in orange), then the wheel. */
const MOUSE_UNITS = PALM_RINGS.length + 3

function MouseArt({ ink, className }: ArtProps) {
  const after = PALM_RINGS.length
  return (
    <svg viewBox={`0 0 ${MOUSE_VIEW.w} ${MOUSE_VIEW.h}`} aria-hidden className={className}>
      {PALM_RINGS.map((d, i) => (
        <path
          // Index keys: the rings are fixed, in their filling order (outermost first).
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing
          key={i}
          data-unit={i}
          d={d}
          fillRule="evenodd"
          strokeWidth={0.25}
          {...inked(i, ink)}
        />
      ))}
      {[LEFT_BUTTON, RIGHT_BUTTON].map((d, i) => (
        <path
          key={d}
          data-unit={after + i}
          data-tone="signal"
          d={d}
          strokeWidth={0.4}
          {...inked(after + i, ink)}
        />
      ))}
      <path d={SHELL} fill="none" stroke={OUTLINE} strokeWidth={0.5} />
      <path d={SEAMS} fill="none" stroke={OUTLINE} strokeWidth={0.4} strokeLinecap="round" />
      <rect
        data-unit={after + 2}
        x={WHEEL.x}
        y={WHEEL.y}
        width={WHEEL.w}
        height={WHEEL.h}
        rx={WHEEL.w / 2}
        strokeWidth={0.4}
        {...inked(after + 2, ink)}
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
  mouse: { Art: MouseArt, units: MOUSE_UNITS },
}
