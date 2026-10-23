import type { Brand } from '@choose/catalog'
import type { Fact } from '../../facts'
import { get, getJson } from '../../http'
import { clean } from '../../monitor-specs'
import { Skip } from '../../source'
import { slugify } from '../../text'
import { type MonitorModel, monitorSource, type OfficialMonitor, TOP } from './official'

// ASUS, from its French sites and the public API behind them (odinapi.asus.com, no robots.txt).
// The list API pages through every monitor, ROG ones included, with its online date: those
// online since 2024 are read, ZenScreen portables, accessories and medical displays left out. A
// main-site monitor's sheet comes from the spec API, whose lines glue label and value together
// ("Type de dalleFast IPS"): they are split on ASUS's own labels, the longest first. A ROG
// monitor's sheet is its /spec/ page (label and value apart), and its page shows the ASUS eStore
// price when the eStore sells it; main-site monitors have no price there: their recommended price
// comes from data/msrp.yaml. On both, « Rotation » is the left-right turn of the stand.

const BRAND: Brand = { slug: 'asus', name: 'ASUS', website: 'https://www.asus.com' }
const API = 'https://odinapi.asus.com/recent-data/apiv2'
const SINCE = '2024'

type Listed = {
  Name?: string
  ProductURL?: string
  PDWebPath?: string
  isRogFlag?: number
  ProductOnlineDt?: string
  ImageList?: { ImageURL?: string[] }[]
}

/** The labels of ASUS's spec API, which glues each one to its value. */
const LABELS = [
  'Taille de la dalle (pouces)',
  "Ratio d'aspect",
  "Zone d'affichage (H x V)",
  "Surface d'affichage",
  "Type d'éclairage",
  'Type de dalle',
  'Angle de vue (CR≧10, H/V)',
  'Courbure',
  'Espace entre les pixels',
  'Résolution',
  'Espace des couleurs (sRGB)',
  'Espace des couleurs (DCI-P3)',
  'Espace des couleurs (Adobe RGB)',
  'Espace des couleurs (Rec.2020)',
  'Luminosité (HDR, Peak)',
  'Luminosité (Typ.)',
  'Ratio de contraste (HDR, Max)',
  'Ratio de contraste (Typ.)',
  'Couleurs',
  'Temps de réponse',
  'Fréquence de rafraîchissement (max)',
  'Support HDR (High Dynamic Range)',
  'Tactile',
  'Exactitude des couleurs',
  'Calibration ASUS Proart',
  'Technologie VRR',
  'Switch KVM',
  'Caméra web',
  'Haut-parleur',
  'USB-C',
  'DisplayPort 1.1',
  'DisplayPort 1.2',
  'DisplayPort 1.4 DSC',
  'DisplayPort 1.4',
  'DisplayPort 2.1',
  'Mini DisplayPort',
  'HDMI(v2.1)',
  'HDMI(v2.0)',
  'HDMI(v1.4)',
  'HDMI(v1.3)',
  'Micro HDMI',
  'Mini HDMI',
  'Alimentation USB-C',
  'USB 3.0 (Signal)',
  'Inclinaison',
  'Rotation',
  'Pivot',
  'Ajustement de la hauteur',
  'Montage mural VESA',
].sort((a, b) => b.length - a.length)

const RENAMED: Record<string, string> = { Rotation: 'Swivel' }

/** One line of the spec API as a fact: "- Poids net :4.5 kg", else the longest known label. */
export function asusFact(line: string): Fact | undefined {
  const text = clean(line.replace(/<[^>]+>/g, ' '))
  if (!text) return undefined
  const colon = /^-?\s*([^:]{2,60}?)\s*:\s*(.+)$/.exec(text)
  if (colon?.[1] && colon[2] && !/^https?$/i.test(colon[1])) {
    return { label: colon[1], value: colon[2] }
  }
  const label = LABELS.find((l) => text.toLowerCase().startsWith(l.toLowerCase()))
  if (label) {
    const value = text.slice(label.length).trim()
    return value ? { label: RENAMED[label] ?? label, value } : undefined
  }
  // A line of a list ("HDR10", "- Thunderbolt 4 x 2"): kept for the keyword checks.
  return { label: 'Liste', value: text.replace(/^-\s*/, '') }
}

async function mainSheet(webPath: string): Promise<Fact[]> {
  const url = `${API}/PDTechSpec?SystemCode=asus&WebSiteCode=fr&ProductWebPath=${webPath}&siteID=www&sitelang=`
  const data = await getJson<{ Result?: { SpecList?: { Content?: string }[] } }>(url)
  return (data.Result?.SpecList ?? []).flatMap((group) =>
    (group.Content ?? '').split(/<br\s*\/?>/i).flatMap((line) => asusFact(line) ?? []),
  )
}

/** ROG pages encode some entities twice ("R&amp;#233;solution"): &amp; first. */
const entities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(Number.parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")

function rogSheet(html: string): Fact[] {
  const facts: Fact[] = []
  for (const m of html.matchAll(
    /<span class="ProductSpecSingle__descriptionItem__[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<span class="ProductSpecSingle__descriptionItemValue__[^"]*"[^>]*>([\s\S]*?)<\/span>/g,
  )) {
    const label = clean(entities((m[1] ?? '').replace(/<[^>]+>/g, ' '))).replace(/\s*:$/, '')
    const value = clean(
      entities((m[2] ?? '').replace(/<br\s*\/?>/gi, ' / ').replace(/<[^>]+>/g, ' ')),
    )
    if (!value) continue
    facts.push({ label: RENAMED[label] ?? (label || 'Liste'), value })
  }
  return facts
}

/** "Prix ASUS estore 429,00 €" on a ROG page: what the eStore sells it for. */
function estorePrice(html: string) {
  const prices = [
    ...html.matchAll(/ProductTabBar__productMoney[^"]*"[^>]*>\s*([\d\s ]+,\d{2})\s*€/g),
  ].map((m) => Number((m[1] ?? '').replace(/[\s ]/g, '').replace(',', '.')))
  return prices.length ? Math.max(...prices) : undefined
}

/**
 * A ROG monitor's own photos, from its /gallery/ page (its product page shows other products'):
 * the list gives one, sometimes a monitor on an arm, and the front view is often among these.
 */
async function rogGallery(url: string): Promise<string[]> {
  const html = await get(`${url.replace(/\/$/, '')}/gallery/`).catch(() => '')
  return [
    ...html.matchAll(
      /ProductGallery__galleryImage__[^"]*"[^>]*>\s*<img[^>]+src="(https:\/\/dlcdnwebimgs\.asus\.com\/gain\/[0-9A-Fa-f-]{36})/g,
    ),
  ].map((m) => m[1] ?? '')
}

async function listed(): Promise<Listed[]> {
  const all: Listed[] = []
  for (let page = 1; page < 30; page++) {
    const data = await getJson<{ Result?: { TotalCount?: number; ProductList?: Listed[] } }>(
      `${API}/SeriesFilterResult?SystemCode=asus&WebsiteCode=fr&ProductLevel1Code=displays-desktops&ProductLevel2Code=monitors&PageSize=60&PageIndex=${page}&CategoryName=&SeriesName=&SubSeriesName=&Spec=&SubSpec=&PriceMin=&PriceMax=&Sort=Recommend&siteID=www&sitelang=`,
    )
    const list = data.Result?.ProductList ?? []
    all.push(...list)
    if (!list.length || all.length >= (data.Result?.TotalCount ?? 0)) break
  }
  return all
}

const nameOf = (p: Listed) => clean((p.Name ?? '').replace(/<[^>]+>/g, ' '))
/** "ROG Strix XG27ACS Gen2 (XG27ACSR)" → XG27ACSR: the reference ends the name. */
const modelOf = (name: string) => /([A-Z0-9-]{5,})\)?\s*$/.exec(name)?.[1] ?? name

/** A ROG page re-read by the weekly refresh: its eStore price, under the reference in its URL. */
export function read(url: string, html: string): OfficialMonitor | undefined {
  const model = /\/([^/]+)\/?$/.exec(url)?.[1]?.split('-').pop()?.toUpperCase()
  const price = estorePrice(html)
  if (!model || !price) return undefined
  return {
    url,
    name: model,
    facts: [],
    text: '',
    variants: [{ sku: model, regularPrice: price, available: true }],
    images: [],
  }
}

/**
 * A screen sold in white (-W) or in a special edition ("-G EDITION 20") is the same screen: one
 * product, its editions as colours.
 */
const EDITION = /-(W|G|GR)(?=\b)(?:\s+EDITION\s+\d+)?|\s+EDITION\s+\d+/gi
const IS_EDITION = /-(W|G|GR)\b|EDITION\s+\d+/i
const colourOf = (name: string) =>
  /EDITION/i.test(name) ? 'Édition spéciale' : /-W\b/.test(name) ? 'Blanc' : 'Noir'

async function readOne(p: Listed): Promise<OfficialMonitor> {
  const url = p.ProductURL ?? ''
  const rog = p.isRogFlag === 1
  const name = nameOf(p)
  const page = rog ? await get(url) : ''
  const facts = rog
    ? rogSheet(await get(`${url.replace(/\/$/, '')}/spec/`))
    : await mainSheet(p.PDWebPath ?? '')
  if (!facts.length) throw new Skip('fiche introuvable')
  const price = rog ? estorePrice(page) : undefined
  const model = modelOf(name)
  return {
    url,
    name: name.replace(/^ASUS\s+/i, ''),
    modelNumber: model,
    releaseYear: Number(p.ProductOnlineDt?.slice(0, 4)) || undefined,
    facts,
    text: facts
      .filter((f) => f.label === 'Liste')
      .map((f) => f.value)
      .join('\n'),
    variants: [
      { sku: model, color: colourOf(name), regularPrice: price, available: price != null },
    ],
    images: [
      ...new Set([
        // The list gives thumbnails (/w185): without the suffix, the 2400 px cut-out PNG.
        ...(p.ImageList?.[0]?.ImageURL ?? []).map((src) => src.replace(/\/w\d+$/, '')),
        ...(rog ? await rogGallery(url) : []),
      ]),
    ].map((src) => ({ src })),
  }
}

export async function models(): Promise<MonitorModel[]> {
  const groups = new Map<string, Listed[]>()
  for (const p of await listed()) {
    const url = p.ProductURL ?? ''
    if (!url || (p.ProductOnlineDt ?? '') < SINCE) continue
    if (/\/accessories\/|zenscreen|healthcare|display-accessories|monitor-arm/i.test(url)) continue
    const key = slugify(
      `asus ${nameOf(p)
        .replace(/^ASUS\s+/i, '')
        .replace(EDITION, '')}`,
    )
    groups.set(key, [...(groups.get(key) ?? []), p])
  }
  const out = new Map<string, MonitorModel>()
  for (const [slug, members] of groups) {
    // The plain edition names the product; the others add their colour.
    const ordered = [...members].sort(
      (a, b) => Number(IS_EDITION.test(nameOf(a))) - Number(IS_EDITION.test(nameOf(b))),
    )
    out.set(slug, {
      brand: BRAND,
      slug,
      read: async (): Promise<OfficialMonitor> => {
        const read: OfficialMonitor[] = []
        for (const p of ordered) {
          try {
            read.push(await readOne(p))
          } catch (e) {
            if (!(e instanceof Skip)) throw e
          }
        }
        const [first] = read
        if (!first) throw new Skip('fiche introuvable')
        return {
          ...first,
          name: first.name.replace(EDITION, '').trim(),
          variants: read.flatMap((m) => m.variants),
        }
      },
    })
  }
  // The list comes in ASUS's recommended order: its 50 first, priced or waiting for their price.
  return [...out.values()].slice(0, TOP)
}

export const source = monitorSource({
  // Only the ROG pages carry a price to refresh; the others keep their recommended price.
  host: 'rog.asus.com',
  label: 'asus.com/fr et rog.asus.com/fr (prix ASUS eStore pour les ROG, sinon prix conseillé)',
  intro: (brand) => [
    `# ${brand.name} (ROG, TUF, ProArt…) : importés de asus.com et rog.asus.com par \`pnpm ingest asus\`.`,
    '# Prix : ASUS eStore quand il vend le modèle (ROG), sinon prix conseillé de data/msrp.yaml.',
  ],
  models,
  read,
})
