import type { grips } from '../domain/enums'
import type { MouseItem } from '../domain/items'
import { ANY, type Answers } from './types'

// How well a mouse suits a grip: our own model, on the makers' measurements only (no third-party
// shape data). A palm rests on a domed back, a claw on a lower one, fingertips on a short light
// shell: the grip reads the shell's proportions and its body. Starting values come from shells
// whose fit is well known (DeathAdder V3, Viper V3, PRO X Superlight, X2 Mini, MX Master). The
// size classes the size question offers are read on the shell's length, here too.

type M = MouseItem
export type Grip = (typeof grips)[number]
export type SizeBand = 'small' | 'medium' | 'large' | 'xl'

type GripProfile = {
  /** Height over length, and width over length, the grip is most at ease with. */
  hl: number
  hlTol: number
  wl: number
  wlTol: number
  /** How each body suits the grip. */
  body: { symmetrical: number; ergonomic: number }
}

const GRIPS: Record<Grip, GripProfile> = {
  // The whole palm rests on the back: a domed shell.
  palm: { hl: 0.34, hlTol: 0.03, wl: 0.53, wlTol: 0.05, body: { symmetrical: 0.85, ergonomic: 1 } },
  // Arched fingers, the base of the palm on the back edge: a lower shell.
  claw: { hl: 0.32, hlTol: 0.025, wl: 0.5, wlTol: 0.05, body: { symmetrical: 1, ergonomic: 0.95 } },
  // Fingertips only: the shell's proportions matter less, an ergonomic body gets in the way.
  fingertip: {
    hl: 0.33,
    hlTol: 0.04,
    wl: 0.53,
    wlTol: 0.06,
    body: { symmetrical: 1, ergonomic: 0.8 },
  },
}

/** Office shells are taller and wider for their length, and far more varied than gaming ones. */
const OFFICE = { hl: 0.04, wl: 0.08, spread: 2 }

/** Where the size classes start, read on `sizeIndex` (mm). */
export const SIZE_BANDS: Record<SizeBand, [number, number]> = {
  small: [0, 119],
  medium: [119, 126],
  large: [126, 130],
  xl: [130, Number.POSITIVE_INFINITY],
}
const BAND_ORDER: SizeBand[] = ['small', 'medium', 'large', 'xl']

/**
 * Where a shell sits on the size scale, in mm of length: a very wide shell (an office mouse built
 * for the whole palm, over 75 mm across) counts a little longer than it is.
 */
export const sizeIndex = (m: M) =>
  (m.specs.lengthMm ?? 0) + Math.max(0, (m.specs.widthMm ?? 0) - 75) * 0.5

export const sizeBandOf = (m: M): SizeBand | null => {
  if (m.specs.shape === 'trackball' || m.specs.lengthMm == null) return null
  const at = sizeIndex(m)
  return BAND_ORDER.find((b) => at >= SIZE_BANDS[b][0] && at < SIZE_BANDS[b][1]) ?? null
}

const list = (raw: string | undefined) => (raw && raw !== ANY ? raw.split(',') : [])

/**
 * The grip the answers describe: one grip, or the way between two neighbouring ones (palm and claw
 * for a relaxed claw). Grips far apart, or all three, say nothing about the shell: null.
 */
export function gripOf(answers: Answers): GripProfile | null {
  const picked = (['palm', 'claw', 'fingertip'] as const).filter((g) =>
    list(answers.grip).includes(g),
  )
  if (picked.length === 1) return GRIPS[picked[0] as Grip]
  if (picked.length !== 2 || !picked.includes('claw')) return null
  const [a, b] = picked.map((g) => GRIPS[g])
  if (!a || !b) return null
  const mid = (x: number, y: number) => (x + y) / 2
  return {
    hl: mid(a.hl, b.hl),
    hlTol: Math.max(a.hlTol, b.hlTol),
    wl: mid(a.wl, b.wl),
    wlTol: Math.max(a.wlTol, b.wlTol),
    body: {
      symmetrical: mid(a.body.symmetrical, b.body.symmetrical),
      ergonomic: mid(a.body.ergonomic, b.body.ergonomic),
    },
  }
}

/** 1 at the target, about 0.6 one tolerance away, 0.14 at two. */
const gauss = (x: number, target: number, tolerance: number) => {
  const z = (x - target) / tolerance
  return Math.exp(-0.5 * z * z)
}

/** How well the shell's proportions and body suit the grip, 0…1. Neutral without a grip. */
export function gripFit(m: M, answers: Answers): number {
  const grip = gripOf(answers)
  const { shape, lengthMm, widthMm, heightMm, segment } = m.specs
  if (!grip) return 1
  // A vertical shell or a trackball is not held by grip: neither rewarded nor ruled out.
  if (shape === 'vertical' || shape === 'trackball' || !lengthMm || !widthMm || !heightMm)
    return 0.85
  const office = segment === 'office'
  const spread = office ? OFFICE.spread : 1
  const hl = gauss(heightMm / lengthMm, grip.hl + (office ? OFFICE.hl : 0), grip.hlTol * spread)
  const wl = gauss(widthMm / lengthMm, grip.wl + (office ? OFFICE.wl : 0), grip.wlTol * spread)
  const body = grip.body[shape]
  const parts: [number, number][] = [
    [hl, 2.5],
    [wl, 0.5],
    [body, 1],
  ]
  const total = parts.reduce((sum, [, w]) => sum + w, 0)
  return Math.exp(parts.reduce((sum, [s, w]) => sum + w * Math.log(Math.max(s, 1e-6)), 0) / total)
}
