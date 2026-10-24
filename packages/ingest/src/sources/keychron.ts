import type { Brand, KeyboardInput, ProductImage } from '@choose/catalog'
import { Facts, linesOf, num, parseHtml } from '../facts'
import { earliest, familyOf, hzOf, joined, layoutIn, MATERIAL, PLATE, PROFILES } from '../mapping'
import { EUR_PER_USD, median, priceVariants, roundPrice } from '../prices'
import {
  listPrice,
  listProducts,
  optionsOf,
  productPage,
  productUrl,
  type ShopifyProduct,
  type ShopifyVariant,
} from '../shopify'
import { type Draft, Skip, type Source } from '../source'
import type { SwitchResolver } from '../switches'
import { fromFrench, slugify } from '../text'

// Keychron (and its gaming brand Lemokey) from keychron.com's "keyboard finder" collection.
// - One model per name: the main listing (US ANSI) carries the spec sheet; "ISO Layout Collection"
//   and "Japan JIS Layout" listings of the same name only add variants.
// - Specs come from Shopify tags (LayoutSize:75%, MountStyle:Gasket Mount…), the "Key specs" list
//   of the description and the spec table of the product page, in that order of trust.
// - Euro prices come from keychron.fr, matched by SKU. keychron.fr also sells the AZERTY (FR-ISO)
//   variants keychron.com lacks, so its listings of the same model add variants too.
// Anything inferred rather than read ends up in `notes`, written above the entry for review.

const US = 'https://www.keychron.com'
const FR = 'https://keychron.fr'

type Specs = KeyboardInput['specs']
type Variant = KeyboardInput['variants'][number]
type Kind = 'main' | 'iso' | 'jis'

export type Model = {
  brand: 'keychron' | 'lemokey'
  name: string
  slug: string
  alice: boolean
  listings: { product: ShopifyProduct; kind: Kind }[]
}

export const brands: Record<Model['brand'], Brand> = {
  keychron: { slug: 'keychron', name: 'Keychron', website: 'https://www.keychron.com' },
  lemokey: { slug: 'lemokey', name: 'Lemokey', website: 'https://www.lemokey.com' },
}

// ─── Models ──────────────────────────────────────────────────────────────────────────────────────

const DESCRIPTOR =
  /^(qmk|via|qmk\/via|wireless|wired|custom|mechanical|magnetic|keyboard|ultra-slim|optical|gaming|hall|ergonomic|switch)$/i

/** "Keychron K10 QMK Wireless Mechanical Keyboard (ISO Layout) - Version 2" → K10 Version 2, iso. */
export function parseTitle(title: string) {
  const m = /^(Keychron|Lemokey)\s+(.+)$/.exec(title.trim())
  if (
    !m?.[1] ||
    !m[2] ||
    /bundle|number pad|numpad|macro pad|custom order|deposit|gift card/i.test(title)
  )
    return undefined
  const extras: string[] = []
  const rest = m[2].replace(/\(([^)]*)\)/g, (_, inner: string) => {
    extras.push(inner)
    return ' '
  })
  const [head = '', ...tails] = rest.split(/\s+[-–]\s+/)
  extras.push(...tails)
  const core: string[] = []
  for (const word of head.trim().split(/\s+/)) {
    if (DESCRIPTOR.test(word)) break
    core.push(word)
  }
  if (!core.length) return undefined
  const kept = extras.map((e) => e.trim()).filter((e) => e && !/\b(layout|iso|jis|ansi)\b/i.test(e))
  return {
    brand: m[1].toLowerCase() as Model['brand'],
    name: [core.join(' '), ...kept].join(' ').replace(/\s+/g, ' '),
    kind: (/\bJIS\b/.test(title) ? 'jis' : /\bISO\b/.test(title) ? 'iso' : 'main') as Kind,
    alice: /\balice\b/i.test(title),
  }
}

/** Models in the order keychron.com's finder lists them, which is the order batches follow. */
export async function loadModels(): Promise<Model[]> {
  const models = new Map<string, Model>()
  for (const product of await listProducts(US, 'keyboard-finder')) {
    const t = parseTitle(product.title)
    if (!t) continue
    const slug = slugify(`${t.brand} ${t.name}`)
    const model = models.get(slug) ?? { ...t, slug, listings: [] }
    model.alice ||= t.alice
    model.listings.push({ product, kind: t.kind })
    models.set(slug, model)
  }
  return [...models.values()].filter((m) => m.listings.some((l) => l.kind === 'main'))
}

let frStore: Promise<{ products: ShopifyProduct[]; bySku: Map<string, ShopifyVariant> }> | undefined
const loadFr = () =>
  (frStore ??= listProducts(FR).then((products) => ({
    products,
    bySku: new Map(
      products.flatMap((p) => p.variants.flatMap((v) => (v.sku ? [[v.sku, v] as const] : []))),
    ),
  })))

// ─── Variants ────────────────────────────────────────────────────────────────────────────────────

type Raw = {
  options: Record<string, string>
  kind: Kind
  sku?: string
  usd?: number
  eur?: number
}

const BAREBONE = /barebone|bare bone/i

function layoutOf(values: string, kind: Kind) {
  const named = layoutIn(values)
  if (named !== undefined) return named
  return kind === 'main' ? 'ansi_us' : kind === 'jis' ? 'jis' : undefined
}

const COLOR_WORD =
  /black|white|gr[ae]y|purple|blue|red|green|pink|silver|beige|navy|wood|carbon|shell|ivory|orange|yellow|mint|khaki/i

function colorOf(options: Record<string, string>): string | undefined {
  const tidy = (s: string) =>
    s
      .replace(/\((?:ISO|JIS)[^)]*\)/gi, '')
      .replace(/[-(]?\s*(?:(?:cherry|osa|ksa)\s+)?(?:pbt|abs)\s+keycaps\)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  for (const [name, value] of Object.entries(options)) {
    if (/colou?r|couleur/i.test(name) && !/assembled|barebone|hot-?swap/i.test(value)) {
      return tidy(value)
    }
  }
  for (const value of Object.values(options)) {
    const inner = /\(([^)]*)\)/.exec(value)?.[1]
    if (inner && COLOR_WORD.test(inner)) return tidy(inner)
  }
  return undefined
}

/** Older listings split the switch in two options, its family then its colour ("Switch Type: Low
 * Profile Gateron Mechanical", "Switch Option: Red"; keychron.fr's "Option de commutation"); some
 * name the option after the family ("Keychron Ultra-Fast Lime Magnetic Switch": Lime). */
export function switchOf(options: Record<string, string>): string | undefined {
  const parts = Object.entries(options)
    .filter(([name]) => /switch|commutation/i.test(name) && !/mount|facing|pin/i.test(name))
    .map(([name, value]) => {
      const family = name.replace(/\b(switch(e?s)?|type|options?|de|commutation)\b/gi, '').trim()
      return `${family} ${value}`
        .replace(/[(（].*?[)）]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    })
    .filter(Boolean)
  return parts.length ? parts.join(' ') : undefined
}

async function rawVariants(model: Model): Promise<Raw[]> {
  const fr = await loadFr()
  const raws: Raw[] = []
  const usSkus = new Set<string>()
  for (const { product, kind } of model.listings) {
    for (const v of product.variants) {
      if (v.sku) usSkus.add(v.sku)
      const frVariant = v.sku ? fr.bySku.get(v.sku) : undefined
      raws.push({
        options: optionsOf(product, v),
        kind,
        sku: v.sku ?? undefined,
        usd: listPrice(v),
        eur: frVariant && listPrice(frVariant),
      })
    }
  }
  // keychron.fr listings of the same model: same handle, or at least one SKU in common.
  const handles = new Set(model.listings.map((l) => l.product.handle))
  for (const product of fr.products) {
    const linked =
      handles.has(product.handle) || product.variants.some((v) => v.sku && usSkus.has(v.sku))
    if (!linked) continue
    const kind: Kind = /\bJIS\b/.test(product.title)
      ? 'jis'
      : /\bISO\b/.test(product.title)
        ? 'iso'
        : 'main'
    for (const v of product.variants) {
      if (v.sku && usSkus.has(v.sku)) continue
      const options = Object.fromEntries(
        Object.entries(optionsOf(product, v)).map(([k, val]) => [fromFrench(k), fromFrench(val)]),
      )
      raws.push({ options, kind, sku: v.sku ?? undefined, eur: listPrice(v) })
    }
  }
  return raws
}

/** `listed`: the one switch family the page's key specs name ("Switches: Keychron low-profile
 * mechanical; hot-swappable"), if any. */
async function variantsOf(model: Model, resolver: SwitchResolver, listed?: string) {
  const notes: string[] = []
  const raws = (await rawVariants(model)).filter(
    (r) => !BAREBONE.test(Object.values(r.options).join(' | ')),
  )
  // A bare colour ("Red") borrows the family a sibling listing spells out in full, or the one
  // family the model's listings name ("Blue" beside "Low Profile Gateron Mechanical Red/Brown"),
  // or else the one its key specs name (J1: "Red", "Brown", "Banana").
  const fullNames = raws.map((r) => switchOf(r.options)).filter((s) => s && s.split(' ').length > 1)
  const families = new Set(fullNames.map((f) => f?.slice(0, f.lastIndexOf(' '))))
  if (!families.size && listed) families.add(listed)
  const expand = (name: string) => {
    if (name.split(' ').length > 1) return name
    const prefixes = new Set(
      fullNames.filter((f) => f?.endsWith(` ${name}`)).map((f) => f?.slice(0, -name.length - 1)),
    )
    const borrowed = prefixes.size ? prefixes : families
    const [prefix] = borrowed
    return borrowed.size === 1 && prefix ? `${prefix} ${name}` : name
  }
  const switchSlugs = new Map<string, string | undefined>()
  for (const name of new Set(raws.map((r) => switchOf(r.options)).filter(Boolean) as string[])) {
    const full = expand(name)
    const res = full.split(' ').length > 1 ? await resolver.resolve(full) : undefined
    switchSlugs.set(name, res?.slug)
    if (!res?.slug) notes.push(res?.note ?? `switch « ${name} » : famille inconnue`)
  }

  const mainColors = new Set(
    raws
      .filter((r) => r.kind === 'main')
      .map((r) => colorOf(r.options))
      .filter(Boolean),
  )
  const [onlyColor] = mainColors
  let colorGuessed = false
  const unknownLayouts = new Set<string>()
  const byKey = new Map<string, Variant>()
  for (const r of raws) {
    const values = Object.values(r.options).join(' | ')
    const layout = layoutOf(values, r.kind)
    if (layout === null) continue
    if (layout === undefined) {
      unknownLayouts.add(values)
      continue
    }
    let colorName = colorOf(r.options)
    if (!colorName) {
      colorName = mainColors.size === 1 && onlyColor ? onlyColor : 'Black'
      colorGuessed ||= mainColors.size !== 1
    }
    const sw = switchOf(r.options)
    const variant: Variant = {
      sku: r.sku,
      colorName,
      colorFamily: familyOf(colorName),
      layout,
      switch: sw ? switchSlugs.get(sw) : undefined,
      msrpEur: r.eur,
    }
    const key = `${colorName}|${layout}|${variant.switch ?? ''}`
    const prev = byKey.get(key)
    if (!prev || (r.eur && (!prev.msrpEur || r.eur < prev.msrpEur))) byKey.set(key, variant)
  }
  if (colorGuessed) notes.push('variantes sans couleur (souvent ISO) : « Black » supposé')
  if (unknownLayouts.size)
    notes.push(
      `variantes ISO sans disposition lisible ignorées : ${[...unknownLayouts].slice(0, 3).join(' ; ')}`,
    )
  const usd = raws.filter((r) => r.usd).map((r) => r.usd as number)
  return {
    variants: [...byKey.values()],
    notes,
    msrpUsd: usd.length ? roundPrice(median(usd)) : undefined,
  }
}

// ─── Specs ───────────────────────────────────────────────────────────────────────────────────────

function pollingOf(facts: Facts, conn: string, has24: boolean) {
  let wired: number | undefined
  let wireless: number | undefined
  const max = (a: number | undefined, b: number) => (a && a > b ? a : b)
  for (const seg of facts.allWithLabel(/polling/).flatMap((l) => l.split(/\s;\s/))) {
    const hz = hzOf(seg.replace(/2\.4\s*g/gi, ''))
    if (!hz) continue
    const is24 = /2\.4/.test(seg)
    const isWired = /wired|usb|type-c/i.test(seg)
    if (/bluetooth|\bbt\b/i.test(seg) && !is24 && !isWired) continue
    if (is24) wireless = max(wireless, hz)
    if (isWired || !is24) wired = max(wired, hz)
  }
  if (!wired) {
    const hz = hzOf(conn.replace(/2\.4\s*g/gi, ''))
    if (hz) {
      wired = hz
      if (has24) wireless ??= hz
    }
  }
  return { wired, wireless }
}

function formFactorOf(model: Model, title: string, size: string): Specs['formFactor'] | undefined {
  if (model.alice) return 'alice'
  if (/split/i.test(title) || /split/i.test(size)) return 'split'
  if (/100%|full/i.test(size)) return 'full'
  if (/96%/.test(size)) return 'f96'
  if (/80%|tkl|87/i.test(size)) return 'tkl'
  if (/75%/.test(size)) return 'f75'
  if (/6[58]%|70%/.test(size)) return 'f65'
  if (/60%|61 keys/i.test(size)) return 'f60'
  if (/40%/.test(size)) return 'f40'
  return undefined
}

function imagesOf(product: ShopifyProduct): ProductImage[] {
  const out: ProductImage[] = []
  const colors = new Set<string>()
  for (const v of product.variants) {
    const options = optionsOf(product, v)
    const img = v.featured_image
    const color = colorOf(options) ?? ''
    if (!img || BAREBONE.test(Object.values(options).join(' ')) || colors.has(color)) continue
    colors.add(color)
    out.push({ url: img.src, kind: 'cutout_top', width: img.width, height: img.height })
  }
  if (!out.length && product.images[0]) {
    const img = product.images[0]
    out.push({ url: img.src, kind: 'cutout_top', width: img.width, height: img.height })
  }
  const [first] = out
  if (first) first.primary = true
  return out.slice(0, 6)
}

export async function mapModel(model: Model, resolver: SwitchResolver): Promise<Draft> {
  const notes: string[] = []
  const main = model.listings.find((l) => l.kind === 'main')?.product
  if (!main) throw new Skip('pas de fiche principale')
  const page = await productPage(US, main.handle)
  const body = Facts.fromHtml(main.body_html)
  const facts = body.merge(Facts.fromHtml(page, 'main#main-content'))
  const bodyLines = linesOf(parseHtml(main.body_html))
  const mainText = linesOf(
    parseHtml(page).querySelector('main#main-content') ?? parseHtml(main.body_html),
  ).join('\n')
  const tag = (prefix: string) =>
    main.tags.filter((t) => t.startsWith(`${prefix}:`)).map((t) => t.slice(prefix.length + 1))
  const title = main.title

  const size = joined([...tag('LayoutSize'), facts.first(/^layout$/)])
  const formFactor = formFactorOf(model, title, size)
  if (!formFactor) throw new Skip(`taille introuvable (${size || 'aucune info'})`)
  if (/70%/.test(size)) notes.push('taille « 70 % » rangée en 65 %')

  const magnetic = /\bHE\b|magnetic|hall effect/i.test(title)
  // The B series says "Scissor Mechanism" in pictures; its pages list the collection by name.
  const technology: Specs['technology'] = magnetic
    ? 'magnetic'
    : /optical/i.test(title)
      ? 'optical'
      : /scissor/i.test(facts.text) || page.includes('"Scissor Switch Keyboards"')
        ? 'scissor'
        : 'mechanical'
  const lowProfile = tag('Profile').some((p) => /low/i.test(p)) || /low[- ]profile/i.test(title)

  const swapText = joined([...tag('SwitchMount'), ...facts.all(/hotswap|^switch(es)?$/)])
  const hotSwappable = /hot-?swap|^yes/i.test(swapText)
  const hotSwap: Specs['hotSwap'] = !hotSwappable
    ? 'none'
    : magnetic
      ? 'magnetic'
      : /5[- ]pin/i.test(mainText)
        ? '5pin'
        : /3[- ]pin/i.test(mainText) || lowProfile
          ? '3pin'
          : '5pin'

  const conn = joined([...facts.all(/^connectivity$/), ...tag('Connectivity')])
  const conn24ghz = /2\.4\s*g/i.test(conn)
  const connBt = /bluetooth/i.test(conn)
  let btDevices = num(/up to (\d+) devices/i.exec(joined(facts.all(/connectivity|bluetooth/)))?.[1])
  if (connBt && !btDevices) {
    btDevices = 3
    notes.push('nombre d’appareils Bluetooth non précisé : 3 supposé')
  }
  const polling = pollingOf(facts, conn, conn24ghz)

  const actuation = joined([
    ...facts.all(/adjustableactuation|actuationpoint/),
    ...facts.all(/magneticswitchfeatures/),
  ])
  const range = /(\d+(?:\.\d+)?)\s*(?:mm)?\s*[~\-–]\s*(\d+(?:\.\d+)?)\s*mm/.exec(actuation)
  const rapidTrigger =
    magnetic && (/rapid trigger/i.test(facts.text) || /rapid trigger/i.test(mainText))

  const build = facts.first(/^build$/) ?? ''
  const mountText = joined([...tag('MountStyle'), build])
  const mount: Specs['mount'] = /gasket/i.test(mountText)
    ? 'gasket'
    : /tray/i.test(mountText)
      ? 'tray'
      : /top mount/i.test(mountText)
        ? 'top'
        : /sandwich/i.test(mountText)
          ? 'sandwich'
          : undefined

  const caseTag = tag('CaseMaterial')[0] ?? ''
  const bodyMaterial = facts.first(/^bodymaterial$/) ?? build
  let caseMaterial: Specs['caseMaterial'] = /all-metal/i.test(caseTag)
    ? 'aluminum'
    : (earliest(bodyMaterial, MATERIAL) ?? 'plastic')
  const mixed =
    /&|\+/.test(caseTag) ||
    /abs\s*\+|\+\s*alu/i.test(bodyMaterial) ||
    /plastic|abs/i.test(facts.first(/bottomcasematerial/) ?? '')
  if (mixed && caseMaterial !== 'plastic') {
    caseMaterial = 'aluminum'
    notes.push('boîtier mixte (cadre alu, fond plastique) : rangé en aluminium')
  }
  const plateText = facts.first(/^platematerial$/) ?? /(\w+)\s+plate\b/i.exec(build)?.[1] ?? ''
  const plateMaterial = earliest(plateText, PLATE)

  const keycaps = joined([
    ...facts.all(/^keycaps?$|keycapmaterial/),
    ...tag('KeycapsType'),
    ...tag('KeycapMaterial'),
    ...tag('KeycapProfile'),
  ])
  const keycapMaterial: Specs['keycapMaterial'] = /pbt/i.test(keycaps)
    ? 'pbt'
    : /\bpom\b/i.test(keycaps)
      ? 'pom'
      : 'abs'
  if (!/pbt|pom|abs/i.test(keycaps)) notes.push('matière des keycaps non précisée : ABS supposé')
  const keycapProfile = earliest(keycaps, PROFILES)
  if (!keycapProfile && /\bOSA\b/.test(keycaps))
    notes.push('profil de keycaps OSA (absent du schéma)')

  const lightText = joined([
    ...facts.all(/^backlight/),
    ...main.options.filter((o) => /backlight/i.test(o.name)).flatMap((o) => o.values),
  ])
  const backlight: Specs['backlight'] = /rgb/i.test(lightText)
    ? 'rgb'
    : /white|led|backlit/i.test(lightText)
      ? 'white'
      : 'none'
  if (!lightText) notes.push('rétroéclairage non mentionné : aucun supposé')

  const firmwareText = joined([title, ...facts.all(/^(software|firmware)$/)])
  const box = bodyLines.slice(bodyLines.findIndex((l) => /in the box/i.test(l)) + 1).join(' ')
  const sizeText = facts.first(/^(size|dimensions?)/) ?? ''
  const pair = /(\d+(?:\.\d+)?)\s*(?:mm)?\s*[x×*]\s*(\d+(?:\.\d+)?)/.exec(sizeText)
  const sides = pair
    ? [Number(pair[1]), Number(pair[2])]
    : [num(facts.first(/^width$/), /mm/), num(facts.first(/^(length|depth)$/), /mm/)]
  const dims = sides.every((x) => x) ? (sides as number[]) : undefined
  const weightText = facts.first(/^weight$/) ?? ''
  const weight = num(weightText)
  const height =
    facts.first(/heightinclkeycapfront/) ??
    facts.first(/^frontheight$/) ??
    facts.first(/heightwithoutkeycapfront/)
  const angle = num(facts.first(/^(typing)?angle$/))

  const specs: Specs = {
    formFactor,
    technology,
    lowProfile,
    hotSwap,
    connWired: true,
    conn24ghz,
    connBt,
    btDevices: connBt ? btDevices : undefined,
    pollingHzWired: polling.wired,
    pollingHzWireless: polling.wireless,
    rapidTrigger,
    adjustableActuation: magnetic && (!!range || /adjustable actuation/i.test(facts.text)),
    minActuationMm: magnetic && range?.[1] ? Number(range[1]) : undefined,
    mount,
    caseMaterial,
    plateMaterial,
    keycapMaterial,
    keycapProfile,
    backlight,
    southFacing:
      tag('SwitchFacing').some((f) => /south/i.test(f)) || /south[- ]facing/i.test(lightText),
    knob:
      tag('KnobSupport').some((k) => /yes/i.test(k)) ||
      /\bknob\b/i.test(facts.first(/^layout$/) ?? '') ||
      main.options.some((o) => o.values.some((v) => /\bknob\b/i.test(v))),
    screen: false,
    firmware: /\bZMK\b/.test(firmwareText)
      ? 'zmk'
      : /\bQMK\b/.test(firmwareText) || tag('QMK/VIASupport').includes('Yes')
        ? 'qmk'
        : 'proprietary',
    macSupport: /mac/i.test(joined(facts.all(/compatible|software|system/))),
    batteryMah: num(facts.first(/^battery$/), /mah/),
    wristRestIncluded: /palm rest|wrist rest/i.test(box),
    soundDampening: /foam|sound[- ]absorb/i.test(mainText),
    weightG: weight
      ? Math.round(weight * (/^[\d.,\s]+kg/i.test(weightText) ? 1000 : 1))
      : undefined,
    widthMm: dims ? Math.round(Math.max(...dims)) : undefined,
    depthMm: dims ? Math.round(Math.min(...dims)) : undefined,
    heightFrontMm: num(height, /mm/),
    typingAngleDeg: angle !== undefined && angle <= 20 ? angle : undefined,
  }
  if (!specs.weightG) notes.push('poids introuvable')
  if (!specs.widthMm) notes.push('dimensions introuvables')
  if (magnetic && !rapidTrigger) notes.push('clavier magnétique sans rapid trigger mentionné')

  const listed = facts
    .first(/^switch(es)?$/)
    ?.split(';')[0]
    ?.trim()
  const v = await variantsOf(
    model,
    resolver,
    listed && !/[/、,]|\bor\b/.test(listed) ? listed : undefined,
  )
  notes.push(...v.notes)
  if (!v.variants.length) throw new Skip('aucune variante montée (que des barebones ?)')
  const priced = priceVariants(v.variants)
  let msrpEur = priced.msrpEur
  if (!msrpEur) {
    msrpEur = roundPrice((v.msrpUsd ?? 0) * EUR_PER_USD)
    notes.push(`absent de keychron.fr : prix € estimé depuis le prix US (× ${EUR_PER_USD})`)
  }

  const years = model.listings.map((l) => Number(l.product.created_at.slice(0, 4)))
  const input: KeyboardInput = {
    slug: model.slug,
    brand: model.brand,
    name: model.name,
    releaseYear: Math.min(...years),
    status: 'active',
    msrpEur,
    msrpUsd: v.msrpUsd,
    popularity: 0.5,
    editorialScore: 0.5,
    images: imagesOf(main),
    sources: model.listings.map((l) => productUrl(US, l.product.handle)),
    specs,
    variants: priced.variants,
  }
  return { input, notes: [...new Set(notes)] }
}

/** Today's regular prices by SKU, for `pnpm ingest prices`: euros from keychron.fr, dollars from
 * keychron.com (converted when keychron.fr does not sell the SKU). */
export async function priceIndex() {
  const index = new Map<string, { eur?: number; usd?: number }>()
  for (const p of await listProducts(US, 'keyboard-finder')) {
    for (const v of p.variants) if (v.sku) index.set(v.sku, { usd: listPrice(v) })
  }
  for (const v of (await loadFr()).bySku.values()) {
    if (v.sku) index.set(v.sku, { ...index.get(v.sku), eur: listPrice(v) })
  }
  return index
}

export const source: Source = {
  host: new URL(US).host,
  label: 'keychron.com (keyboard-finder) + prix et AZERTY de keychron.fr',
  intro: (brand) => [
    `# ${brand.name} : importés de keychron.com par \`pnpm ingest keychron\`, prix € et AZERTY de keychron.fr.`,
  ],
  candidates: async () =>
    (await loadModels()).map((m) => ({
      slug: m.slug,
      brand: brands[m.brand],
      map: (resolver) => mapModel(m, resolver),
    })),
  priceIndex,
}
