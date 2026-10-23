import type { MonitorInput } from '@choose/catalog'
import { type Facts, labelKey, num } from './facts'
import { Skip } from './source'
import { plainNumber } from './sources/official'

// Monitor spec sheets → our schema. Every official site words its sheet its own way (French or
// English labels, a unit or none, "1,000:1" or "1 000:1", the version of a port in its label or in
// its value), so an adapter hands its sheet over as label/value pairs, and this module reads them
// all the same way. A label that means one thing at a brand and another elsewhere is renamed by
// the adapter first: the stand's left-right turn is `Swivel`, the portrait turn `Pivot` (French
// sheets call either of them "Rotation", "Pivotement" or "Pivotant"). Nothing is guessed: a figure
// the sheet does not give stays absent (the finder then counts it as its peers' typical one), and
// the few readings that do assume something leave a note for the review.

type Specs = MonitorInput['specs']
type Entry = { key: string; label: string; value: string }

/** Labels compared like Facts does: lowercased, accents and punctuation dropped. */
const LABEL = {
  diagonal:
    /^(screensize|displaysize|panelsize|diagonale?|taille|tailleecran|taille(pouces?|cm|inch)|taille(de)?l?(a)?(ecran|dalle)\w*|classedetailledecran)$/,
  /** The active area, W × H in mm: a sheet that gives no diagonal gives this. */
  area: /^(zonedaffichage|zoneactive|activedisplayarea|zonedevisualisationefficace)\w*$/,
  /** Pixels per inch: with the resolution, the diagonal of a sheet that gives neither (BenQ). */
  density: /^(ppp|ppi|pixelsparpouce|pixelsperinch|densitedepixels?|pixeldensity)$/,
  resolution:
    /^(resolution(max|maximale|maximum|native|deladalle|max(pcordinateurportable)?)?|maxresolution|nativeresolution|definition)$/,
  panel:
    /^(panel|paneltype|paneltechnology|typededalle|dalle|typedepanneau|typedecranlcd|technologiedecran|displaytechnology|typedeclairage|typederetroeclairage|technologieduretroeclairage|retroeclairage|backlight)$/,
  curvature: /^(curvature|courbure|courburedecran|rayondecourbure|platincurve|ecranincurve)$/,
  coating:
    /^(coating|surfacetreatment|screensurface|revetement(delecran)?|traitement(desurface|deladalle)?|surfacedaffichage|finition)$/,
  refresh:
    /^(refreshrate|maxrefreshrate|frequencederafraichissement(max)?|tauxderafraichissement(max|maxhz|standard|hz)?|maxfrequencederafraichissement|frequencedebalayage|frequenceverticale|verticalfrequency|dualmode|frequencedusignal(numerique)?)$/,
  response: /^(responsetime\w*|tempsdereponse\w*|detailsdutempsdereponse)$/,
  brightness: /^((sdr|hdr|peak|typical)?(brightness|luminosite)\w*|luminance)$/,
  contrast:
    /^(contrast(ratio)?|staticcontrast|contraste(natif|statique)?|(rapport|taux|niveau|ratio)decontraste\w*)$/,
  speakers:
    /^(speakers?|builtinspeakers?|hautsparleurs|hautparleurs?(integres?)?|hautparleurintegre)$/,
  height:
    /^(heightadjustment\w*|adjustmentheight\w*|heightadjustable|reglage(en|de)?(la)?hauteur\w*|ajustement(de)?(la)?hauteur\w*|ajustableenhauteur|hauteurmaximumajustable|piedreglableenhauteur|hauteurreglable)$/,
  tilt: /^((adjustment)?tilt|inclinaison\w*|angledinclinaison|angledinclination|reglagedelinclinaison)$/,
  // English sheets say which turn they mean; French ones are renamed by their adapter.
  swivel: /^(adjustment)?swivel$/,
  pivot: /^(adjustment)?pivot$/,
  vesa: /vesa|montagemural|supportmural|installationaumur|fixationmurale|wallmount/,
  weight: /^(weight\w*|poids\w*|produitavecsupportkg)$/,
}

/** "Non", "No", "S/O" (sans objet), "N/A", "—": the sheet says the product has none. */
const NEGATIVE = /^(?:non|no|none|aucun\w*|sans|s\/o|n\/a|na|false)\b|^[-–—]$|^0$/i

/** Odd characters of the sheets, made plain: soft hyphen for a minus, ˚ for °, ㎡, ™… */
export function clean(value: string) {
  return value
    .replace(/[   ]/g, ' ')
    .replace(/­/g, '-')
    .replace(/˚/g, '°')
    .replace(/㎡/g, 'm²')
    .replace(/[“”″]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[™®]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** First number of a string, its thousands separators dropped ("1,000", "1 000"), comma decimals read. */
const n = (s: string | undefined) => num(s && plainNumber(s))

function entries(facts: Facts, label: RegExp): Entry[] {
  return facts.list
    .map((f) => ({ key: labelKey(f.label), label: f.label, value: clean(f.value) }))
    .filter((e) => label.test(e.key))
}

const said = (value: string) => value !== '' && !NEGATIVE.test(value)

/** Vertical pixels of a resolution named in words ("UHD@160Hz / FHD@320Hz"). */
const NAMED_HEIGHT: [RegExp, number][] = [
  [/\b(\d{3,4})\s*[x×*]\s*(\d{3,4})\b/, 0],
  [/\b(uhd|4k|wuhd|duhd)\b/i, 2160],
  [/\b(w?qhd|dqhd|1440p)\b/i, 1440],
  [/\b(w?fhd|dfhd|full\s*hd|1080p)\b/i, 1080],
  [/\b(hd|720p)\b/i, 720],
]

function heightNamed(part: string): number | undefined {
  for (const [re, h] of NAMED_HEIGHT) {
    const m = re.exec(part)
    if (m) return h || Number(m[2])
  }
  return undefined
}

/** The aspect ratio of a resolution; undefined for one the finder does not take (16:18, 4:3…). */
export function aspectOf(w: number, h: number): Specs['aspect'] | undefined {
  const r = w / h
  if (r >= 3) return '32:9'
  if (r >= 2) return '21:9'
  if (r >= 1.69) return '16:9'
  if (r >= 1.55) return '16:10'
  if (r >= 1.45) return '3:2'
  return undefined
}

/** IPS, VA, OLED (QD-OLED or WOLED), Mini-LED, TN from the words of a sheet. */
export function panelOf(text: string): { panel?: Specs['panel']; note?: string } {
  if (/qd[\s-]*oled|quantum[\s-]*dot[\s-]*oled/i.test(text)) return { panel: 'qdoled' }
  if (/oled/i.test(text)) {
    return /w[\s-]?oled|tandem woled|mla/i.test(text)
      ? { panel: 'woled' }
      : { panel: 'woled', note: 'OLED sans précision : WOLED supposé' }
  }
  if (/mini[\s-]*led/i.test(text)) {
    if (/\bva\b/i.test(text)) return { panel: 'miniled_va' }
    return /ips|pls|ads\b/i.test(text)
      ? { panel: 'miniled_ips' }
      : { panel: 'miniled_ips', note: 'Mini-LED : dalle IPS supposée' }
  }
  if (/\b(fast\s*|rapid\s*)?h?va\b|\bmva\b|vertical alignment/i.test(text)) return { panel: 'va' }
  if (/\btn\b|twisted nematic/i.test(text)) return { panel: 'tn' }
  if (/ips|\bpls\b|\bads\b|ahva|in-plane/i.test(text)) return { panel: 'ips' }
  return {}
}

/** Diagonals sold, for one worked out from a rounded pixel density (93 ppi → 23.7 → 23.8"). */
const SIZES = [
  21.5, 23.8, 24, 24.5, 25, 26.5, 27, 28, 31.5, 32, 34, 37.5, 38, 39, 40, 42, 43, 44.5, 45, 48, 49,
  52, 55, 57,
]

function diagonalOf(facts: Facts, name: string, res?: [number, number]): number | undefined {
  for (const e of entries(facts, LABEL.diagonal)) {
    const inch = /(\d{2}(?:[.,]\d{1,2})?)\s*(?:"|''|pouces?|inch(?:es)?\b|in\b|po\b)/i.exec(e.value)
    if (inch) return n(inch[1])
    const cm = /(\d{2,3}(?:[.,]\d{1,2})?)\s*cm\b/i.exec(e.value)
    const bare = n(e.value)
    if (cm || (bare && /cm$/.test(e.key)))
      return Math.round(((cm ? n(cm[1]) : bare) ?? 0) / 0.254) / 10
    if (bare && bare >= 10 && bare <= 65) return bare
  }
  const inName = /(\d{2}(?:[.,]\d)?)\s*(?:"|''|pouces?|-?inch\b)/i.exec(clean(name))
  if (inName) return n(inName[1])
  // "Zone d'affichage (H x V) 799.8 x 334.8 mm": the diagonal of the active area.
  for (const e of entries(facts, LABEL.area)) {
    const m = /(\d{3}(?:[.,]\d+)?)\s*(?:\(h\))?\s*[x×]\s*(\d{3}(?:[.,]\d+)?)/i.exec(e.value)
    const w = n(m?.[1])
    const h = n(m?.[2])
    if (w && h) return Math.round(Math.hypot(w, h) / 2.54) / 10
  }
  // "PPP 109" at 2560×1440: 26.95", the 27" it is sold as.
  for (const e of entries(facts, LABEL.density)) {
    const ppi = n(e.value)
    if (!res || !ppi || ppi < 40 || ppi > 300) continue
    const inches = Math.hypot(...res) / ppi
    const sold = SIZES.reduce((a, b) => (Math.abs(b - inches) < Math.abs(a - inches) ? b : a))
    return Math.abs(sold - inches) / inches < 0.02 ? sold : Math.round(inches * 10) / 10
  }
  return undefined
}

function resolutionOf(facts: Facts): [number, number] | undefined {
  let best: [number, number] | undefined
  for (const e of entries(facts, LABEL.resolution)) {
    for (const m of plainNumber(e.value).matchAll(/(\d{3,4})\s*[x×*]\s*(\d{3,4})/g)) {
      const pair: [number, number] = [Number(m[1]), Number(m[2])]
      if (!best || pair[0] * pair[1] > best[0] * best[1]) best = pair
    }
  }
  return best
}

/** A scan range (Philips, AOC: "30-150 Hz (V)") bounds the electronics, not the panel's rate. */
const SCAN = /balayage|frequenceverticale|verticalfrequency/

/** Highest refresh rate at the native resolution, and a higher one at a lower resolution. */
function refreshOf(facts: Facts, nativeH: number, name: string) {
  let max: number | undefined
  let scanMax: number | undefined
  let dual: number | undefined
  for (const e of entries(facts, LABEL.refresh)) {
    const scan = SCAN.test(e.key)
    // "UHD Mode: / HDMI: …160Hz (V) / FHD Mode: / …324Hz (V)": a heading holds until the next.
    let heading: number | undefined
    for (const part of e.value.split(/\s*(?:\/|;|\||,(?!\d{3}))\s*/)) {
      if (/mode\s*:?\s*$/i.test(part) || /^\s*\w+\s*mode\b/i.test(part)) heading = heightNamed(part)
      // A digit or a dot before the figure belongs to something else: Dell glues "DisplayPort 1.4"
      // to "48 Hz" ("1.448 Hz").
      const hz = /hz/i.test(part)
        ? [...part.matchAll(/(?<![\d.])(\d{2,3})\s*hz/gi)].map((m) => Number(m[1]))
        : [...part.matchAll(/\b(\d{2,3})\b/g)].map((m) => Number(m[1])).filter((v) => v >= 48)
      if (!hz.length) continue
      const top = Math.max(...hz)
      const h = heightNamed(part) ?? heading
      // "Normal : 75 Hz / Dual Mode : 300 Hz": the dual mode's rate, at a lower resolution.
      if ((h && h < nativeH * 0.9) || /dual\s*mode|mode\s*double/i.test(part)) {
        dual = Math.max(dual ?? 0, top)
      } else if (scan) scanMax = Math.max(scanMax ?? 0, top)
      else max = Math.max(max ?? 0, top)
    }
  }
  // No refresh row: a resolution given with its rate ("2560 x 1440 à 100 Hz"), then a scan range,
  // else the name.
  if (max == null) {
    for (const f of facts.list) {
      for (const m of plainNumber(clean(f.value)).matchAll(
        /(\d{3,4})\s*[x×]\s*(\d{3,4})\s*(?:à|@|at)\s*(\d{2,3})\s*hz/gi,
      )) {
        if (Number(m[2]) >= nativeH * 0.9) max = Math.max(max ?? 0, Number(m[3]))
      }
    }
  }
  if (max == null) max = scanMax
  if (max == null) {
    const inName = /(?<![\d.])(\d{2,3})\s*hz/i.exec(name)
    if (inName) max = Number(inName[1])
  }
  return { max, dual: dual && max && dual > max ? dual : undefined }
}

/** The GtG figure: an MPRT one measures something else (blur, with the backlight strobing). */
function responseOf(facts: Facts): number | undefined {
  for (const e of entries(facts, LABEL.response)) {
    if (/mprt/.test(e.key)) continue
    const gtg = /(\d+(?:[.,]\d+)?)\s*ms\s*\(?\s*(?:gtg|g[aà]g|gris|gr[ae]y)/i.exec(e.value)
    if (gtg) return n(gtg[1])
    const any = /(\d+(?:[.,]\d+)?)\s*ms/i.exec(e.value)
    if (any && !/mprt/i.test(e.value)) return n(any[1])
  }
  return undefined
}

export function vrrOf(text: string): Specs['vrr'] {
  if (
    /g-?sync\s*(ultimate|pulsar|module|processor|processeur)|(module|processeur)\s*(nvidia\s*)?g-?sync/i.test(
      text,
    )
  ) {
    return 'gsync_module'
  }
  if (/freesync\s*premium\s*pro/i.test(text)) return 'freesync_premium_pro'
  if (/freesync\s*premium/i.test(text)) return 'freesync_premium'
  if (/g-?sync\s*compatible|compatible\s*(avec|with)[^.;\n]{0,40}g-?sync/i.test(text)) {
    return 'gsync_compatible'
  }
  if (/freesync|adaptive[\s-]?sync|\bvrr\b/i.test(text)) return 'freesync'
  return 'none'
}

export function hdrOf(text: string): Specs['hdrCert'] {
  const tb =
    /true\s*black\s*(400|500|600)/i.exec(text) ??
    /displayhdr\s*(400|500|600)\s*true\s*black/i.exec(text)
  if (tb) return `true_black_${tb[1]}` as Specs['hdrCert']
  const level =
    /(?:display\s*hdr|vesa\s*(?:certified\s*)?hdr)\s*(400|500|600|1000|1400)\b/i.exec(text) ??
    /\bhdr\s*(400|500|600|1000|1400)\b/i.exec(text)
  return level ? (`hdr${level[1]}` as Specs['hdrCert']) : 'none'
}

/** Typical SDR brightness and HDR peak, in cd/m². */
function brightnessOf(facts: Facts, oled: boolean) {
  let sdr: number | undefined
  let peak: number | undefined
  for (const e of entries(facts, LABEL.brightness)) {
    // "Luminosité (Min)": the dimmest setting (and "luminosité" itself holds a "min").
    if (/min/.test(e.key.replace(/^(luminosite|brightness)/, ''))) continue
    for (const part of e.value.split(/\s*[,;/]\s*(?!\d{3}\b)/)) {
      const m = /(\d{2,4})\s*(?:cd|nits?)/i.exec(plainNumber(part)) ?? /^(\d{2,4})\b/.exec(part)
      if (!m) continue
      const value = Number(m[1])
      if (/hdr|pic|peak|crete|max/i.test(`${e.key} ${part}`)) peak ??= value
      else sdr ??= value
    }
  }
  // An OLED's sheet that gives one figure only gives its peak (1 000 cd/m², against 250 typical).
  if (oled && sdr && sdr >= 600 && !peak) return { sdr: undefined, peak: sdr }
  return { sdr, peak }
}

/** Static contrast; the dynamic and OLED figures ("1 000 000:1", "1.5M:1") say nothing comparable. */
function contrastOf(facts: Facts): number | undefined {
  for (const e of entries(facts, LABEL.contrast)) {
    if (/dynami|dcr|hdr|max|mega|min$/.test(e.key)) continue
    const m = /(\d+(?:[.,]\d+)?)\s*([mk])?\s*:\s*1\b/i.exec(plainNumber(e.value))
    if (!m?.[1]) continue
    const value = Number(m[1].replace(',', '.')) * (m[2] ? (/m/i.test(m[2]) ? 1e6 : 1e3) : 1)
    if (value < 100_000) return Math.round(value)
  }
  return undefined
}

const SPACES: [RegExp, 'p3' | 'srgb' | 'other'][] = [
  [/dci[\s-]*p3|\bp3\b|\bdci\b/i, 'p3'],
  [/s\s?rgb/i, 'srgb'],
  [/adobe|ntsc|rec\.?\s*2020|bt\.?\s*2020/i, 'other'],
]
const spaceIn = (s: string) => SPACES.find(([re]) => re.test(s))?.[1]
const percent = (s: string) => {
  const v = n(s)
  // Samsung writes coverage as a fraction ("0.99").
  return v == null ? undefined : v <= 1.5 ? Math.round(v * 1000) / 10 : v
}

/** DCI-P3 and sRGB coverage, from whichever way the sheet pairs a colour space and a percentage. */
function gamutOf(facts: Facts) {
  const found: { p3?: number; srgb?: number } = {}
  const keep = (space: string | undefined, value: number | undefined) => {
    if (value == null || value < 30 || value > 200) return
    if (space === 'p3') found.p3 ??= value
    if (space === 'srgb') found.srgb ??= value
  }
  for (const f of facts.list) {
    const label = clean(f.label)
    const value = clean(f.value)
    if (!/gam|gamut|espace|couleur|colou?r|dci|p3|srgb|adobe|ntsc/i.test(label)) continue
    // "Gamme de couleurs (Min.)": the floor a panel guarantees, before its typical figure.
    if (/\(min/i.test(label)) continue
    // "Adobe RGB / DCI-P3 / sRGB" against "98% / 99% / 138%".
    const labels = label.split('/')
    const values = value.split('/')
    if (labels.length > 1 && labels.length === values.length) {
      labels.forEach((l, i) => {
        keep(spaceIn(l), percent(values[i] ?? ''))
      })
      continue
    }
    const pairs = [
      ...value.matchAll(
        /(dci[\s-]*p3|\bp3\b|s\s?rgb|adobe\s*rgb|ntsc)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*%/gi,
      ),
    ].map((m) => [m[1] ?? '', m[2] ?? ''] as const)
    pairs.push(
      ...[
        ...value.matchAll(
          /(\d+(?:[.,]\d+)?)\s*%\s*(?:\(cie\s*\d{4}\)\s*)?(dci[\s-]*p3|\bp3\b|s\s?rgb|adobe\s*rgb|ntsc)/gi,
        ),
      ].map((m) => [m[2] ?? '', m[1] ?? ''] as const),
    )
    if (pairs.length) {
      for (const [space, pct] of pairs) keep(spaceIn(space), percent(pct))
      continue
    }
    // The space in the label, the figure alone in the value: "Espace des couleurs (DCI-P3)", "95%".
    keep(spaceIn(label), percent(value))
  }
  return found
}

function bitDepthOf(text: string): Specs['bitDepth'] {
  if (/12\s*-?\s*bits?|68[.,]7\s*(milliards?|billion|b\b)/i.test(text)) return 12
  if (
    /10\s*-?\s*bits?|1[.,]07\d*\s*(milliards?|billion|b\b)|1073(?:[.,]\d)?\s*m\b|8\s*-?\s*bits?\s*\+\s*frc|\bmax\s*1\s*b\b/i.test(
      text,
    )
  ) {
    return 10
  }
  if (/\b8\s*-?\s*bits?|16[.,]7\s*(millions?|m\b)/i.test(text)) return 8
  if (/\b6\s*-?\s*bits?/i.test(text)) return 6
  return undefined
}

const highest = (xs: number[]) => (xs.length ? Math.max(...xs) : undefined)

/** HDMI ports and their highest version: "2 x HDMI 2.1", "HDMI(v2.1)x 2", "HDMI = 2 EA"… */
function hdmiOf(lines: Entry[]) {
  const versions: number[] = []
  const listed: number[] = []
  // One row per kind of port ("HDMI (v2.1) = 2", "HDMI (v2.1) eARC = 1"): their counts add up.
  const byLabel = new Map<string, number>()
  for (const { label, value } of lines) {
    const line = `${label}: ${value}`
    if (!/hdmi/i.test(line)) continue
    // "HDMI 2.1", "HDMI(v2.1)", "Version HDMI: 2.1", LG's "HDMI: Oui(2.1)"; never a version further on.
    for (const m of line.matchAll(
      /hdmi\s*(?:version\s*)?(?:\(\s*v?\s*|v\s*|:\s*(?:(?:oui|yes)\s*)?\(?\s*(?:ver\s*)?)?(1\.4|2\.0|2\.1)/gi,
    )) {
      versions.push(Number(m[1]))
    }
    const counts = [
      ...[...line.matchAll(/(\d)\s*[x×]\s*hdmi/gi)].map((m) => Number(m[1])),
      ...[...line.matchAll(/hdmi[^,;/|]*?[x×]\s*(\d)\b/gi)].map((m) => Number(m[1])),
    ]
    if (counts.length) listed.push(counts.reduce((a, b) => a + b, 0))
    else if (
      /hdmi/i.test(label) &&
      !/c[aâ]ble|hdcp|version/i.test(label) &&
      /^\d\s*(ea|x|ports?)?$/i.test(value)
    ) {
      byLabel.set(label, Number(value[0]))
    }
  }
  // Dell lists the same ports three ways; its "Nombre total de ports HDMI" settles it.
  const total = [...byLabel].find(([label]) => /total/i.test(label))?.[1]
  const rows = total ?? [...byLabel.values()].reduce((a, b) => a + b, 0)
  const version = highest(versions)
  // A row that only says the port is there ("HDMI: Oui 2.3", LG's HDCP version): one port.
  const named = lines.some(({ label, value }) => /^hdmi\b/i.test(label) && said(value))
  return {
    ports:
      total ??
      highest([...listed, rows].filter(Boolean)) ??
      (versions.length || named ? 1 : undefined),
    version: version ? (version.toFixed(1) as Specs['hdmiVersion']) : undefined,
  }
}

function dpOf(lines: Entry[]): { version?: Specs['dpVersion']; note?: string } {
  const versions: number[] = []
  for (const { label, value } of lines) {
    for (const m of `${label}: ${value}`.matchAll(
      /(?:displayport|\bdp\b)\s*(?:version\s*)?(?:\(\s*v?\s*|v\s*|:\s*(?:(?:oui|yes)\s*)?\(?\s*(?:ver\s*)?)?(1\.2|1\.4|2\.0|2\.1)/gi,
    )) {
      versions.push(Number(m[1]))
    }
  }
  const v = highest(versions)
  if (!v) return {}
  if (v === 2)
    return { version: '2.1', note: 'DisplayPort 2.0 rangé en 2.1 (même génération UHBR)' }
  return { version: v.toFixed(1) as Specs['dpVersion'] }
}

/** Watts a USB-C (or Thunderbolt) port delivers to a laptop. */
function usbcPowerOf(lines: string[]): number {
  const watts = lines
    .filter(
      (l) =>
        /usb[\s-]?c|type[\s-]?c|thunderbolt|power\s*delivery|\bpd\b/i.test(l) &&
        !/haut-?parleur|speaker|consommation|consumption|veille|standby|alimentation (interne|externe|électrique)/i.test(
          l,
        ),
    )
    .flatMap((l) => [...l.matchAll(/(\d{1,3})\s*w\b/gi)].map((m) => Number(m[1])))
    .filter((w) => w >= 5 && w <= 240)
  return highest(watts) ?? 0
}

/** Travel of the stand in mm, and whether it goes up and down at all. */
function heightOf(facts: Facts) {
  let mm = 0
  let adjustable = false
  for (const e of entries(facts, LABEL.height)) {
    if (!said(e.value)) continue
    const range = /(\d{1,3})\s*(?:mm)?\s*[~–-]\s*(\d{2,3})\s*(mm|cm)?/i.exec(e.value)
    const single = /(\d{2,3})(?:[.,]\d)?\s*(?:\([^)]*\)\s*)?(mm|cm)?/i.exec(e.value)
    const travel = range
      ? Number(range[2]) - Number(range[1]) * (Number(range[1]) < Number(range[2]) ? 1 : 0)
      : single
        ? Number(single[1])
        : 0
    const unit = (range?.[3] ?? single?.[2] ?? (/cm/.test(e.key) ? 'cm' : 'mm')).toLowerCase()
    const value = unit === 'cm' ? travel * 10 : travel
    adjustable = true
    if (value >= 20 && value <= 300) mm = Math.max(mm, Math.round(value))
  }
  return { mm, adjustable }
}

function weightOf(facts: Facts): number | undefined {
  const list = entries(facts, LABEL.weight).filter(
    (e) => !/brut|gross|carton|avecemballage|withpackag|sans|without/.test(e.key),
  )
  const withStand = list.find((e) => /avec|with|ensemble|support/.test(e.key)) ?? list[0]
  if (!withStand) return undefined
  // "8.3 / 10.9 kg": net, then gross.
  const value = n(withStand.value.split('/')[0])
  if (value == null) return undefined
  const unit =
    /\b(kg|g)\b/i.exec(withStand.value)?.[1] ??
    (/kg/.test(withStand.key) || value < 50 ? 'kg' : 'g')
  const grams = unit.toLowerCase() === 'kg' ? value * 1000 : value
  return grams >= 1500 && grams <= 40_000 ? Math.round(grams) : undefined
}

/**
 * The specs of a monitor from its sheet (and, for a few words, its name and description). Throws
 * Skip for a product the finder does not take: no size or resolution, a portable screen, an aspect
 * ratio it does not list.
 */
export function monitorSpecsOf(
  facts: Facts,
  { name, text = '' }: { name: string; text?: string },
): { specs: Specs; notes: string[] } {
  const notes: string[] = []
  const all = facts.list.map((f) => ({
    key: labelKey(f.label),
    label: clean(f.label),
    value: clean(f.value),
  }))
  // What the product has: the lines whose value is not a "no", then the name and description.
  const yes = all.filter((e) => said(e.value))
  const yesText = [...yes.map((e) => `${e.label}: ${e.value}`), clean(name), clean(text)].join('\n')

  const res = resolutionOf(facts)
  const diagonalIn = diagonalOf(facts, name, res)
  if (!diagonalIn) throw new Skip('diagonale introuvable')
  if (diagonalIn < 20)
    throw new Skip(`moins de 20 pouces : écran portable ou d'appoint (${diagonalIn}")`)
  // Past the 57" super ultrawides, a "monitor" is a meeting-room or signage display.
  if (diagonalIn > 57.5) throw new Skip(`affichage de salle de réunion (${diagonalIn}")`)
  if (!res) throw new Skip('définition introuvable')
  const [resW, resH] = res
  const aspect = aspectOf(resW, resH)
  if (!aspect) throw new Skip(`format ${resW}×${resH} non pris en charge`)

  const panelText = [
    ...entries(facts, LABEL.panel).map((e) => e.value),
    // Samsung puts the Mini-LED backlight in a row of its own ("Mini LED Local Dimming: Oui").
    ...yes.filter((e) => /miniled/.test(e.key)).map((e) => e.label),
  ].join(' ; ')
  const read = panelOf(panelText || clean(name))
  if (!read.panel) throw new Skip(`dalle introuvable (${panelText || '—'})`)
  const panel = /oled/i.test(panelText) && /quantum\s*dot/i.test(yesText) ? 'qdoled' : read.panel
  if (read.note && panel === read.panel) notes.push(read.note)
  const oled = panel === 'woled' || panel === 'qdoled'

  const refresh = refreshOf(facts, resH, clean(name))
  if (!refresh.max) throw new Skip('fréquence introuvable')

  const curveEntries = entries(facts, LABEL.curvature)
  const radius = /\b(\d{3,4})\s*r\b/i.exec(
    plainNumber(
      [
        ...curveEntries.map((e) => e.value),
        ...all.filter((e) => /courbure|curv/i.test(e.value)).map((e) => e.value),
        clean(name),
      ].join(' ; '),
    ),
  )
  const curved =
    radius != null ||
    curveEntries.some((e) => /incurv|curved|courb|^oui|^yes/i.test(e.value) && said(e.value))
  if (curved && !radius) notes.push('incurvé sans rayon indiqué : 1800R supposé')

  const coatingText = [
    ...entries(facts, LABEL.coating).map((e) => e.value),
    ...yes.filter((e) => /glarefree/.test(e.key)).map(() => 'anti-glare'),
  ].join(' ; ')
  const coating: Specs['coating'] = /semi[\s-]*(gloss|brillant)/i.test(coatingText)
    ? 'semi'
    : /brillant|glossy|lustr/i.test(coatingText) && !/anti/i.test(coatingText)
      ? 'glossy'
      : 'matte'
  if (!coatingText && panel === 'qdoled') notes.push('revêtement non indiqué : mat supposé')

  const { sdr, peak } = brightnessOf(facts, oled)
  const gamut = gamutOf(facts)
  const colourText = all
    .filter((e) => /couleur|colou?r|bit|profondeur|depth/.test(e.key))
    .map((e) => `${e.label}: ${e.value}`)
    .join(' ; ')
  // On one line: a resolution ending a line must not pair with "Zone d'affichage" below it.
  const zones = /(\d[\d,. ]{1,6}?)[ \t]*zones?\b(?!\s*d['’]affichage)/i.exec(yesText)
  const deltaE =
    /(?:delta\s*e|Δ\s*e|△\s*e)\s*(?:\(avg\)|moyen)?\s*[:=]?\s*(?:<|≤|≦|<=)\s*(\d(?:[.,]\d)?)/i.exec(
      yesText,
    )
  const factoryCalibrated =
    /calibr\S*\s*(en\s*)?usine|factory[\s-]*calibrat|pr[ée][\s-]*calibr|rapport de calibration|calibration report|uniformity report/i.test(
      yesText,
    ) ||
    (deltaE != null && (n(deltaE[1]) ?? 9) <= 2)

  const ports = hdmiOf(all.filter((e) => said(e.value)))
  const dp = dpOf(yes)
  if (dp.note) notes.push(dp.note)
  const usbcPdW = usbcPowerOf(yes.map((e) => `${e.label}: ${e.value}`))
  const stand = heightOf(facts)
  const tiltEntries = entries(facts, LABEL.tilt)
  const vesaEntries = all.filter(
    (e) =>
      (LABEL.vesa.test(e.key) && !/hdr|sync/.test(e.key)) ||
      /(fixation|montage|support|norme)[^:]{0,20}vesa|vesa\s*\(?\s*\d{2,3}\s*[x×]\s*\d{2,3}/i.test(
        e.value,
      ),
  )
  if (!vesaEntries.length) notes.push('fixation VESA non indiquée : supposée')
  const vesa = vesaEntries.length ? vesaEntries.some((e) => said(e.value)) : true
  const speakerEntries = entries(facts, LABEL.speakers)

  const specs: Specs = {
    diagonalIn,
    aspect,
    resW,
    resH,
    panel,
    dimmingZones: zones ? n(zones[1]) : undefined,
    curvatureR: curved ? (radius ? Number(radius[1]) : 1800) : undefined,
    coating,
    refreshHzMax: refresh.max,
    dualModeHz: refresh.dual,
    responseGtgMs: responseOf(facts),
    vrr: vrrOf(yesText),
    hdrCert: hdrOf(yesText),
    brightnessSdrNits: sdr,
    brightnessHdrPeakNits: peak,
    contrastStatic: contrastOf(facts),
    dciP3Pct: gamut.p3,
    srgbPct: gamut.srgb,
    bitDepth: bitDepthOf(colourText),
    factoryCalibrated,
    hdmiPorts: ports.ports ?? 1,
    hdmiVersion: ports.version,
    dpVersion: dp.version,
    usbcPdW,
    thunderbolt: yes.some((e) => /thunderbolt/i.test(`${e.key} ${e.value}`)),
    kvm: /\bkvm\b/i.test(yesText),
    usbHub:
      /hub\s*usb|usb\s*hub|concentrateur\s*usb|usb[^:\n]*(aval|descendant)|downstream|\d\s*x\s*usb[\s-]?a\b|usb[\s-]?a\s*x\s*\d/i.test(
        yesText,
      ),
    speakers: speakerEntries.some((e) => said(e.value)),
    standHeightMm: stand.mm,
    heightAdjustable: stand.adjustable,
    tilt: tiltEntries.length ? tiltEntries.some((e) => said(e.value)) : true,
    swivel: entries(facts, LABEL.swivel).some((e) => said(e.value)),
    pivot: entries(facts, LABEL.pivot).some((e) => said(e.value)),
    vesa,
    weightG: weightOf(facts),
  }
  if (specs.hdmiPorts === 1 && !ports.ports) notes.push('HDMI non trouvé dans la fiche')
  return { specs, notes }
}
