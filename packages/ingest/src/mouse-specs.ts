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
  dims: /^(dimensions?|tailleapproximative|size|productdimensions|dimensionsduproduit|dimensionsdelasouris|mousedimensions|taille)\w*$/,
  weight: /^(poids|weight|masse)\w*$/,
  sensor: /^(capteur|sensor|typedecapteur|sensortype|technologieducapteur)$/,
  dpi: /^(resolution\w*|dpi\w*|cpi\w*|ppp\w*|sensibilite\w*|maxsensitivity|sensitivity)$/,
  polling:
    /^(tauxderapport\w*|tauxdinterrogation\w*|frequencedinterrogation\w*|pollingrate\w*|reportrate\w*|frequencedechantillonnage\w*|frequencedesondage\w*)$/,
  buttons:
    /^(boutons\w*|nombredeboutons\w*|buttons?|numberofbuttons|programmablebuttons|boutonsprogrammables)$/,
  switches:
    /^(typedecommutateur\w*|commutateurs?\w*|switchtype|switches|typedeswitch\w*|typedinterrupteur\w*|interrupteurs?\w*|boutonsprincipaux|mainbuttons?)$/,
  battery:
    /^(autonomie\w*|batterylife|dureedevie\w*batterie|typedepile|typedebatterie|batterytype|pile|piles|batterie|battery|alimentation|powersource)$/,
  connection:
    /^(connectivite\w*|connexion\w*|connectivity|connectiontype|typedeconnexion|technologiesansfil|wirelesstechnology|interface|cable|cablage)$/,
  hosts: /^(easyswitch|multiappareils|multidevice|nombredappareils|appareilsconnectables)$/,
  form: /^(forme|formfactor|facteurdeforme|design|shape|ergonomie)$/,
  grip: /^(styledeprise|priseenmain|grip|griptype|typedeprise|gripstyle)$/,
  hand: /^(handsize|tailledemain|tailledelamain|mainsrecommandees)$/,
  tilt: /^(molettemultidirectionnelle|molettedinclinaison|tiltscrollwheel|tiltwheel|defilementlateral)$/,
  rgb: /^(eclairage\w*|lighting|rgb|chromargb|retroeclairage)$/,
  dock: /^(compatibiliteaveclesaccessoires|dockcompatibility|chargingdock|rechargesansfil|wirelesscharging)$/,
}

/** "Non", "No", "S/O", "N/A", "—": the sheet says the mouse has none. */
const NEGATIVE = /^(?:non|no|none|aucun\w*|sans|s\/o|n\/a|na|false)\b|^[-–—]$|^0$/i

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
  for (const e of entries(facts, LABEL.weight)) {
    const v = e.value.replace(/(\d),(\d)/g, '$1.$2')
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
      // A rate reached with a dongle sold apart is not the mouse's own.
      if (/s[ée]par[ée]ment|separately|en option|optional|vendu/i.test(part)) {
        notes.push(`${hz} Hz avec un dongle vendu à part : non compté`)
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

/** Battery life in hours, the power source, from "90 heures à 1 000 Hz", "70 jours", "24 mois". */
function powerOf(facts: Facts, text: string, notes: string[]) {
  const lines = entries(facts, LABEL.battery).map((e) => `${e.label}: ${e.value}`)
  const all = [...lines, text].join('\n')
  const power: Specs['power'] = /\baaa\b/i.test(all)
    ? 'aaa'
    : /\b(piles?|aa|batteries? aa|alkaline)\b/i.test(lines.join(' ')) || /piles? aa\b/i.test(all)
      ? 'aa'
      : /rechargeable|li-?(ion|po)|batterie interne|charge (usb|rapide)|recharg/i.test(all)
        ? 'rechargeable'
        : undefined
  let batteryHours: number | undefined
  for (const line of lines) {
    const v = line.replace(/(\d)[\s ](\d{3})/g, '$1$2')
    // Gaming sheets give several rates: the 1 000 Hz figure is the comparable one.
    const at1k = /(\d+(?:[.,]\d+)?)\s*(?:h|heures?|hours?|hrs?)\b[^;\n]*?1000\s*hz/i.exec(v)
    const hours = at1k ?? /(\d+(?:[.,]\d+)?)\s*(?:h|heures?|hours?|hrs?)\b/i.exec(v)
    if (hours?.[1]) {
      batteryHours = Number(hours[1].replace(',', '.'))
      break
    }
    const days = /(\d+)\s*(?:jours?|days?)\b/i.exec(v)
    if (days?.[1]) {
      batteryHours = Number(days[1]) * 8
      notes.push(`autonomie en jours (${days[1]}) comptée à 8 h par jour`)
      break
    }
    const months = /(\d+)\s*(?:mois|months?)\b/i.exec(v)
    if (months?.[1]) {
      batteryHours = Number(months[1]) * 30 * 8
      break
    }
  }
  return { power, batteryHours }
}

/** The wired, 2.4 GHz and Bluetooth links, by their trade names too. */
function linksOf(facts: Facts, text: string) {
  const sheet = entries(facts, LABEL.connection)
    .map((e) => e.value)
    .join(' ; ')
  const all = `${sheet}\n${text}`
  // "Sans fil" alone may be Bluetooth: a 2.4 GHz link shows as a receiver or its trade name.
  const conn24ghz =
    /2[.,]4\s*g|lightspeed|hyperspeed|slipstream|quantum|\bbolt\b|unifying|r[ée]cepteur usb|usb receiver|dongle/i.test(
      all,
    )
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
  return found.length ? found : undefined
}

/** Hand ranges a maker states: centimetres, or words ("mains moyennes à grandes", "Large"). */
const HAND_WORDS: [RegExp, [number, number]][] = [
  [/tr[eè]s grandes?|extra[\s-]?large|\bxl\b/i, [21, 23]],
  [/grandes?|large/i, [19, 21.5]],
  [/moyennes?|medium/i, [17, 19.5]],
  [/petites?|small/i, [15, 17.5]],
]
const SIZE_WORD =
  '(tr[eè]s grandes?|grandes?|moyennes?|petites?|small|medium|large|extra[\\s-]?large)'
/** "mains moyennes à grandes", "aux mains petites", "small to medium hands", "medium hands". */
const HAND_PHRASES = [
  new RegExp(`mains?\\s+${SIZE_WORD}(?:\\s*(?:à|-|ou)\\s*${SIZE_WORD})?`, 'i'),
  new RegExp(`${SIZE_WORD}(?:\\s*(?:to|-|or)\\s*${SIZE_WORD})?\\s+(?:sized\\s+)?hands`, 'i'),
]

function handRangeOf(facts: Facts, text: string): { min?: number; max?: number } {
  const label = firstValue(facts, LABEL.hand)
  const said = [label, text].filter(Boolean).join('\n')
  const cm = /(\d{2}(?:[.,]\d)?)\s*(?:cm)?\s*(?:-|–|à|to)\s*(\d{2}(?:[.,]\d)?)\s*cm/i.exec(said)
  if (cm?.[1] && cm[2]) {
    const [a, b] = [Number(cm[1].replace(',', '.')), Number(cm[2].replace(',', '.'))]
    if (a >= 12 && b <= 26 && a < b) return { min: a, max: b }
  }
  const phrase = HAND_PHRASES.map((re) => re.exec(text)).find(Boolean)
  const words = label ?? (phrase ? phrase.slice(1).filter(Boolean).join(' ') : undefined)
  if (!words || /any|toutes?/i.test(words)) return {}
  const ranges = HAND_WORDS.filter(([re]) => re.test(words)).map(([, r]) => r)
  if (!ranges.length) return {}
  return { min: Math.min(...ranges.map((r) => r[0])), max: Math.max(...ranges.map((r) => r[1])) }
}

/** The shape and the hand: the adapter's hints first, the sheet's words, then the copy. */
function shapeOf(facts: Facts, hints: MouseHints, notes: string[]): { shape: Shape; hand: Hand } {
  const form = entries(facts, LABEL.form)
    .map((e) => e.value)
    .join(' ; ')
  const words = `${hints.name}\n${form}\n${hints.text}`
  let shape = hints.shape
  if (!shape) {
    if (/trackball/i.test(hints.name)) shape = 'trackball'
    else if (/vertical/i.test(`${hints.name} ${form}`)) shape = 'vertical'
    // "Droitier" alone says the hand, not the shape: a symmetrical shell is sold for the right hand.
    else if (/ergonomique|ergonomic|asym[ée]tri/i.test(form)) shape = 'ergonomic'
    else if (/sym[ée]tri|ambidextr/i.test(form)) shape = 'symmetrical'
    else if (/forme ergonomique|ergonomic shape|sculpt[ée]e? pour (la )?main droite/i.test(words))
      shape = 'ergonomic'
    else if (/forme sym[ée]trique|symmetrical shape|ambidextr/i.test(words)) shape = 'symmetrical'
    else {
      shape = 'symmetrical'
      notes.push('forme non dite : symétrique supposée')
    }
  }
  let hand = hints.hand
  if (!hand) {
    if (/gaucher|left[\s-]handed|main gauche/i.test(`${hints.name} ${form}`)) hand = 'left'
    else if (/ambidextr/i.test(form) || (shape !== 'ergonomic' && /ambidextr/i.test(words))) {
      // An "ambidextrous" shell with its side buttons on the left only still suits the right hand.
      const bothSides =
        /des deux c[ôo]t[ée]s|both sides|droitiers? et (aux )?gauchers?|gauchers? et (aux )?droitiers?|left and right[\s-]handed/i.test(
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
  const sheet = facts.text
  const { shape, hand } = shapeOf(facts, hints, notes)
  const dims = dimsOf(facts, shape, notes)
  const weightG = weightOf(facts, notes)
  if (shape !== 'trackball' && (!dims.lengthMm || !dims.widthMm || !dims.heightMm || !weightG))
    throw new Skip('sans dimensions')
  const pollingHz = pollingOf(facts, notes)
  const segment = hints.segment ?? ((pollingHz ?? 0) >= 1000 ? 'gaming' : 'office')
  const links = linksOf(facts, `${sheet}\n${text}`)
  const { power, batteryHours } = powerOf(facts, `${sheet}\n${text}`, notes)
  const wireless = links.conn24ghz || links.connBt
  const range = handRangeOf(facts, text)
  const buttons = n(firstValue(facts, LABEL.buttons))
  const tiltSaid = firstValue(facts, LABEL.tilt)
  const dockSaid = firstValue(facts, LABEL.dock)
  const rgbSaid = firstValue(facts, LABEL.rgb)
  const switchText = entries(facts, LABEL.switches)
    .map((e) => e.value)
    .join(' ; ')
  const hostsSaid = /(\d)\s*(?:appareils|devices|canaux|channels|ordinateurs)/i.exec(
    `${entries(facts, LABEL.hosts)
      .map((e) => e.value)
      .join(' ')} ${text}`,
  )
  const all = `${sheet}\n${text}`
  const specs: Specs = {
    shape,
    hand,
    segment,
    ...dims,
    weightG,
    ballPosition:
      shape === 'trackball'
        ? /doigt|finger|index/i.test(all) && !/pouce|thumb/i.test(hints.name)
          ? 'finger'
          : 'thumb'
        : undefined,
    buttons: buttons && buttons <= 30 ? buttons : undefined,
    mmo: /\bmmo\b|naga|scimitar|g600|\b(1[0-2]|[6-9])\s*boutons? (lat[ée]raux|de c[ôo]t[ée])/i.test(
      `${hints.name}\n${text}`,
    ),
    sensor: sensorOf(facts),
    dpiMax: dpiOf(facts),
    pollingHz,
    switchType: switchOf(switchText || ''),
    silentClicks: /silen|silent|quiet[\s-]?click|clics? (discrets|feutr[ée]s)/i.test(
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
      /magspeed|hyper[\s-]?scroll|d[ée]filement (ultra[\s-]?)?rapide|free[\s-]?spin|roue libre|d[ée]brayable|d[ée]filement infini|infinite scroll/i.test(
        all,
      ),
    tiltWheel: tiltSaid
      ? said(tiltSaid.replace(/^.*-\s*/, ''))
      : /molette (multidirectionnelle|inclinable)|tilt[\s-]?(wheel|scroll)|4[\s-]?way scroll/i.test(
          all,
        ),
    thumbWheel:
      /molette (lat[ée]rale|horizontale|(du|de) pouce)|thumb[\s-]?wheel|d[ée]filement horizontal|horizontal scroll/i.test(
        all,
      ),
    rgb: rgbSaid ? said(rgbSaid.replace(/^.*-\s*/, '')) : /\brgb\b|chroma|lightsync|rvb/i.test(all),
    makerHandMinCm: range.min,
    makerHandMaxCm: range.max,
    makerGrips: gripsOf(facts),
  }
  if (wireless && !power) notes.push('alimentation non dite')
  return { specs, notes: [...new Set(notes)] }
}
