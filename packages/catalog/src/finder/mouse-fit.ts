import type { grips } from '../domain/enums'
import type { MouseItem } from '../domain/items'
import { ANY, type Answers, type Recommendation } from './types'

// How well a mouse fits a hand: our own model, on the makers' measurements only (no third-party
// shape data). A hand size and a grip give a target length, the length of shell that suits that
// hand best; the shell's length is scored with a Gaussian around it, wider on the side where a
// mismatch matters less. The grip also reads the shell's proportions: a palm rests on a domed back,
// a claw on a lower one. Starting values come from shells whose fit is well known (DeathAdder V3,
// Viper V3, PRO X Superlight, X2 Mini, MX Master); they are refitted on the hand sizes and grips
// the makers themselves recommend (packages/catalog/scripts/audit-mice.ts).

type M = MouseItem
export type Grip = (typeof grips)[number]
export type HandSize = 's' | 'm' | 'l' | 'xl'
export type SizeBand = 'small' | 'medium' | 'large' | 'xl'

/** Hand length per answer, wrist crease to middle fingertip, in cm. */
export const HAND_RANGES: Record<HandSize, [number, number]> = {
  s: [15, 17],
  m: [17, 19],
  l: [19, 21],
  xl: [21, 23],
}

/** The target length of a claw grip: so many mm per cm of hand, from this length at none. */
const LENGTH = { perCm: 2.5, atZero: 76 }

type GripProfile = {
  /** How far the grip moves the target length, in mm. */
  offset: number
  /** How far below and above the target a length still suits (one sigma, mm). */
  under: number
  over: number
  /** Height over length, and width over length, the grip is most at ease with. */
  hl: number
  hlTol: number
  wl: number
  wlTol: number
  /** How each body suits the grip. */
  body: { symmetrical: number; ergonomic: number }
}

const GRIPS: Record<Grip, GripProfile> = {
  // The whole palm rests on the back: a longer, domed shell; too short gives no support.
  palm: {
    offset: 3,
    under: 5,
    over: 7,
    hl: 0.34,
    hlTol: 0.03,
    wl: 0.53,
    wlTol: 0.05,
    body: { symmetrical: 0.85, ergonomic: 1 },
  },
  // Arched fingers, the base of the palm on the back edge: a lower shell.
  claw: {
    offset: 0,
    under: 6,
    over: 6,
    hl: 0.32,
    hlTol: 0.025,
    wl: 0.5,
    wlTol: 0.05,
    body: { symmetrical: 1, ergonomic: 0.95 },
  },
  // Fingertips only: a shell too long is the real fault, a short one is fine.
  fingertip: {
    offset: -7,
    under: 10,
    over: 5,
    hl: 0.33,
    hlTol: 0.04,
    wl: 0.53,
    wlTol: 0.06,
    body: { symmetrical: 1, ergonomic: 0.8 },
  },
}

/** With no grip given: the middle way, wider either side. */
const NO_GRIP: GripProfile = {
  offset: 0,
  under: 7,
  over: 7,
  hl: 0.33,
  hlTol: 0.035,
  wl: 0.52,
  wlTol: 0.055,
  body: { symmetrical: 1, ergonomic: 1 },
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

export const handOf = (answers: Answers): HandSize | null => {
  const raw = answers.handsize
  return raw === 's' || raw === 'm' || raw === 'l' || raw === 'xl' ? raw : null
}

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
    offset: mid(a.offset, b.offset),
    under: Math.max(a.under, b.under),
    over: Math.max(a.over, b.over),
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
const gauss = (x: number, target: number, under: number, over: number) => {
  const z = (x - target) / (x < target ? under : over)
  return Math.exp(-0.5 * z * z)
}

/** The length of shell (on `sizeIndex`) that best suits a hand and a grip. */
export function targetLength(hand: HandSize, grip: GripProfile | null): number {
  const [lo, hi] = HAND_RANGES[hand]
  return LENGTH.atZero + LENGTH.perCm * ((lo + hi) / 2) + (grip ?? NO_GRIP).offset
}

/**
 * The target the shell is read against: the hand's, kept inside the size classes the visitor
 * picked (a big hand that wants a small mouse is not reproached for it).
 */
function targetFor(hand: HandSize, grip: GripProfile | null, answers: Answers): number {
  const target = targetLength(hand, grip)
  const bands = list(answers.size).filter((b): b is SizeBand => b in SIZE_BANDS)
  if (!bands.length) return target
  const clamped = bands.map((b) => {
    const [lo, hi] = SIZE_BANDS[b]
    return Math.min(Math.max(target, lo), hi)
  })
  return clamped.reduce((best, t) => (Math.abs(t - target) < Math.abs(best - target) ? t : best))
}

/** How well a maker's recommended hand range meets the answer's: 1 when they overlap. */
function rangeFit(hand: HandSize, m: M): number | null {
  const { makerHandMinCm: min, makerHandMaxCm: max } = m.specs
  if (min == null && max == null) return null
  const [lo, hi] = HAND_RANGES[hand]
  const gap = Math.max(0, lo - (max ?? Number.POSITIVE_INFINITY), (min ?? 0) - hi)
  return Math.exp(-0.5 * (gap / 1.2) ** 2)
}

/** How well the shell's size suits the hand (and grip), 0…1. Neutral until a hand size is given. */
export function handFit(m: M, answers: Answers): number {
  const hand = handOf(answers)
  if (!hand) return 1
  const maker = rangeFit(hand, m)
  if (m.specs.shape === 'trackball') return maker ?? 0.6
  const grip = m.specs.shape === 'vertical' ? GRIPS.palm : gripOf(answers)
  const profile = grip ?? NO_GRIP
  // A vertical shell is held one way; its length says less, so it is read more loosely.
  const loose = m.specs.shape === 'vertical' ? 2 : 1
  const target = targetFor(hand, grip, answers)
  const model = gauss(sizeIndex(m), target, profile.under * loose, profile.over * loose)
  return maker == null ? model : 0.7 * model + 0.3 * maker
}

/** Whether the shell is longer or shorter than the hand asks for. */
export function handMismatch(m: M, answers: Answers): 'small' | 'large' {
  const hand = handOf(answers)
  if (!hand) return 'large'
  return sizeIndex(m) < targetFor(hand, gripOf(answers), answers) ? 'small' : 'large'
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
  const hl = gauss(
    heightMm / lengthMm,
    grip.hl + (office ? OFFICE.hl : 0),
    grip.hlTol * spread,
    grip.hlTol * spread,
  )
  const wl = gauss(
    widthMm / lengthMm,
    grip.wl + (office ? OFFICE.wl : 0),
    grip.wlTol * spread,
    grip.wlTol * spread,
  )
  const body = grip.body[shape]
  const parts: [number, number][] = [
    [hl, 2.5],
    [wl, 0.5],
    [body, 1],
  ]
  const total = parts.reduce((sum, [, w]) => sum + w, 0)
  return Math.exp(parts.reduce((sum, [s, w]) => sum + w * Math.log(Math.max(s, 1e-6)), 0) / total)
}

/**
 * The size class to suggest for a hand and a grip: the one holding the target length, and the
 * neighbours within its tolerance. Nothing without a hand size.
 */
export function recommendSize(answers: Answers): Recommendation | null {
  const hand = handOf(answers)
  if (!hand) return null
  const grip = gripOf(answers)
  const profile = grip ?? NO_GRIP
  const target = targetLength(hand, grip)
  const holds = (b: SizeBand, at: number) => at >= SIZE_BANDS[b][0] && at < SIZE_BANDS[b][1]
  const primary = BAND_ORDER.find((b) => holds(b, target)) ?? 'medium'
  const also = BAND_ORDER.filter(
    (b) =>
      b !== primary &&
      SIZE_BANDS[b][0] < target + profile.over &&
      SIZE_BANDS[b][1] > target - profile.under,
  )
  return { primary, also }
}
