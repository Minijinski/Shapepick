import type { MouseRecord } from '@choose/catalog'
import { type Facts, labelKey, num } from './facts'
import { hzOf } from './mapping'
import { clean } from './monitor-specs'
import { Skip } from './source'
import { plainNumber } from './sources/official'

// Mouse spec sheets → our schema. Each official site words its sheet its own way: one label with
// three figures in an order of its own ("L x l x H", "HxWxD") or three labels, and Logitech's
// office pages call the length "Hauteur"; a weight in grams, kilograms or pounds; a battery life in
// hours, days or months. An adapter hands its sheet over as label/value pairs, renaming a label
// its site uses in another sense, plus the page's text for what the sheet leaves to the marketing
// copy (a free-spin wheel, silent clicks). A flag is set only on positive evidence; the few
// readings that assume something leave a note for the review.

type Specs = MouseRecord['specs']
type Shape = Specs['shape']
type Hand = Specs['hand']
type Grip = NonNullable<Specs['makerGrips']>[number]

/** What the adapter knows better than the sheet: the line it listed the mouse in, its shape. */
export type MouseHints = {
  name: string
  text: string
  segment?: Specs['segment']
  shape?: Shape
  hand?: Hand
}

/** Labels compared like Facts does: lowercased, accents and punctuation dropped. */
const LABEL = {
  length: /^(longueur|length|long|profondeur|depth)\w*$/,
  width: /^(largeur|width)\w*$/,
  height: /^(hauteur|height|epaisseur|thickness)\w*$/,
  dims: /^(dimensions?|tailleapproximative|size|productdimensions|dimensionsduproduit|dimensionsdelasouris|mousedimensions|(mice|mouse)productdimension|taille)\w*$/,
  weight: /^(poids|weight|masse|productweight|mouseweight)\w*$/,
  sensor: /^(capteur|sensor|typedecapteur|sensortype|technologieducapteur)$/,
  dpi: /^(resolution\w*|\w*dpi\w*|cpi\w*|ppp\w*|sensibilite\w*|maxsensitivity|sensitivity)$/,
  polling:
    /^(tauxderapport\w*|tauxdinterrogation\w*|frequencedinterrogation\w*|\w*pollingrate\w*|\w*reportrate\w*|frequencedechantillonnage\w*|frequencedesondage\w*)$/,
  buttons:
    /^(boutons\w*|nombredeboutons\w*|buttons?|numberofbuttons|programmablebuttons|boutonsprogrammables|commandesprogrammables|nombredecommandes\w*)$/,
  switches:
    /^(typedecommutateur\w*|commutateurs?\w*|switchtype|switches|typedeswitch\w*|typedinterrupteur\w*|interrupteurs?\w*|boutonsprincipaux|mainbuttons?|\w*buttonswitch\w*)$/,
  battery:
    /^(autonomie\w*|batterylife|dureedevie\w*batterie|longevite\w*|typedepile|typedebatterie|batterytype|pile|piles|batterie|battery|alimentation|powersource|details\w*(pile|piles|batterie))$/,
  connection:
    /^(connectivite\w*|connexion\w*|connectivity|connectiontype|typedeconnexion|technologiesansfil|wirelesstechnology|interface|cable|cablage)$/,
  hosts: /^(easyswitch|multiappareils|multidevice|nombredappareils|appareilsconnectables)$/,
  form: /^(forme|formfactor|facteurdeforme|design|shape|ergonomie)$/,
  grip: /^(styledeprise|styledepriseenmain|priseenmain|grip|griptype|typedeprise|typedepriseenmain|gripstyle)$/,
  hand: /^(handsize|tailledemain|tailledelamain|mainsrecommandees)$/,
  tilt: /^(\w*(molette|roulette|defilement)multidirectionnel\w*|molette\w*inclinable|molettedinclinaison|tiltscrollwheel|tiltwheel|defilementlateral)$/,
  rgb: /^(eclairage\w*|lighting|rgb|chromargb|retroeclairage)$/,
  dock: /^(compatibiliteaveclesaccessoires|dockcompatibility|chargingdock|rechargesansfil|wirelesscharging)$/,
}

/** "Non", "No", "S/O", "N/A", "—": the sheet says the mouse has none ("Virtuel": a software one). */
const NEGATIVE = /^(?:non|no|none|aucun\w*|sans|s\/o|n\/a|na|false|virtuel|virtual)\b|^[-–—]$|^0$/i

const n = (s: string | undefined) => num(s && plainNumber(s))

type Entry = { key: string; label: string; value: string }

function entries(facts: Facts, label: RegExp): Entry[] {
  return facts.list
    .map((f) => ({ key: labelKey(f.label), label: f.label, value: clean(f.value) }))
    .filter((e) => label.test(e.key))
}

const firstValue = (facts: Facts, label: RegExp) => entries(facts, label)[0]?.value
const said = (value: string | undefined) => !!value && !NEGATIVE.test(value)

/** Every millimetre figure of a value ("128,0 mm / 5,00 po", "125 x 63.5 x 40 mm"). */
function millimetres(value: string): number[] {
  const out: number[] = []
  const plain = value.replace(/(\d),(\d)/g, '$1.$2')
  // Inches given beside the millimetres are dropped: only figures in mm (or with no unit) count.
  for (const m of plain.matchAll(/(\d{2,3}(?:\.\d+)?)\s*(mm|cm|po|in|"|pouces?)?/gi)) {
    const unit = (m[2] ?? '').toLowerCase()
    const v = Number(m[1])
    if (unit === 'cm') out.push(v * 10)
    else if (!unit || unit === 'mm') out.push(v)
  }
  return out
}

/** The largest figure of a value given "front / back" ("62,8 mm (avant), 68,2 mm (arrière)"). */
const largest = (value: string) => {
  const all = millimetres(value)
  return all.length ? Math.max(...all) : undefined
}

type Dims = { lengthMm?: number; widthMm?: number; heightMm?: number }

/**
 * The three measurements: from their own labels, else from one label holding all three, read in
 * the order its label or value names ("L x l x H", "HxWxD"), else sorted: the length is always
 * the largest; a flat shell is wider than tall, a vertical one taller than wide.
 */
function dimsOf(facts: Facts, shape: Shape, notes: string[]): Dims {
  const own: Dims = {
    lengthMm: largest(firstValue(facts, LABEL.length) ?? ''),
    widthMm: largest(firstValue(facts, LABEL.width) ?? ''),
    heightMm: largest(firstValue(facts, LABEL.height) ?? ''),
  }
  if (own.lengthMm && own.widthMm && own.heightMm) return sane(own, shape, notes)
  for (const e of entries(facts, LABEL.dims)) {
    // "Longueur: 128 mm ; Largeur: 68 mm ; Hauteur: 44 mm" (Razer): named parts first.
    const part = (word: RegExp) => {
      const m = new RegExp(`${word.source}\\s*:?\\s*([\\d.,]+\\s*(?:mm|cm)?)`, 'i').exec(e.value)
      return m?.[1] ? largest(m[1]) : undefined
    }
    const named: Dims = {
      lengthMm: part(/(?:longueur|length|profondeur|depth)/),
      widthMm: part(/(?:largeur|width)/),
      heightMm: part(/(?:hauteur|height|épaisseur)/),
    }
    if (named.lengthMm && named.widthMm && named.heightMm) return sane(named, shape, notes)
    const figures = millimetres(e.value)
    if (figures.length < 3) continue
    const [a, b, c] = figures as [number, number, number]
    const order = `${e.label} ${e.value}`.replace(/\s/g, '').toLowerCase()
    if (/h[x×*]w[x×*]d|h[x×*]l[x×*]p/.test(order))
      return sane({ heightMm: a, widthMm: b, lengthMm: c }, shape, notes)
    if (
      /l[x×*]w[x×*]h|l[x×*]l[x×*]h|longueur[x×*]largeur[x×*]hauteur|length[x×*]width[x×*]height/.test(
        order,
      )
    )
      return sane({ lengthMm: a, widthMm: b, heightMm: c }, shape, notes)
    if (/w[x×*]d[x×*]h|l[x×*]p[x×*]h/.test(order))
      return sane({ widthMm: a, lengthMm: b, heightMm: c }, shape, notes)
    notes.push(`dimensions sans ordre (${e.value}) : la plus grande prise pour la longueur`)
    return sorted([a, b, c], shape)
  }
  return own
}

function sorted(figures: number[], shape: Shape): Dims {
  const [l, mid, small] = [...figures].sort((x, y) => y - x) as [number, number, number]
  return shape === 'vertical'
    ? { lengthMm: l, heightMm: mid, widthMm: small }
    : { lengthMm: l, widthMm: mid, heightMm: small }
}

/** Measurements whose labels contradict the shape (a length shorter than the width) are re-sorted. */
function sane(d: Dims, shape: Shape, notes: string[]): Dims {
  const { lengthMm: l, widthMm: w, heightMm: h } = d
  if (!l || !w || !h) return d
  const fine = l >= w && l >= h && (shape === 'vertical' ? h >= w * 0.8 : w >= h)
  if (fine) return d
  notes.push(`mesures dans un ordre inattendu (${l} × ${w} × ${h} mm) : rangées par taille`)
  return sorted([l, w, h], shape)
}

/** The mouse alone, in grams: kilograms (Corsair writes "0.06") and pounds converted. */
function weightOf(facts: Facts, notes: string[]): number | undefined {
  // A mouse that runs on batteries weighs with them ("Poids avec une pile AA : 86 g").
  const all = entries(facts, LABEL.weight)
  const withBattery = all.filter((e) => /pile|batter|\baa\b/i.test(`${e.label} ${e.value}`))
  for (const e of [...withBattery, ...all]) {
    // "126 ± 10 g", "56g±2g": the tolerance is no weight; "±44g" is about 44 g.
    const v = e.value
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/(\d\s*g?)\s*±\s*\d+(?:\.\d+)?\s*g?\b/g, '$1')
      .replace(/±\s*(?=\d)/g, '')
    const g = /(\d+(?:\.\d+)?)\s*g\b/i.exec(v)
    if (g) return Number(g[1])
    const kg = /(\d+(?:\.\d+)?)\s*kg\b/i.exec(v)
    if (kg) return Math.round(Number(kg[1]) * 1000)
    const lb = /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/i.exec(v)
    if (lb) {
      notes.push(`poids en livres (${e.value}) converti en grammes`)
      return Math.round(Number(lb[1]) * 453.6)
    }
    const bare = n(v)
    if (bare != null) return bare < 2 ? Math.round(bare * 1000) : bare
  }
  return undefined
}

/** The highest report rate the mouse reaches with what comes in the box. */
function pollingOf(facts: Facts, notes: string[]): number | undefined {
  const rates: number[] = []
  for (const e of entries(facts, LABEL.polling)) {
    for (const part of e.value.split(/;|\/|\bou\b|\bor\b|,(?!\d)/)) {
      const hz = hzOf(/hz|\dk\b/i.test(part) ? part : `${part} Hz`)
      if (!hz || hz < 100 || hz > 16000) continue
      // A rate reached with a dongle sold apart, or by over-polling, is not the mouse's own.
      if (/s[ée]par[ée]ment|separately|en option|optional|vendu|over-?polling/i.test(part)) {
        notes.push(`${hz} Hz seulement en option : non compté`)
        continue
      }
      rates.push(hz)
    }
  }
  return rates.length ? Math.max(...rates) : undefined
}

function dpiOf(facts: Facts): number | undefined {
  const values: number[] = []
  for (const e of entries(facts, LABEL.dpi)) {
    // Display resolutions are not DPI: a mouse sheet's "Résolution" is its sensor's.
    if (/\d{3,4}\s*[x×]\s*\d{3,4}/.test(e.value)) continue
    for (const m of plainNumber(e.value).matchAll(/(\d+(?:[.,]\d+)?)\s*(k)?/gi)) {
      const v = Number((m[1] ?? '').replace(',', '.')) * (m[2] ? 1000 : 1)
      if (v >= 400 && v <= 100000) values.push(v)
    }
  }
  return values.length ? Math.max(...values) : undefined
}

/** The sensor's name ("HERO 2", "Focus Pro 30K"), not its kind ("Optique"). */
function sensorOf(facts: Facts): string | undefined {
  const named = entries(facts, LABEL.sensor).find(
    (e) => !/^(optique|optical|laser)$/i.test(e.value),
  )
  return named?.value.replace(/^capteur\s+(optique\s+)?/i, '').slice(0, 60)
}

function switchOf(text: string): Specs['switchType'] {
  if (/hybride?|lightforce/i.test(text)) return 'hybrid'
  if (/magn[ée]tique|magnetic|hall|\bhe\b/i.test(text)) return 'magnetic'
  if (/optique|optical/i.test(text)) return 'optical'
  if (/m[ée]canique|mechanical|omron|huano|kailh|ttc/i.test(text)) return 'mechanical'
  return undefined
}

/** Battery life as copy words it, the figure then its unit, the 2.4 GHz link's first. */
const COPY_BATTERY = [
  /(\d+)\s*(h|hrs?|hours?)\s+(?:at|on|@)\s+(?:a\s+)?(?:1\s*k(?:hz)?|1[\s ]?000\s*hz)\b/i,
  /autonomie[^.;\n\d]{0,40}?(\d+)\s*(heures?|h|jours?|mois)\b/i,
  /(\d+)\s*(heures?|jours?|mois)\s+(?:d'autonomie|avec une (?:seule )?charge)/i,
  /(\d+)\s*(h|hrs?|hours?)\s*\(?\s*(?:on |at |with )?2[.,]4\s*ghz/i,
  /(\d+)\s*(hours?|hrs?|days?|months?)\s+(?:of\s+)?(?:continuous\s+)?(?:battery|playtime|play time)/i,
]

/** Battery life in hours, the power source, from "90 heures à 1 000 Hz", "70 jours", "24 mois". */
function powerOf(facts: Facts, text: string, notes: string[]) {
  const battery = entries(facts, LABEL.battery)
  const lines = battery.map((e) => `${e.label}: ${e.value}`)
  const all = [...lines, text].join('\n')
  // Logitech heads every battery line "Longévité de la pile", rechargeable or not: what the lines
  // say counts, not their labels.
  const power: Specs['power'] = /\baaa\b/i.test(all)
    ? 'aaa'
    : /\b(piles?|aa|batteries? aa|alkaline|alcalines?)\b/i.test(
          battery.map((e) => e.value).join(' '),
        ) || /piles? aa\b/i.test(all)
      ? 'aa'
      : /rechargeable|li-?(ion|po)|lithium|batterie interne|charge (usb|rapide|compl[eè]te)|recharg|chargement|charging|on a (single |full )?charge/i.test(
            all,
          )
        ? 'rechargeable'
        : undefined
  let batteryHours: number | undefined
  // A sheet may give several figures ("90 heures à 1 000 Hz ; 17 heures à 8 000 Hz", "120 jours avec
  // une charge ; 1 minute de charge pour 24 heures"): the 1 000 Hz one, else the first one, never
  // what a quick charge gives.
  const segments = lines
    .flatMap((line) => line.replace(/(\d)[\s ](\d{3})/g, '$1$2').split(/;|\|/))
    .filter(
      (part) => !/minutes? de charge|charge rapide|quick charge|minutes? of charg/i.test(part),
    )
  // The comparable figure: at 1 000 Hz, lighting off ("130 h sans éclairage, 37 h avec"), on the
  // 2.4 GHz link rather than Bluetooth, whose figure is usually the longest.
  const first = (part: string) =>
    /\b1000\s*hz|\b1\s*khz|\b1k\b/i.test(part)
      ? 0
      : /sans [ée]clairage|no lighting|lighting off|[ée]clairage d[ée]sactiv/i.test(part)
        ? 1
        : /bluetooth/i.test(part)
          ? 3
          : 2
  const ordered = [...segments].sort((a, b) => first(a) - first(b))
  const UNITS: [RegExp, number, string?][] = [
    [/(\d+(?:[.,]\d+)?)\+?\s*(?:h|heures?|hours?|hrs?)\b/i, 1],
    [/(\d+)\+?\s*(?:jours?|days?)\b/i, 8, 'jours'],
    [/(\d+)\+?\s*(?:mois|months?)\b/i, 30 * 8],
  ]
  let chosen = ''
  for (const part of ordered) {
    const found = UNITS.map(([re, perUnit, unit]) => ({ m: re.exec(part), perUnit, unit }))
      .filter((f) => f.m?.[1])
      .sort((a, b) => (a.m?.index ?? 0) - (b.m?.index ?? 0))[0]
    if (!found?.m?.[1]) continue
    const value = Number(found.m[1].replace(',', '.'))
    batteryHours = value * found.perUnit
    chosen = part
    if (found.unit) notes.push(`autonomie en ${found.unit} (${value}) comptée à 8 h par jour`)
    break
  }
  // A sheet that gives only its 8 kHz figure ("Up to 35 hrs. at an 8 kHz polling rate"): the
  // copy's 1 000 Hz one ("150 hours on 1K polling and 35 hours on 8K").
  if (/\b[2-8]\s*khz|\b[2-8]000\s*hz|\b[2-8]k\b/i.test(chosen)) {
    const at1k = text
      .split(/(?<=[.!?])\s+|\n/)
      .find((s) => /\b1000\s*hz|\b1\s*khz|\b1k\b/i.test(s.replace(/(\d)[\s ](\d{3})/g, '$1$2')))
    const hours = at1k && /(\d+(?:[.,]\d+)?)\+?\s*(?:h|heures?|hours?|hrs?)\b/i.exec(at1k)?.[1]
    if (hours) batteryHours = Number(hours.replace(',', '.'))
  }
  // A sheet that gives none, or only what a quick charge gives: the figure the copy ties to the
  // battery ("une autonomie pouvant aller jusqu'à 70 jours avec une charge complète", "up to 100
  // hours of battery life", "40hr 2.4GHz / 120Hr Bluetooth").
  const copy = batteryHours
    ? undefined
    : COPY_BATTERY.map((re) => re.exec(text)).find((m) => m?.[1] && m[2])
  if (copy?.[1] && copy[2]) {
    const unit = copy[2].toLowerCase()
    batteryHours =
      Number(copy[1]) * (/^(jour|day)/.test(unit) ? 8 : /^(mois|month)/.test(unit) ? 240 : 1)
    notes.push(`autonomie lue dans le texte (${copy[0].trim()})`)
  }
  return { power, batteryHours }
}

/** The wired, 2.4 GHz and Bluetooth links, by their trade names too. */
function linksOf(facts: Facts, text: string, name: string) {
  const sheet = entries(facts, LABEL.connection)
    .map((e) => e.value)
    .join(' ; ')
  const all = `${sheet}\n${text}`
  // "Sans fil" alone may be Bluetooth: a 2.4 GHz link shows as its band or trade name, or as a
  // receiver, where the page says it comes with the mouse. A receiver it is "compatible avec", what
  // using one requires ("Récepteur USB Logi Bolt : Requis : port USB") or a battery line
  // ("Longévité de la pile avec le récepteur Logi Bolt") is no proof; nor is a "Bluetooth Edition".
  const included = all
    .split(/\n|\s;\s|\.\s/)
    .filter(
      (part) =>
        !/non inclus|not included|vendu s[ée]par[ée]ment|sold separately|non disponible dans le coffret/i.test(
          part,
        ),
    )
  const about = included.filter(
    (part) =>
      !/compatible|requis|n[ée]cessite|requires?\b|long[ée]vit[ée]|autonomie|battery life|(pas de|sans|no|without( a)?) (dongle|r[ée]cepteur|receiver)/i.test(
        part,
      ),
  )
  const conn24ghz =
    !/[ée]dition bluetooth|bluetooth edition/i.test(name) &&
    (/2[.,]4\s*g|lightspeed|hyperspeed|slipstream|quantum|\buwb\b|ultra[\s-]?wideband/i.test(
      included.join('\n'),
    ) ||
      /\bbolt\b|unifying|r[ée]cepteur usb|usb receiver|dongle/i.test(about.join('\n')))
  const connBt = /bluetooth/i.test(all)
  const wiredSaid = /filaire|wired|c[âa]ble usb|usb[\s-]?(type[\s-]?)?[ac]?\s*\(?filaire/i.test(
    sheet,
  )
  return { conn24ghz: conn24ghz && !/^filaire$/i.test(sheet.trim()), connBt, wiredSaid }
}

const GRIPS: [RegExp, Grip][] = [
  [/paume|palm/i, 'palm'],
  [/griffe|claw/i, 'claw'],
  [/bout des doigts|doigts|fingertip|finger/i, 'fingertip'],
]

function gripsOf(facts: Facts): Grip[] | undefined {
  const value = firstValue(facts, LABEL.grip)
  if (!value || /^(any|toutes?|tous)$/i.test(value)) return undefined
  const found = GRIPS.filter(([re]) => re.test(value)).map(([, g]) => g)
  // "Griffe, bout du doigt ou paume": every grip is none in particular.
  return found.length && found.length < GRIPS.length ? found : undefined
}

/** Hand ranges a maker states: centimetres, or words ("mains moyennes à grandes", "Large"). */
const HAND_WORDS: [RegExp, [number, number]][] = [
  [/tr[eè]s grandes?|extra[\s-]?large|\bxl\b/i, [21, 23]],
  [/grandes?|large/i, [19, 21.5]],
  [/moyennes?|medium/i, [17, 19.5]],
  [/petites?|small/i, [15, 17.5]],
]
const SIZE_WORD =
  '(tr[eè]s grandes?|grandes?|moyennes?|petites?|smaller|small|medium|larger|large|extra[\\s-]?large)'
/** "mains moyennes à grandes", "aux mains petites", "les plus grandes mains", "small to medium hands". */
const HAND_PHRASES = [
  new RegExp(`mains?\\s+${SIZE_WORD}(?:\\s*(?:à|-|ou|et)\\s*${SIZE_WORD})?`, 'gi'),
  new RegExp(`${SIZE_WORD}(?:\\s*(?:à|-|ou|et)\\s*${SIZE_WORD})?\\s+mains`, 'gi'),
  new RegExp(
    `${SIZE_WORD}(?:\\s*(?:to|-|or|and|&)\\s*${SIZE_WORD})?\\s+(?:sized\\s+)?hands?(?:\\s+sizes?)?\\b`,
    'gi',
  ),
]
/** A model the copy names, its size letter included: "M650", "M650 L", "3S", "G502". */
const MODEL =
  /\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{2,}(?:\s+(?:L|XL|S|Large|Small|Mini)\b)?/g
const modelId = (s: string) =>
  s
    .replace(/\s+/g, '')
    .replace(/large$/i, 'l')
    .replace(/small$/i, 's')
    .toLowerCase()

/**
 * The words of the copy that give the product's hands. A family's page says which size suits
 * which hand ("la souris M650 pour les mains petites et moyennes, la souris M650 L pour les grandes
 * mains"): a phrase that follows another model's name is that model's.
 */
function handPhraseOf(text: string, name: string): string | undefined {
  const ours = [...name.matchAll(MODEL)].at(-1)?.[0]
  for (const sentence of text.split(/[.;\n]/)) {
    for (const re of HAND_PHRASES) {
      for (const m of sentence.matchAll(re)) {
        const before = [...sentence.slice(0, m.index).matchAll(MODEL)].at(-1)?.[0]
        if (before && (!ours || modelId(before) !== modelId(ours))) continue
        return m.slice(1).filter(Boolean).join(' ')
      }
    }
  }
  return undefined
}

function handRangeOf(facts: Facts, text: string, name: string): { min?: number; max?: number } {
  const label = firstValue(facts, LABEL.hand)
  const said = [label, text].filter(Boolean).join('\n')
  const cm = /(\d{2}(?:[.,]\d)?)\s*(?:cm)?\s*(?:-|–|à|to)\s*(\d{2}(?:[.,]\d)?)\s*cm/i.exec(said)
  if (cm?.[1] && cm[2]) {
    const [a, b] = [Number(cm[1].replace(',', '.')), Number(cm[2].replace(',', '.'))]
    if (a >= 12 && b <= 26 && a < b) return { min: a, max: b }
  }
  const words = label ?? handPhraseOf(text, name)
  if (!words || /any|toutes?/i.test(words)) return {}
  const ranges = HAND_WORDS.filter(([re]) => re.test(words)).map(([, r]) => r)
  if (!ranges.length) return {}
  return { min: Math.min(...ranges.map((r) => r[0])), max: Math.max(...ranges.map((r) => r[1])) }
}

/** Where a trackball's ball sits, from what the page says of it; thumb, the commonest, otherwise. */
function ballOf(text: string, notes: string[]): Specs['ballPosition'] {
  if (
    /actionn[ée]e? par (un|les) doigts?|finger[\s-]operated|(boule|bille)[^.;\n]{0,40}(doigts|index)|grande (boule|bille)/i.test(
      text,
    )
  )
    return 'finger'
  if (
    /(boule|bille|trackball|suivi)[^.;\n]{0,40}(pouce|thumb)|(pouce|thumb)[^.;\n]{0,30}(boule|bille|trackball)|thumb[\s-]operated/i.test(
      text,
    )
  )
    return 'thumb'
  notes.push('position de la boule non dite : sous le pouce supposée')
  return 'thumb'
}

/** Counts the copy writes in words, from two on: "six boutons programmables". */
const COUNT_WORDS = [
  'deux|two',
  'trois|three',
  'quatre|four',
  'cinq|five',
  'six',
  'sept|seven',
  'huit|eight',
  'neuf|nine',
  'dix|ten',
  'onze|eleven',
  'douze|twelve',
]
const COUNT = `(\\d{1,2}|${COUNT_WORDS.join('|')})`
const BUTTONS_IN_COPY = [
  new RegExp(
    `\\b${COUNT}\\s+(?:boutons|commandes|buttons)\\s+(?:programmables|personnalisables|programmable|customi[sz]able)`,
    'i',
  ),
  new RegExp(`\\b${COUNT}\\s+(?:programmable|customi[sz]able)\\s+(?:buttons|controls)`, 'i'),
  // "Kone II Air's 7 buttons", "10 dedicated buttons": not "2 side buttons".
  new RegExp(
    `(?<!side |thumb |extra |additional )\\b${COUNT}\\s+(?:dedicated\\s+|physical\\s+)?buttons\\b`,
    'i',
  ),
]

/** The copy's count when the sheet gives none: "11 boutons programmables", "6 programmable buttons". */
function buttonsInCopy(text: string): number | undefined {
  const word = BUTTONS_IN_COPY.map((re) => re.exec(text)?.[1]).find(Boolean)
  if (!word) return undefined
  const spelt = COUNT_WORDS.findIndex((w) => w.split('|').includes(word.toLowerCase()))
  return Number(word) || (spelt >= 0 ? spelt + 2 : undefined)
}

const noSideButtons = (shape: Shape, buttons: number | undefined) =>
  shape === 'symmetrical' && buttons != null && buttons <= 3

/**
 * Whether a buttons line that names them ("4 (clic droit/gauche, clic central, bouton supérieur)")
 * puts one on a side; undefined when it only counts them. Back and forward buttons "sous le
 * défilement tactile" sit on top.
 */
function sideButtonsNamed(facts: Facts): boolean | undefined {
  const named = entries(facts, LABEL.buttons)
    .map((e) => e.value)
    .find((v) => /\(.*(clic|bouton|click|button)/i.test(v))
  if (!named) return undefined
  if (/sous (le|la) (d[ée]filement|molette|roulette|panneau)|sur le dessus|on top/i.test(named))
    return false
  return /lat[ée]ra|c[ôo]t[ée]|side|avant|arri[èe]re|retour|suivant|pr[ée]c[ée]dent|back|forward|pouce|thumb/i.test(
    named,
  )
}

/** The shape and the hand: the adapter's hints first, the sheet's words, then the copy. */
function shapeOf(
  facts: Facts,
  hints: MouseHints,
  buttons: number | undefined,
  notes: string[],
): { shape: Shape; hand: Hand } {
  const form = entries(facts, LABEL.form)
    .map((e) => e.value)
    .join(' ; ')
  const words = `${hints.name}\n${form}\n${hints.text}`
  let shape = hints.shape
  if (!shape) {
    if (/trackball/i.test(hints.name)) shape = 'trackball'
    else if (/vertical/i.test(`${hints.name} ${form}`)) shape = 'vertical'
    // "Droitier" alone says the hand, not the shape: a symmetrical shell is sold for the right hand.
    else if (/ergonomique|ergonomic|asymm?[ée]tri/i.test(form)) shape = 'ergonomic'
    else if (/symm?[ée]tri|ambidextr/i.test(form)) shape = 'symmetrical'
    else if (
      /(forme|design) ergonomique|ergonomic (shape|design)|sculpt[ée]e? pour (la )?main droite/i.test(
        words,
      )
    )
      shape = 'ergonomic'
    else if (/(forme|design) sym[ée]trique|symmetrical (shape|design)|ambidextr/i.test(words))
      shape = 'symmetrical'
    else {
      shape = 'symmetrical'
      notes.push('forme non dite : symétrique supposée')
    }
  }
  let hand = hints.hand
  if (!hand) {
    if (/gaucher|left[\s-]handed|main gauche|\bleft\b/i.test(`${hints.name} ${form}`)) hand = 'left'
    // A symmetrical shell without side buttons (left, right, wheel, a button on top) suits either hand.
    else if (
      noSideButtons(shape, buttons) ||
      (shape === 'symmetrical' && sideButtonsNamed(facts) === false)
    )
      hand = 'ambidextrous'
    else if (/ambidextr/i.test(form) || (shape !== 'ergonomic' && /ambidextr/i.test(words))) {
      // An "ambidextrous" shell with its side buttons on the left only still suits the right hand.
      const bothSides =
        /des deux c[ôo]t[ée]s|both sides|droitiers? et (aux )?gauchers?|gauchers? et (aux )?droitiers?|left and right[\s-]handed|boutons? (lat[ée]raux )?(magn[ée]tiques|amovibles|interchangeables)|(magnetic|removable|swappable) (side )?buttons/i.test(
          words,
        )
      hand = bothSides || shape === 'trackball' ? 'ambidextrous' : 'right'
      if (!bothSides && shape !== 'trackball')
        notes.push('dite ambidextre, boutons de côté à gauche seulement supposés : droitier')
    } else hand = 'right'
  }
  return { shape, hand }
}

/**
 * A mouse's specs from its sheet (label/value pairs) and its page's text. Skip('sans dimensions')
 * when a mouse's sheet lacks its size or weight: the finder cannot place it.
 */
export function mouseSpecsOf(facts: Facts, hints: MouseHints): { specs: Specs; notes: string[] } {
  const notes: string[] = []
  const text = clean(hints.text)
  // Words are looked for in the lines that do not say no: "Défilement horizontal : Non" has none.
  const sheet = facts.list
    .filter((f) => said(clean(f.value)) || !f.value.trim())
    .map((f) => `${f.label}: ${f.value}`)
    .join('\n')
  // "Boutons (gauche/droit) : 20 millions de clics" is a lifespan, not a count.
  const buttons =
    n(
      entries(facts, LABEL.buttons).find(
        (e) => /\d/.test(e.value) && !/million|clics|clicks/i.test(e.value),
      )?.value,
    ) ?? buttonsInCopy(text)
  const { shape, hand } = shapeOf(facts, hints, buttons, notes)
  const dims = dimsOf(facts, shape, notes)
  const weightG = weightOf(facts, notes)
  if (shape !== 'trackball' && (!dims.lengthMm || !dims.widthMm || !dims.heightMm || !weightG))
    throw new Skip('sans dimensions')
  const pollingHz = pollingOf(facts, notes)
  const segment = hints.segment ?? ((pollingHz ?? 0) >= 1000 ? 'gaming' : 'office')
  const links = linksOf(facts, `${sheet}\n${text}`, hints.name)
  const read = powerOf(facts, `${sheet}\n${text}`, notes)
  const { batteryHours } = read
  const wireless = links.conn24ghz || links.connBt
  // A wireless mouse that also works over its cable, or comes with a USB-C one, and takes no AA,
  // charges over it.
  const usbC =
    /c[âa]ble[^.;\n]{0,40}usb[\s-]?c|usb[\s-]?(type[\s-]?)?c\b[^.;\n]{0,15}(vers|to)\s/i.test(sheet)
  const power = read.power ?? (wireless && (links.wiredSaid || usbC) ? 'rechargeable' : undefined)
  const range = handRangeOf(facts, text, hints.name)
  const tiltSaid = firstValue(facts, LABEL.tilt)
  const dockSaid = firstValue(facts, LABEL.dock)
  const rgbSaid = firstValue(facts, LABEL.rgb)
  const switchText = entries(facts, LABEL.switches)
    .map((e) => e.value)
    .join(' ; ')
  const hostsSaid = /(\d)\s*(?:appareils|devices|canaux|channels|ordinateurs|h[ôo]tes|hosts)/i.exec(
    `${entries(facts, LABEL.hosts)
      .map((e) => e.value)
      .join(' ')} ${sheet} ${text}`,
  )
  const all = `${sheet}\n${text}`
  const specs: Specs = {
    shape,
    hand,
    segment,
    ...dims,
    weightG,
    ballPosition: shape === 'trackball' ? ballOf(`${hints.name}\n${all}`, notes) : undefined,
    buttons: buttons && buttons <= 30 ? buttons : undefined,
    mmo: /\bmmo\b|naga|scimitar|g600|\b(1[0-2]|[6-9])\s*boutons? (lat[ée]raux|de c[ôo]t[ée])/i.test(
      `${hints.name}\n${text}`,
    ),
    sensor: sensorOf(facts),
    dpiMax: dpiOf(facts),
    pollingHz,
    switchType: switchOf(switchText || ''),
    // Silent clicks, not a silent wheel ("une roulette lisse et silencieuse").
    silentClicks:
      /\bsilent\b(?!\s*(wheel|scroll))|silenttouch|(clics?|boutons?( de clic)?) silencieux|souris silencieuse|quiet[\s-]?clicks?|clics? (discrets|feutr[ée]s|insonoris[ée]s)/i.test(
        `${hints.name}\n${sheet}\n${text}`,
      ),
    connWired: links.wiredSaid || !wireless,
    conn24ghz: links.conn24ghz,
    connBt: links.connBt,
    hosts: hostsSaid?.[1] ? Number(hostsSaid[1]) : undefined,
    batteryHours: wireless ? batteryHours : undefined,
    power: wireless ? power : undefined,
    wirelessCharging: dockSaid
      ? said(dockSaid)
      : /powerplay|\bqi\b|recharge sans fil|wireless charging|hyperflux|station de charge|charging dock/i.test(
          all,
        ),
    freeSpinWheel:
      /magspeed|smart ?wheel|hyper[\s-]?scroll|d[ée]filement ((ultra|hyper)[\s-]?)?rapide|mode hyper[\s-]?rapide|(roulette|molette)[^.;\n]{0,30}(double mode|librement)|free[\s-]?spin|roue libre|d[ée]brayable|d[ée]filement infini|infinite scroll/i.test(
        all,
      ),
    tiltWheel: tiltSaid
      ? said(tiltSaid.replace(/^.*-\s*/, ''))
      : /(molette|roulette|d[ée]filement) (multidirectionnel|inclinable)|(molette|roulette)[^.;\n]{0,40}inclin|inclin\w* (la )?(roulette|molette|souris)[^.;\n]{0,30}(à|vers la) gauche|tilt[\s-]?(wheel|scroll)|wheel[^.;\n]{0,20}\btilt|\btilt (left|right)|\b4d\b[^.;\n]{0,20}wheel|4[\s-]?way scroll/i.test(
          all,
        ),
    thumbWheel:
      /molette (lat[ée]rale|horizontale|(du|de|pour le) pouce)|thumb[\s-]?wheel|side[\s-]?scroll|d[ée]filement horizontal|horizontal scroll/i.test(
        all,
      ),
    // "Éclairage vert à couleur unique" is lighting, not RGB.
    rgb: rgbSaid
      ? said(rgbSaid.replace(/^.*-\s*/, '')) &&
        !/couleur unique|une seule couleur|single[\s-]colou?r|monochrom/i.test(rgbSaid)
      : /\brgb\b|chroma|lightsync|rvb/i.test(all),
    makerHandMinCm: range.min,
    makerHandMaxCm: range.max,
    makerGrips: gripsOf(facts),
  }
  if (wireless && !power) notes.push('alimentation non dite')
  return { specs, notes: [...new Set(notes)] }
}
