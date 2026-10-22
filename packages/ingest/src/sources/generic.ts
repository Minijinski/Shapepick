import type { KeyboardInput, ProductImage } from '@choose/catalog'
import type { Facts } from '../facts'
import { num } from '../facts'
import { earliest, familyOf, hzOf, joined, layoutIn, MATERIAL, PLATE, PROFILES } from '../mapping'
import { median, priceVariants, roundPrice } from '../prices'
import { listPrice, optionsOf, productUrl, type ShopifyProduct } from '../shopify'
import { type Draft, Skip } from '../source'
import type { SwitchResolver } from '../switches'

// Shopify listings → our schema, for shops without a mapper of their own: mechanicalkeyboards.com,
// brand stores (Epomaker, Womier, Yunzii…), and the official brand sites (Logitech, Corsair, Razer),
// whose pages are first turned into the same shape (official.ts). Everything is read from what such listings share:
// a spec sheet (Facts: "Characteristics" rows, tables, "Label: value" lines, under labels that vary
// from shop to shop, hence the alternations), the tags, the title, and variant options.

type Specs = KeyboardInput['specs']
type Variant = KeyboardInput['variants'][number]

export type Listing = {
  product: ShopifyProduct
  facts: Facts
  text: string
  origin: string
  /** The page itself, when it is not a Shopify /products/<handle> page. */
  url?: string
}
export type GenericModel = {
  brand: string
  brandName: string
  name: string
  slug: string
  listings: Listing[]
  /** When the source knows it; otherwise the year the listing went online. */
  releaseYear?: number
}
export type Hooks = {
  /** Colour a listing stands for when it is one colourway of a model (mechanicalkeyboards.com). */
  colorway?: (l: Listing) => string | undefined
  /** Dollars (or the shop's currency) to euros, VAT included. */
  toEur: (price: number) => number
  /** The shop's currency, USD by default: only dollar prices fill msrpUsd. */
  currency?: 'USD' | 'EUR'
}

// Labels are compared lowercased, accents and punctuation dropped ("Taille du Clavier" →
// tailleduclavier); French ones come from the official French sites.
export const LABEL = {
  keyCount:
    /^(keycount|totalkeys|numberofkeys|keys|keynumber|numberofkey|keyboardmatrix|nombredetouches)$/,
  size: /^(size|layout|formfactor|keyboardlayout|layoutsize|sizefulltkl|tailleduclavier|tailleapproximative|taille|format|typedeclavier)$/,
  type: /^(pcbtype|switchtype|type|switchtechnology|technology|typedeswitch|typedetouches|switchestouches|keyswitches)$/,
  interface:
    /^(interface|connection(types?|mode|modes)?|connectivity|connectionmethod|modes?|wireless|keyboardconnectivity|wirelessconnectivity|connectivite|typedeconnexion)$/,
  hotswap: /hotswap|remplacablesachaud/,
  caseMaterial:
    /^(topmaterial|bottommaterial|casematerial|case|frame|framematerial|shell|housing|materiau|materiaux)$/,
  keycaps: /^(keycapmaterial|keycaps?|keycapsmaterial|material|keycapprofile|profile|touches)$/,
  light:
    /^(backlighting|backlight|rgb|lighting|light|rgbsupport|keyboardbacklighting|eclairage|retroeclairage|chromargb)$/,
  direction: /switchdirection|^(rgb|lighting|backlight|rgbsupport)$/,
  system:
    /^(maccompatible|ossupport|os|compatibility|compatiblesystem|system|systemcompatibility|keyboardcompatibility|compatibilite|configurationrequise|plateforme)$/,
  polling: /pollingrate|reportrate|frequencedinterrogation|tauxdinterrogation/,
  weight: /weight|poids/,
  dims: /^(dimensions?|sizeofproduct|productsize|productdimensions?|keyboarddimensions?)$/,
  mount: /^(mount(ing)?style|structure|mount|mountingstructure|mounting)$/,
  battery: /^(battery|batterie|typedebatterie|autonomie)/,
  plate: /^(platematerial|plate|positioningplate)$/,
  color: /^(colou?r|couleur|couleurdesign)$/,
  switch: /^(switch(es|type|choices|option)?|typedeswitch|keyswitches|switchestouches)$/,
  wristRest: /reposepoignet|wristrest|palmrest/,
}

const yes = (s: string | undefined) => !!s && !/^(no|none|n\/a|non)\b/i.test(s)

const LAYOUT_PCTS = new Set([
  40, 45, 60, 61, 64, 65, 66, 67, 68, 70, 75, 80, 84, 85, 87, 90, 96, 98, 99, 100,
])

/** Size from a percentage (title, then sheet), else the key count, else size words. */
export function sizeOf(facts: Facts, product: ShopifyProduct): Specs['formFactor'] | undefined {
  const title = product.title
  const named = `${title} ${product.tags.filter((t) => /^(split|alice)$/i.test(t)).join(' ')}`
  if (/\balice\b/i.test(named)) return 'alice'
  if (/\bsplit\b(?!\s*space)/i.test(named) && !/split spacebar/i.test(named)) return 'split'
  const sizeFact = facts.first(LABEL.size) ?? ''
  const tags = product.tags.join(' ; ')
  // Layout percentages only: tags also carry promotions ("15%OFF").
  const pctIn = (s: string) =>
    [...s.matchAll(/\b(\d{2,3})\s*%(?!\s*off)/gi)]
      .map((m) => Number(m[1]))
      .find((n) => LAYOUT_PCTS.has(n))
  const pct = pctIn(title) ?? pctIn(sizeFact) ?? pctIn(tags)
  if (pct) {
    if (pct <= 45) return 'f40'
    if (pct <= 62) return 'f60'
    if (pct <= 70) return 'f65'
    if (pct <= 78) return 'f75'
    if (pct <= 90) return 'tkl'
    if (pct <= 99) return 'f96'
    return 'full'
  }
  const keys =
    num(facts.first(LABEL.keyCount)) ??
    num(/(\d{2,3})[- ]keys?\b/i.exec(`${title} ${sizeFact}`)?.[1])
  if (keys && keys >= 30) {
    if (keys <= 52) return 'f40'
    if (keys <= 64) return 'f60'
    if (keys <= 73) return 'f65'
    if (keys <= 85) return 'f75'
    if (keys <= 92) return 'tkl'
    if (keys <= 101) return 'f96'
    if (keys <= 110) return 'full'
  }
  const size = joined([sizeFact, product.product_type, title, tags])
  if (/tenkeyless|\btkl\b|sans pav[ée] num[ée]rique/i.test(size)) return 'tkl'
  if (/\b75\s?%/.test(size)) return 'f75'
  if (
    /full[- ]?size|taille r[ée]elle|pleine taille|grande taille|extended|standard \(100/i.test(size)
  ) {
    return 'full'
  }
  if (/compact/i.test(size)) return 'f60'
  // Last resort, a size in the model name ("VANGUARD 96", "Alloy Rise 75", "Origins 2 1800").
  const inName = Number(/\b(60|61|65|68|75|80|87|96|98|99|100|1800)\b/.exec(title)?.[1])
  if (inName === 1800) return 'f96'
  if (inName)
    return pctIn(`${inName}%`)
      ? sizeOf(facts, { ...product, title: `${title} ${inName}%` })
      : undefined
  return undefined
}

function imagesOf(listings: Listing[]): ProductImage[] {
  const out: ProductImage[] = []
  for (const { product } of listings) {
    // One picture per listing, plus one per colour when a listing carries several.
    const firsts = new Map<number, (typeof product.images)[number]>()
    const lead = product.images[0]
    if (lead) firsts.set(lead.id, lead)
    for (const v of product.variants) {
      if (v.featured_image && firsts.size < 4) firsts.set(v.featured_image.id, v.featured_image)
    }
    for (const img of firsts.values()) {
      out.push({
        url: img.src,
        kind: 'cutout_top',
        width: img.width || undefined,
        height: img.height || undefined,
      })
    }
  }
  const [first] = out
  if (first) first.primary = true
  return out.slice(0, 6)
}

export async function mapListings(
  model: GenericModel,
  resolver: SwitchResolver,
  hooks: Hooks,
): Promise<Draft> {
  const notes: string[] = []
  const [main] = model.listings
  if (!main) throw new Skip('aucune fiche')
  // Every listing's sheet, the first listing's first: lookups return its values before the others'.
  const f = model.listings.slice(1).reduce((acc, l) => acc.merge(l.facts), main.facts)
  const title = main.product.title
  const tags = new Set(model.listings.flatMap((l) => l.product.tags.map((t) => t.toLowerCase())))
  const all = joined(
    model.listings.flatMap((l) => [l.product.title, l.text, ...l.product.tags, f.text]),
  )

  const formFactor = sizeOf(f, main.product)
  if (!formFactor)
    throw new Skip(`taille introuvable (${f.first(LABEL.size) ?? main.product.product_type})`)

  const typeText = joined([f.first(LABEL.type), title, ...tags])
  const magnetic =
    /magnetic|hall[- ]effect|\bHE\b|\b[A-Z]*\d+HE\b|inductive|\bhall\b|\bTMR\b/i.test(typeText)
  const topre =
    /topre|realforce|hhkb/i.test(`${title} ${model.brandName}`) ||
    /topre/i.test(f.first(LABEL.switch) ?? '')
  const technology: Specs['technology'] = magnetic
    ? 'magnetic'
    : topre
      ? 'topre'
      : /optical|optique/i.test(typeText)
        ? 'optical'
        : /scissor|ciseaux/i.test(typeText)
          ? 'scissor'
          : /membrane|rubber dome|m[ée]ca-membrane/i.test(typeText)
            ? 'membrane'
            : 'mechanical'
  // Analog sensing (Hall effect, Razer's analog optical switches) is what allows rapid trigger.
  const analog = magnetic || (technology === 'optical' && /analog/i.test(all))
  if (/inductive/i.test(title)) notes.push('switchs inductifs (analogiques) rangés en magnétique')

  const interfaceFact = f.first(LABEL.interface) ?? ''
  const interfaces = joined([interfaceFact, ...tags, title, main.text])
  // Brands name their 2.4 GHz link: Logi Bolt, Lightspeed, Slipstream, HyperSpeed…
  const conn24ghz =
    /2[.,]4\s*g|tri-?mode|dongle|receiver|r[ée]cepteur|logi ?bolt|lightspeed|slipstream|hyperspeed|quantum 2/i.test(
      interfaces,
    )
  const connBt = /bluetooth|tri-?mode|\bbt\s*5/i.test(interfaces)
  const wirelessOnly = /wireless/i.test(interfaceFact) && !conn24ghz && !connBt
  if (wirelessOnly) notes.push('« sans fil » sans précision : Bluetooth supposé')
  const btDevices = num(/(?:up to|connect(?:s)?(?: up to)?)\s+(\d)\s+devices/i.exec(all)?.[1])

  // A "0 Hz" read (a latency figure, a typo) is no polling rate at all.
  const polling =
    hzOf(f.first(LABEL.polling) ?? '') ||
    hzOf(/(\d+\s*k?hz)\s+polling/i.exec(all)?.[1] ?? '') ||
    undefined
  const range = /(\d+(?:\.\d+)?)\s*mm?\s*(?:-|–|~|to)\s*(\d+(?:\.\d+)?)\s*mm/i.exec(all)
  const hotFact = f.first(LABEL.hotswap)
  const hot = hotFact
    ? yes(hotFact)
    : tags.has('hot-swap') || tags.has('hotswap') || /hot-?swap/i.test(title)
  const mountText = joined([f.first(LABEL.mount), all]).toLowerCase()
  const caseText = joined([...f.all(LABEL.caseMaterial), title, ...tags])
  const caseMaterial =
    /alumin|cnc/i.test(caseText) && !/plastic frame|abs frame/i.test(caseText)
      ? 'aluminum'
      : (earliest(caseText, MATERIAL) ?? 'plastic')
  const keycaps = joined([...f.all(LABEL.keycaps), title, main.text])
  const lightFact = f.first(LABEL.light)
  const light = joined([lightFact, title, ...tags])
  const weightText =
    f.first(LABEL.weight) ??
    /weigh(?:t|s)[^\d]{0,12}(\d+(?:[.,]\d+)?\s*(?:kg|g|lbs?))\b/i.exec(all)?.[1] ??
    ''
  const weightM = /(\d+(?:[.,]\d+)?)\s*(kg|g|lbs?)\b/i.exec(weightText)
  const rawWeight = weightM?.[1]
    ? Number(weightM[1].replace(',', '.')) *
      (/kg/i.test(weightM[2] ?? '') ? 1000 : /lb/i.test(weightM[2] ?? '') ? 453.6 : 1)
    : undefined
  // A keyboard weighs more than 250 g: smaller figures are keycaps, springs or switches.
  const weight = rawWeight && rawWeight >= 250 && rawWeight < 5000 ? rawWeight : undefined
  const dimsText = f.first(LABEL.dims) ?? all
  const dims =
    /(\d{3}(?:\.\d+)?)\s*(?:mm)?\s*[x×*]\s*(\d{2,3}(?:\.\d+)?)(?:\s*[x×*]\s*\d+(?:\.\d+)?)?\s*mm/i.exec(
      dimsText,
    )
  const heightFront = num(/(\d+(?:\.\d+)?)\s*mm front height/i.exec(all)?.[1])
  const angle = num(/(\d+(?:\.\d+)?)\s*°\s*typing angle/i.exec(all)?.[1])
  const battery = num(
    /(\d{1,2}[,.]\d{3}|\d{3,5})\s*mah/i
      .exec(joined([f.first(LABEL.battery), all]))?.[1]
      ?.replace(/[,.]/, ''),
  )

  const specs: Specs = {
    formFactor,
    technology,
    lowProfile: /low[- ]profile/i.test(`${title} ${[...tags].join(' ')}`),
    hotSwap: !hot
      ? 'none'
      : magnetic
        ? 'magnetic'
        : /3[- ]pin/i.test(all) && !/5[- ]pin/i.test(all)
          ? '3pin'
          : '5pin',
    connWired: true,
    conn24ghz,
    connBt: connBt || wirelessOnly,
    btDevices: connBt ? btDevices : undefined,
    pollingHzWired: polling,
    pollingHzWireless: conn24ghz && polling && polling <= 1000 ? polling : undefined,
    rapidTrigger: analog && /rapid trigger|d[ée]clenchement rapide/i.test(all),
    adjustableActuation:
      analog && /actuation|point d.activation|actionnement r[ée]glable/i.test(all),
    minActuationMm: analog && range?.[1] && Number(range[1]) < 2 ? Number(range[1]) : undefined,
    mount: /gasket/.test(mountText)
      ? 'gasket'
      : /tray[- ]mount/.test(mountText)
        ? 'tray'
        : /top[- ]mount/.test(mountText)
          ? 'top'
          : /sandwich/.test(mountText)
            ? 'sandwich'
            : /plateless/.test(mountText)
              ? 'plateless'
              : undefined,
    caseMaterial,
    plateMaterial: earliest(f.first(LABEL.plate) ?? '', PLATE),
    keycapMaterial: /pbt/i.test(keycaps) ? 'pbt' : /\bpom\b/i.test(keycaps) ? 'pom' : 'abs',
    keycapProfile: earliest(keycaps, PROFILES),
    backlight: /rgb/i.test(light)
      ? 'rgb'
      : /led|white|backlit/i.test(light) && yes(lightFact ?? 'yes')
        ? 'white'
        : 'none',
    southFacing: f.all(LABEL.direction).some((d) => /south/i.test(d)) || tags.has('south-facing'),
    knob: /\bknob\b|rotary|\bdial\b/i.test(all),
    screen: /\b(lcd|tft)\b|built-in (screen|display)|\b(smart|color|oled) (screen|display)\b/i.test(
      all,
    ),
    firmware: /\bZMK\b/.test(all)
      ? 'zmk'
      : /\bVIAL\b/i.test(all)
        ? 'vial'
        : /\bQMK\b/.test(all)
          ? 'qmk'
          : /\bVIA\b/.test(all)
            ? 'via'
            : 'proprietary',
    macSupport:
      /mac/i.test(joined(f.all(LABEL.system))) || tags.has('mac') || /\bmacos\b/i.test(all),
    batteryMah: battery || undefined,
    wristRestIncluded:
      /^(yes|oui|included|inclus)/i.test(f.first(LABEL.wristRest) ?? '') ||
      /(includes?|with)\s+(a\s+)?(magnetic\s+)?(wrist|palm)\s+rest/i.test(all),
    soundDampening: /foam|dampen|poron|silicone pad|sound absorb/i.test(all),
    weightG: weight ? Math.round(weight) : undefined,
    widthMm: dims ? Math.round(Math.max(Number(dims[1]), Number(dims[2]))) : undefined,
    depthMm: dims ? Math.round(Math.min(Number(dims[1]), Number(dims[2]))) : undefined,
    heightFrontMm: heightFront,
    typingAngleDeg: angle !== undefined && angle <= 20 ? angle : undefined,
  }

  // Variants: every listing × its options (colour, switch, layout).
  const variants: Variant[] = []
  const switchSlugs = new Map<string, string | undefined>()
  for (const l of model.listings) {
    const colorway = hooks.colorway?.(l)
    const listingLayout =
      layoutIn(joined([...l.facts.all(/layout/), ...l.product.tags])) ?? ('ansi_us' as const)
    if (listingLayout === null) continue
    for (const v of l.product.variants) {
      if (!v.available) continue
      const options = optionsOf(l.product, v)
      const values = Object.values(options).join(' | ')
      if (/barebone|\bkit\b|^none$|\|\s*none\b/i.test(values)) continue
      const layout = layoutIn(values)
      if (layout === null) continue
      const color =
        Object.entries(options).find(([k]) => /colou?r/i.test(k))?.[1] ??
        colorway ??
        l.facts.first(LABEL.color) ??
        'Black'
      const swFact = l.facts.first(LABEL.switch)
      // A sheet's "Switch:" line is sometimes a sentence ("Hot-swappable; supports 3-pin and 5-pin").
      const swName =
        Object.entries(options).find(([k]) => /switch/i.test(k))?.[1] ??
        (swFact && !/hot-?swap|support|\bpins?\b|;|\//i.test(swFact) ? swFact : undefined)
      let sw: string | undefined
      // Topre domes, membranes and scissors have no switch record to point to.
      if (swName && !['topre', 'membrane', 'scissor'].includes(technology)) {
        if (!switchSlugs.has(swName)) {
          const res = await resolver.resolve(swName)
          switchSlugs.set(swName, res.slug)
          if (!res.slug && res.note) notes.push(res.note)
        }
        sw = switchSlugs.get(swName)
      }
      variants.push({
        sku: v.sku ?? undefined,
        colorName: color,
        colorFamily: familyOf(color),
        layout: layout ?? listingLayout,
        switch: sw,
        msrpEur: hooks.toEur(listPrice(v)),
      })
    }
  }
  const byKey = new Map<string, Variant>()
  for (const v of variants) {
    const key = `${v.colorName}|${v.layout}|${v.switch ?? ''}`
    const prev = byKey.get(key)
    if (!prev || (v.msrpEur ?? 0) < (prev.msrpEur ?? 0)) byKey.set(key, v)
  }
  if (!byKey.size) throw new Skip('aucune variante en stock')
  const priced = priceVariants([...byKey.values()])
  const usd =
    hooks.currency === 'EUR'
      ? []
      : model.listings.flatMap((l) => l.product.variants.filter((v) => v.available).map(listPrice))

  const years = model.listings
    .map((l) => Number(l.product.created_at.slice(0, 4)))
    .filter((y) => y >= 1990)
  const input: KeyboardInput = {
    slug: model.slug,
    brand: model.brand,
    name: model.name,
    releaseYear: model.releaseYear ?? (years.length ? Math.min(...years) : undefined),
    status: 'active',
    msrpEur: priced.msrpEur ?? 0,
    msrpUsd: usd.length ? roundPrice(median(usd)) : undefined,
    popularity: 0.5,
    editorialScore: 0.5,
    images: imagesOf(model.listings),
    sources: model.listings.map((l) => l.url ?? productUrl(l.origin, l.product.handle)),
    specs,
    variants: priced.variants,
  }
  return { input, notes: [...new Set(notes)] }
}

// ─── Titles ──────────────────────────────────────────────────────────────────────────────────────

/** Words that end a model name or a colourway in a title. */
export const DESCRIPTOR =
  /^(hot-?swap(pable)?|rgb|led|double|triple|shot|pbt|abs|mechanical|keyboard|wireless|bluetooth|tri-mode|aluminum|aluminium|cnc|prebuilt|gaming|magnetic|rapid|low|profile|mac|w\/|quack|inductive|full|size|tenkeyless|compact|dye|sub|white-led|blue-led|\d+%|\d+-key|\d+k|topre|silent|hall|effect|he|wired|qmk|via|qmk\/via|vial|zmk|iso|ansi|layout|de&fr|azerty|-|—|–)$/i
/** Size and version words that belong to the model name ("One 3 Mini Pro", "QK100 Mk2"). */
export const MODEL_SUFFIX =
  /^(tkl|mini|sf|pro|lite|plus|max|se|v\d|mk\d|\d{2,3}|x|s|ii|iii|2|3|4)$/i

/** The title after the brand ("Topre Realforce R3S…", "ATK X Qwertykeys Hex80…" → "R3S…", "Hex80…"). */
export function titleWords(title: string, vendor: string) {
  const at = title.toLowerCase().indexOf(`${vendor.toLowerCase()} `)
  return (at >= 0 ? title.slice(at + vendor.length) : title).split(/\s+/).filter(Boolean)
}

/** Model name and colourway from a title, helped by the sheet's Series when there is one. */
export function nameOf(title: string, vendor: string, series?: string) {
  const words = titleWords(title, vendor)
  const seriesWords = new Set((series ?? '').toLowerCase().split(/\s+/).filter(Boolean))
  let start = words.findIndex((w) => seriesWords.has(w.toLowerCase()))
  if (start < 0) start = 0
  const name: string[] = []
  let i = start
  for (; i < words.length; i++) {
    const w = words[i] as string
    const inSeries = seriesWords.has(w.toLowerCase())
    if (name.length && !inSeries && !MODEL_SUFFIX.test(w)) break
    if (DESCRIPTOR.test(w) && !inSeries) break
    name.push(w)
  }
  const color: string[] = []
  for (; i < words.length; i++) {
    const w = words[i] as string
    if (DESCRIPTOR.test(w)) break
    color.push(w)
  }
  return { name: name.join(' '), colorway: color.join(' ') || undefined }
}

/** Appended to a name two sizes share ("One 3" full-size and "One 3 60%"). */
export const SIZE_LABEL: Record<Specs['formFactor'], string> = {
  full: '',
  f96: '96%',
  tkl: 'TKL',
  f75: '75%',
  f65: '65%',
  f60: '60%',
  f40: '40%',
  split: 'Split',
  alice: 'Alice',
  numpad: 'Numpad',
}
