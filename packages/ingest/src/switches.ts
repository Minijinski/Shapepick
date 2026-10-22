import type { Switch } from '@choose/catalog'
import { Facts, num, parseHtml } from './facts'
import { listProducts, productPage, type ShopifyProduct } from './shopify'
import { slugify } from './text'

// Keyboard listings name their switches ("Gateron Jupiter Brown", "Cherry MX Silent Red"); the
// same shops sell those switches with a spec sheet. This resolves a name to an existing switch
// slug, or builds the switch from that sheet. Nothing is guessed: a switch without a readable sheet
// is kept with its feel alone when its name states it ("Logitech GL Tactile"), without figures;
// otherwise it stays unresolved, the keyboard variant goes without a switch and the entry is
// flagged for review.
//
// Catalogues, tried together, the best match winning:
// - keychron.com: one product per family, one option per colour, one spec table per colour;
// - mechanicalkeyboards.com: one product per switch, a "Characteristics" sheet (Feel, Actuation
//   Force, Operating Position, Full Travel…).

const KEYCHRON = 'https://www.keychron.com'
const MK = 'https://mechanicalkeyboards.com'
const BRANDS = [
  'Gateron',
  'Keychron',
  'Kailh',
  'Cherry',
  'Lemokey',
  'TTC',
  'Haimu',
  'Outemu',
  'Akko',
  'Wooting',
  'Lekker',
  'Razer',
  'Durock',
  'JWK',
  'Tecsee',
  'Leopold',
  'Varmilo',
  'Ducky',
  'Topre',
  'HMX',
  'BSUN',
  'Greetech',
  'Zeal',
  'Wuque',
  'Huano',
  'Glorious',
  'Lofree',
  'Yunzii',
  'Epomaker',
  'Womier',
  'Ajazz',
  'Aula',
  'Leobog',
  'KTT',
]

const STOP = new Set(['switch', 'switches', 'set', 'mechanical', 'the', 'pcs', 'pack', 'keyboard'])
/** Words a listing may leave out ("Milk POM Red" for "Milk POM Low Profile", "MX Silver" for "MX
 * Speed Silver"), besides numbers and the weight or feel a switch shop puts in its titles. */
const OPTIONAL = new Set(['low', 'profile', 'speed', 'rgb', 'linear', 'tactile', 'clicky', 'pin'])
const OPTIONAL_TOKEN = /^\d+(\.\d+)?(g|gf|cn)?$/

export const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\bversion\s*\d+\b/g, ' ')
    .split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter((t) => t && !STOP.has(t))

type Specs = Omit<Switch, 'slug' | 'brand' | 'name'> & { notes?: string[] }
type Candidate = { name: string; tokens: Set<string>; specs: () => Promise<Specs | undefined> }

export type SwitchResolution = { slug?: string; note?: string }

/** "Gateron Low Profile 2.0 Mechanical Red" → { brand: Gateron, name: Low Profile 2.0 Red }. */
function split(name: string) {
  const brand =
    BRANDS.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(name)) ?? name.split(' ')[0] ?? ''
  const short = name
    .replace(new RegExp(`\\b${brand}\\b`, 'i'), '')
    .replace(/\bmechanical\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { brand, short, slug: slugify(`${brand} ${short}`) }
}

const feelOf = (s: string) =>
  /click/i.test(s)
    ? 'clicky'
    : /tactile/i.test(s)
      ? 'tactile'
      : /lin(ear|[ée]aire)/i.test(s)
        ? 'linear'
        : undefined

/**
 * A switch whose name states its feel ("Logitech GL Tactile") while its maker publishes no figures:
 * the feel alone, which the name says, rather than no switch at all. A name that does not state it
 * ("Gateron G Pro Brown") still gives nothing: a colour is no feel.
 */
function feelOnly(name: string): Specs | undefined {
  const feel = feelOf(name)
  if (!feel) return undefined
  return {
    feel,
    silent: /silent/i.test(name),
    tech: /magnetic|hall/i.test(name)
      ? 'magnetic'
      : /optical/i.test(name)
        ? 'optical'
        : 'mechanical',
    factoryLubed: false,
    notes: ['ressenti seul : la marque ne publie ni force ni course'],
  }
}

/** A switch name without what never tells switches apart: weight, mount,
 * "Switch" ("HMX Frost 45g Linear PCB Mount" → HMX Frost Linear). */
const wantedName = (name: string) =>
  name
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b\d+(\.\d+)?\s*(g|gf|cn)\b/gi, ' ')
    .replace(/\b(pcb|plate|mount|switch(es)?|keyboard|mechanical)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Specs from one sheet, whatever its template. */
function specsFrom(f: Facts, name: string, context = ''): Specs | undefined {
  const feel = feelOf(f.first(/^(type|switchtype|feel)$/) ?? '') ?? feelOf(context)
  // "45±15 gf", "45 cN": the nominal value is the first number.
  const force = num(f.first(/(operat(ion|ing)|actuation|initial)force/))
  let preTravel = num(f.first(/pretravel|actuationtravel|actuationpoint|operatingposition/))
  let totalTravel = num(f.first(/totaltravel|fulltravel/))
  const notes: string[] = []
  // Some sheets give the force but not the travel of a plain MX-stem switch: the MX standard.
  const mxStem =
    /^mx/i.test(f.first(/^stemtype$/) ?? '') && !/low|profile|choc|magnetic/i.test(name)
  if (feel && force && mxStem && (!preTravel || !totalTravel)) {
    preTravel ??= 2
    totalTravel ??= 4
    notes.push('courses absentes de la fiche : standard MX supposé (2 / 4 mm)')
  }
  if (!feel || !force || !preTravel || !totalTravel) return undefined
  const yes = (label: RegExp) => /^(yes|true)/i.test(f.first(label) ?? '')
  const lube = f.first(/lubrication|lubed/) ?? ''
  return {
    feel,
    silent: /silent/i.test(name) || yes(/^silent$/),
    tech:
      yes(/^magnetic$/) || /magnetic|hall/i.test(name)
        ? 'magnetic'
        : /optical/i.test(name) || yes(/^optical$/)
          ? 'optical'
          : 'mechanical',
    actuationForceG: force,
    bottomOutG: num(f.first(/(bottomout|end)force/)),
    preTravelMm: preTravel,
    totalTravelMm: totalTravel,
    factoryLubed:
      /^(yes|lubed|factory|pre)/i.test(lube) || /factory[- ]lubed|pre-lubed/i.test(f.text),
    notes,
  }
}

// ─── keychron.com ────────────────────────────────────────────────────────────────────────────────

/** The table under a heading naming the colour, or the only table of the page. */
function keychronSheet(html: string, option: string) {
  const root = parseHtml(html)
  const main = root.querySelector('main#main-content') ?? root
  const tables: { heading: string; facts: Facts }[] = []
  let heading = ''
  for (const el of main.querySelectorAll('h1, h2, h3, h4, h5, table')) {
    if (el.tagName === 'TABLE') tables.push({ heading, facts: Facts.fromHtml(el.outerHTML) })
    else heading = el.text.replace(/\s+/g, ' ').trim()
  }
  const specTables = tables.filter((t) => t.facts.first(/force/) && t.facts.first(/travel/))
  const want = tokens(option.replace(/\(.*?\)/g, ''))
  const named = specTables.filter((t) => {
    const h = new Set(tokens(t.heading))
    return want.length > 0 && want.every((w) => h.has(w))
  })
  return named.length === 1 ? named[0] : specTables.length === 1 ? specTables[0] : undefined
}

async function keychronCatalog(): Promise<Candidate[]> {
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const handle of ['all-switches', 'magnetic-switches', 'low-profile-switches']) {
    for (const product of await listProducts(KEYCHRON, handle)) {
      if (seen.has(product.handle) || /tester|storage|macro pad/i.test(product.title)) continue
      seen.add(product.handle)
      const base = product.title
        .replace(/\(.*?\)/g, ' ')
        .replace(/\b(switch(es)?|set|mechanical)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const option = product.options.find((o) => !/quantity|model/i.test(o.name))
      for (const value of option?.values ?? []) {
        const clean = value.replace(/\(.*?\)/g, '').trim()
        // "Kailh Box" + "Box Brown" → Kailh Box Brown; "… Lime Magnetic" + "Lime" → … Lime Magnetic.
        const baseTokens = new Set(tokens(base))
        const added = clean.split(/\s+/).filter((w) => !baseTokens.has(w.toLowerCase()))
        const name = [base, ...added].join(' ')
        out.push({
          name,
          tokens: new Set(tokens(`${base} ${clean}`)),
          specs: async () => {
            const sheet = keychronSheet(await productPage(KEYCHRON, product.handle), value)
            return sheet && specsFrom(sheet.facts, `${product.title} ${value}`, sheet.heading)
          },
        })
      }
    }
  }
  return out
}

// ─── mechanicalkeyboards.com ─────────────────────────────────────────────────────────────────────

/** "Cherry MX Black Clear Top Nixie 63.5g Linear PCB Mount Switch ( MX1A-61NW )" → Cherry MX Black
 * Clear Top Nixie. */
const mkName = (title: string) =>
  title
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b\d+(\.\d+)?\s*(g|gf|cn)\b/gi, ' ')
    .replace(/\b(linear|tactile|clicky|pcb|plate|mount|switch(es)?|keyboard|mechanical)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

async function mkCatalog(): Promise<Candidate[]> {
  const products: ShopifyProduct[] = await listProducts(MK, 'keyboard-switches')
  return products
    .filter((p) => !/tester|sampler|puller|lube|film|spring|o-ring|opener/i.test(p.title))
    .map((p) => {
      const name = mkName(p.title)
      return {
        name,
        tokens: new Set(tokens(wantedName(p.title))),
        specs: async () =>
          specsFrom(Facts.fromHtml(await productPage(MK, p.handle), 'main'), p.title),
      }
    })
}

// ─── Brand stores ────────────────────────────────────────────────────────────────────────────────

/** "YUNZII Sage Linear 5-Pin Mechanical Switch" → YUNZII Sage Linear. */
const storeName = (title: string) =>
  title
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b\d+(\.\d+)?\s*(g|gf|cn)\b/gi, ' ')
    .replace(/\b\d-pin\b|\b(switch(es)?|set|pack|mechanical|keyboard|pcb|plate|mount)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Switches a brand store sells, read from their description ("Operating Force: 45±8gf"…). */
async function storeCatalog(origin: string): Promise<Candidate[]> {
  return (await listProducts(origin))
    .filter(
      (p) =>
        /switch/i.test(`${p.product_type} ${p.title}`) &&
        !/keyboard|tester|puller|lube|controller|desk ?mat|opener|film|spring/i.test(p.title),
    )
    .map((p) => {
      const name = storeName(p.title)
      return {
        name,
        tokens: new Set(tokens(name)),
        specs: async () =>
          specsFrom(
            Facts.fromHtml(p.body_html).merge(
              Facts.fromHtml(await productPage(origin, p.handle), 'main'),
            ),
            p.title,
          ),
      }
    })
}

const STORE_CATALOGS = ['https://yunzii.com', 'https://epomaker.com', 'https://womierkeyboard.com']

// ─── Resolver ────────────────────────────────────────────────────────────────────────────────────

export function switchResolver(existing: Switch[]) {
  const known = new Set(existing.map((s) => s.slug))
  const created = new Map<string, Switch>()
  /** Review notes of the switches built here, by slug. */
  const notes = new Map<string, string[]>()
  const cache = new Map<string, Promise<SwitchResolution>>()
  let catalog: Promise<Candidate[]> | undefined

  const optional = (t: string) => OPTIONAL_TOKEN.test(t) || OPTIONAL.has(t)

  /** Candidates that fit, best first: fewest unexplained words, then the exact name. */
  function fits(name: string, all: Candidate[]) {
    const wanted = new Set(tokens(name))
    const required = [...wanted].filter((t) => !optional(t))
    const want = split(name).slug
    return all
      .map((c) => {
        if (!required.every((t) => c.tokens.has(t))) return undefined
        const extra = [...c.tokens].filter((t) => !wanted.has(t))
        if (!extra.every(optional)) return undefined
        const missing = [...wanted].filter((t) => !c.tokens.has(t)).length
        const slug = split(c.name).slug
        const score = extra.filter((t) => !OPTIONAL_TOKEN.test(t)).length + missing
        return { c, slug, score: score + (slug === want ? 0 : 0.5) }
      })
      .filter((x) => x !== undefined)
      .sort((a, b) => a.score - b.score)
  }

  function create({ brand, short, slug }: ReturnType<typeof split>, specs: Specs) {
    const { notes: specNotes, ...rest } = specs
    created.set(slug, { slug, brand, name: short, ...rest })
    if (specNotes?.length) notes.set(slug, specNotes)
    return { slug }
  }

  async function resolve(raw: string): Promise<SwitchResolution> {
    const name = wantedName(raw)
    if (!name || /^(none|n\/a|no switch(es)?)$/i.test(name)) return {}
    catalog ??= Promise.all([
      keychronCatalog(),
      mkCatalog(),
      ...STORE_CATALOGS.map(storeCatalog),
    ]).then((lists) => lists.flat())
    const ranked = fits(name, await catalog)
    const [best, second] = ranked
    const direct = split(name)
    if (!best || (second && second.score === best.score && second.slug !== best.slug)) {
      if (known.has(direct.slug) || created.has(direct.slug)) return { slug: direct.slug }
      const stated = feelOnly(raw)
      if (stated) return create(direct, stated)
      return {
        note: `switch « ${raw} » : aucune fiche trouvée, à saisir dans data/switches.yaml (slug ${direct.slug})`,
      }
    }
    const found = split(best.c.name)
    if (known.has(found.slug) || created.has(found.slug)) return { slug: found.slug }
    // The same switch may be on both shops: the first readable sheet wins.
    for (const { c } of ranked.filter((r) => r.slug === found.slug)) {
      const specs = await c.specs()
      if (specs) return create(found, specs)
    }
    // No readable sheet for this exact name, but a close one we already have ("Cherry MX RGB Red" →
    // Cherry MX Red, the same switch in a clear housing).
    const close = ranked.find(
      (r) => r.score <= best.score + 1 && (known.has(r.slug) || created.has(r.slug)),
    )
    if (close) return { slug: close.slug }
    const stated = feelOnly(raw)
    if (stated) return create(found, stated)
    return {
      note: `switch « ${raw} » : specs non publiées en texte, à saisir dans data/switches.yaml (slug ${found.slug})`,
    }
  }

  return {
    created,
    notes,
    resolve(name: string) {
      const key = tokens(name).join(' ')
      let hit = cache.get(key)
      if (!hit) {
        hit = resolve(name)
        cache.set(key, hit)
      }
      return hit
    },
  }
}

export type SwitchResolver = ReturnType<typeof switchResolver>
