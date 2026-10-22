import type { KeyboardInput } from '@choose/catalog'

// Spec vocabularies shared by the sources: how a shop's words land on our enums.

type Specs = KeyboardInput['specs']
type Variant = KeyboardInput['variants'][number]

export const joined = (xs: (string | undefined)[]) => xs.filter(Boolean).join(' ; ')

export function familyOf(color: string): Variant['colorFamily'] {
  if (/transparent|clear|translucent|crystal/i.test(color)) return 'transparent'
  if (/black|carbon|graphite|space|dark|charcoal|midnight|onyx/i.test(color)) return 'black'
  if (/white|silver|ivory|light|cream|shell|snow|frost/i.test(color)) return 'white'
  if (/gr[ae]y/i.test(color)) return 'black'
  return 'color'
}

/** "1000 Hz", "8K", "8 kHz" → Hz. */
export function hzOf(s: string) {
  // "1,000Hz" and "8 000 Hz" are thousands, not decimals.
  const plain = s.replace(/(\d)[,\s](?=\d{3}\b)/g, '$1')
  const m = /(\d+(?:[.,]\d+)?)\s*(k)?\s*hz/i.exec(plain) ?? /\b(\d+)(k)\b/i.exec(plain)
  if (!m?.[1]) return undefined
  return Number(m[1].replace(',', '.')) * (m[2] ? 1000 : 1)
}

/** null: a layout the schema does not list (Swiss, Spanish…); undefined: none named. */
export function layoutIn(text: string): Variant['layout'] | null | undefined {
  // Layouts the schema does not list go first: a Belgian AZERTY is no French one, a Swiss QWERTZ
  // no German one.
  if (
    /\b(ES|CH|IT|PT|BE)\b|Swiss|Suisse|Spain|Spanish|Espagn|Ital|Portug|Belg|Tch[eè]que|Czech|Slova|Croat|Slov[eè]n|H[ée]breu|Hebrew|Ukrain|Hongr|Hungar|Grec|Greek|\bRuss|\bArab|\bTurc|\bTurk|\bPolon|\bPolish\b/.test(
      text,
    )
  ) {
    return null
  }
  if (/\bFR\b|AZERTY|French|Fran[cç]ais/.test(text)) return 'iso_fr'
  if (/\bDE\b|German|Deutsch|Allemand|QWERTZ/.test(text)) return 'iso_de'
  if (/\bUK\b|British|britannique|Royaume-Uni|United Kingdom/.test(text)) return 'iso_uk'
  if (/Nordic|Nordique|Danois|Norv[ée]gien|Su[ée]dois|Finnois|Scandinav/.test(text))
    return 'iso_nordic'
  if (/\bJIS\b|Japan|Japonais/.test(text)) return 'jis'
  if (
    /\bUS\b|\bNA\b|ANSI|North American|Am[ée]ricain|Anglais international|US International/.test(
      text,
    )
  ) {
    return 'ansi_us'
  }
  return undefined
}

export const MATERIAL: [RegExp, Specs['caseMaterial']][] = [
  [/alumin/i, 'aluminum'],
  [/wood|walnut/i, 'wood'],
  [/steel/i, 'steel'],
  [/\bPC\b|polycarbonate/i, 'polycarbonate'],
  [/ABS|plastic/i, 'plastic'],
]
export const PLATE: [RegExp, NonNullable<Specs['plateMaterial']>][] = [
  [/alumin/i, 'aluminum'],
  [/steel/i, 'steel'],
  [/brass/i, 'brass'],
  [/fr-?4/i, 'fr4'],
  [/\bPOM\b/i, 'pom'],
  [/\bPC\b|polycarbonate/i, 'polycarbonate'],
]
export const PROFILES: [RegExp, NonNullable<Specs['keycapProfile']>][] = [
  [/\bKSA\b/, 'ksa'],
  [/cherry/i, 'cherry'],
  [/\bOEM\b/, 'oem'],
  [/\bXDA\b/, 'xda'],
  [/\bMDA\b/, 'mda'],
  [/\bSA\b/, 'sa'],
  [/\bLSA\b|low[- ]profile/i, 'low'],
]
/** The table entry whose pattern appears earliest in the text. */
export function earliest<T>(text: string, table: [RegExp, T][]): T | undefined {
  let best: { at: number; value: T } | undefined
  for (const [re, value] of table) {
    const at = text.search(re)
    if (at >= 0 && (!best || at < best.at)) best = { at, value }
  }
  return best?.value
}
