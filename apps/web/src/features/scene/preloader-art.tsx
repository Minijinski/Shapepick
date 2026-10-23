import type { Category } from '@choose/catalog'
import { keyboardKeys } from '@choose/catalog/media'
import type { CSSProperties, ReactElement } from 'react'

// The drawings the preloader fills in, one per category, in the canvas's sketch style: units
// (keys, pixels, slices of a shell) that ink in one after the other as the scene gets ready, in
// their order in the markup, and an accent (`data-accent`: the Enter key, the power light, the
// wheel) that turns signal orange once everything is in. The first units ink in CSS before the
// page wakes up (`data-css`, each with its delay), the rest with the real progress (Preloader.tsx).
// The mouse is drawn already: it shows as soon as the site has mice to show.

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

// ---- Mouse: a symmetrical shell, seen from above, filling from the palm up to the buttons -------

const SHELL =
  'M11 1.2 C16.6 1.2 20.2 5.2 20.2 12.4 L20.2 22.6 C20.2 29 16.4 32.8 11 32.8 C5.6 32.8 1.8 29 1.8 22.6 L1.8 12.4 C1.8 5.2 5.4 1.2 11 1.2 Z'
const SLICES = 12
const SHELL_TOP = 1.2
const SHELL_BOTTOM = 32.8
const SLICE = (SHELL_BOTTOM - SHELL_TOP) / SLICES
const MOUSE_VIEW = { w: 22, h: 34 }

function MouseArt({ ink, className }: ArtProps) {
  return (
    <svg viewBox={`0 0 ${MOUSE_VIEW.w} ${MOUSE_VIEW.h}`} aria-hidden className={className}>
      <defs>
        <clipPath id="preloader-mouse-shell">
          <path d={SHELL} />
        </clipPath>
      </defs>
      <g clipPath="url(#preloader-mouse-shell)">
        {Array.from({ length: SLICES }, (_, i) => (
          <rect
            // Index keys: the slices are fixed, in their filling order (palm first).
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing
            key={i}
            data-unit={i}
            x={0}
            y={SHELL_BOTTOM - (i + 1) * SLICE + 0.14}
            width={MOUSE_VIEW.w}
            height={SLICE - 0.28}
            strokeWidth={0.08}
            {...inked(i, ink)}
          />
        ))}
      </g>
      <path d={SHELL} fill="none" stroke={OUTLINE} strokeWidth={0.12} />
      <path d="M11 1.3 L11 12.4" fill="none" stroke={OUTLINE} strokeWidth={0.1} />
      <path d="M1.9 12.6 Q11 14.6 20.1 12.6" fill="none" stroke={OUTLINE} strokeWidth={0.1} />
      <rect
        data-accent
        x={9.9}
        y={4.2}
        width={2.2}
        height={5}
        rx={1.1}
        fill={IDLE}
        stroke={OUTLINE}
        strokeWidth={0.08}
      />
    </svg>
  )
}

/** Each category's drawing, and how many units it inks in. */
export const preloaderArt: Record<
  Category | 'mouse',
  { Art: (props: ArtProps) => ReactElement; units: number }
> = {
  keyboard: { Art: KeyboardArt, units: BOARD.keys.length },
  monitor: { Art: MonitorArt, units: PIXELS.length },
  mouse: { Art: MouseArt, units: SLICES },
}
