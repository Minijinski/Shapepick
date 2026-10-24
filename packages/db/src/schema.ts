import * as E from '@choose/catalog'
import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Typed columns for everything the finder filters or ranks on, `extra` jsonb for the long tail.
// Enum values come from @choose/catalog, the same arrays the Zod schemas use. Column names are
// snake_case in SQL (drizzle `casing`), camelCase in TypeScript.

const enumOf = <T extends readonly [string, ...string[]]>(name: string, values: T) =>
  pgEnum(name, values)

export const category = enumOf('category', E.categories)
export const productStatus = enumOf('product_status', E.productStatuses)
export const imageKind = enumOf('image_kind', E.imageKinds)
export const colorFamily = enumOf('color_family', E.colorFamilies)
export const formFactor = enumOf('form_factor', E.formFactors)
export const keyboardTechnology = enumOf('keyboard_technology', E.keyboardTechnologies)
export const keyboardLayout = enumOf('keyboard_layout', E.keyboardLayouts)
export const hotSwap = enumOf('hot_swap', E.hotSwapKinds)
export const mount = enumOf('mount', E.mountKinds)
export const caseMaterial = enumOf('case_material', E.caseMaterials)
export const plateMaterial = enumOf('plate_material', E.plateMaterials)
export const keycapMaterial = enumOf('keycap_material', E.keycapMaterials)
export const keycapProfile = enumOf('keycap_profile', E.keycapProfiles)
export const backlight = enumOf('backlight', E.backlights)
export const firmware = enumOf('firmware', E.firmwares)
export const switchFeel = enumOf('switch_feel', E.switchFeels)
export const switchTech = enumOf('switch_tech', E.switchTechs)
export const soundProfile = enumOf('sound_profile', E.soundProfiles)
export const aspect = enumOf('aspect', E.aspects)
export const panel = enumOf('panel', E.panels)
export const coating = enumOf('coating', E.coatings)
export const vrr = enumOf('vrr', E.vrrKinds)
export const hdrCert = enumOf('hdr_cert', E.hdrCerts)
export const hdmiVersion = enumOf('hdmi_version', E.hdmiVersions)
export const dpVersion = enumOf('dp_version', E.dpVersions)
export const mouseShape = enumOf('mouse_shape', E.mouseShapes)
export const mouseHand = enumOf('mouse_hand', E.mouseHands)
export const mouseSegment = enumOf('mouse_segment', E.mouseSegments)
export const mouseSwitchType = enumOf('mouse_switch_type', E.mouseSwitchTypes)
export const mousePower = enumOf('mouse_power', E.mousePowers)
export const ballPosition = enumOf('ball_position', E.ballPositions)
export const grip = enumOf('grip', E.grips)

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}
const money = () => numeric({ precision: 10, scale: 2, mode: 'number' })

export const brands = pgTable('brands', {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  country: text(),
  website: text(),
})

export const products = pgTable(
  'products',
  {
    id: serial().primaryKey(),
    slug: text().notNull().unique(),
    category: category().notNull(),
    brandId: integer()
      .notNull()
      .references(() => brands.id),
    name: text().notNull(),
    modelNumber: text(),
    releaseYear: smallint(),
    status: productStatus().notNull().default('active'),
    msrpEur: money().notNull(),
    msrpUsd: money(),
    popularity: real().notNull().default(0.5),
    editorialScore: real().notNull().default(0.5),
    /** Amazon.fr product id for the buy link; null: the link searches for the model. */
    amazonAsin: text(),
    ...timestamps,
  },
  (t) => [index().on(t.category, t.status)],
)

export const productTranslations = pgTable(
  'product_translations',
  {
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    locale: text().notNull(),
    tagline: text(),
    description: text(),
    seoTitle: text(),
    seoDescription: text(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.locale] })],
)

export const productImages = pgTable('product_images', {
  id: serial().primaryKey(),
  productId: integer()
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  url: text().notNull(),
  kind: imageKind().notNull(),
  width: integer(),
  height: integer(),
  dominantHex: text(),
  isPrimary: boolean().notNull().default(false),
})

export const switches = pgTable('switches', {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  brand: text().notNull(),
  name: text().notNull(),
  feel: switchFeel().notNull(),
  silent: boolean().notNull().default(false),
  tech: switchTech().notNull(),
  /** Null for a switch known by its feel alone (the maker publishes no figures). */
  actuationForceG: real(),
  bottomOutG: real(),
  preTravelMm: real(),
  totalTravelMm: real(),
  factoryLubed: boolean().notNull().default(false),
  soundProfile: soundProfile(),
})

export const productVariants = pgTable(
  'product_variants',
  {
    id: serial().primaryKey(),
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text(),
    colorName: text().notNull(),
    colorFamily: colorFamily().notNull(),
    /** Keyboards only. */
    layout: keyboardLayout(),
    switchId: integer().references(() => switches.id),
    msrpEur: money(),
  },
  (t) => [index().on(t.productId)],
)

export const keyboardSpecs = pgTable('keyboard_specs', {
  productId: integer()
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  formFactor: formFactor().notNull(),
  technology: keyboardTechnology().notNull(),
  lowProfile: boolean().notNull().default(false),
  hotSwap: hotSwap().notNull().default('none'),
  connWired: boolean().notNull().default(true),
  conn24ghz: boolean().notNull().default(false),
  connBt: boolean().notNull().default(false),
  btDevices: smallint(),
  pollingHzWired: integer(),
  pollingHzWireless: integer(),
  rapidTrigger: boolean().notNull().default(false),
  adjustableActuation: boolean().notNull().default(false),
  minActuationMm: real(),
  mount: mount(),
  caseMaterial: caseMaterial().notNull().default('plastic'),
  plateMaterial: plateMaterial(),
  keycapMaterial: keycapMaterial().notNull().default('abs'),
  keycapProfile: keycapProfile(),
  backlight: backlight().notNull().default('none'),
  southFacing: boolean().notNull().default(false),
  knob: boolean().notNull().default(false),
  screen: boolean().notNull().default(false),
  firmware: firmware().notNull().default('proprietary'),
  macSupport: boolean().notNull().default(false),
  batteryMah: integer(),
  wristRestIncluded: boolean().notNull().default(false),
  soundDampening: boolean().notNull().default(false),
  weightG: integer(),
  widthMm: integer(),
  depthMm: integer(),
  heightFrontMm: real(),
  typingAngleDeg: real(),
  extra: jsonb().$type<Record<string, unknown>>(),
})

export const monitorSpecs = pgTable('monitor_specs', {
  productId: integer()
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  diagonalIn: real().notNull(),
  aspect: aspect().notNull(),
  resW: integer().notNull(),
  resH: integer().notNull(),
  ppi: doublePrecision().generatedAlwaysAs(
    sql`round(sqrt(res_w::float8 * res_w + res_h::float8 * res_h) / diagonal_in)`,
  ),
  panel: panel().notNull(),
  dimmingZones: integer(),
  curvatureR: integer(),
  coating: coating().notNull().default('matte'),
  refreshHzMax: integer().notNull(),
  dualModeHz: integer(),
  responseGtgMs: real(),
  vrr: vrr().notNull().default('none'),
  hdrCert: hdrCert().notNull().default('none'),
  brightnessSdrNits: integer(),
  brightnessHdrPeakNits: integer(),
  contrastStatic: integer(),
  dciP3Pct: real(),
  srgbPct: real(),
  bitDepth: smallint(),
  factoryCalibrated: boolean().notNull().default(false),
  hdmiPorts: smallint().notNull().default(1),
  hdmiVersion: hdmiVersion(),
  dpVersion: dpVersion(),
  usbcPdW: integer().notNull().default(0),
  thunderbolt: boolean().notNull().default(false),
  kvm: boolean().notNull().default(false),
  usbHub: boolean().notNull().default(false),
  speakers: boolean().notNull().default(false),
  standHeightMm: integer().notNull().default(0),
  heightAdjustable: boolean().notNull().default(false),
  tilt: boolean().notNull().default(true),
  swivel: boolean().notNull().default(false),
  pivot: boolean().notNull().default(false),
  vesa: boolean().notNull().default(true),
  weightG: integer(),
  extra: jsonb().$type<Record<string, unknown>>(),
})

export const mouseSpecs = pgTable('mouse_specs', {
  productId: integer()
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  shape: mouseShape().notNull(),
  hand: mouseHand().notNull(),
  segment: mouseSegment().notNull(),
  /** A trackball's maker may give no measurements. */
  lengthMm: real(),
  widthMm: real(),
  heightMm: real(),
  weightG: real(),
  ballPosition: ballPosition(),
  buttons: smallint(),
  mmo: boolean().notNull().default(false),
  sensor: text(),
  dpiMax: integer(),
  pollingHz: integer(),
  switchType: mouseSwitchType(),
  silentClicks: boolean().notNull().default(false),
  connWired: boolean().notNull().default(true),
  conn24ghz: boolean().notNull().default(false),
  connBt: boolean().notNull().default(false),
  hosts: smallint().notNull().default(1),
  batteryHours: real(),
  power: mousePower(),
  wirelessCharging: boolean().notNull().default(false),
  freeSpinWheel: boolean().notNull().default(false),
  tiltWheel: boolean().notNull().default(false),
  thumbWheel: boolean().notNull().default(false),
  rgb: boolean().notNull().default(false),
  makerHandMinCm: real(),
  makerHandMaxCm: real(),
  makerGrips: grip().array(),
  extra: jsonb().$type<Record<string, unknown>>(),
})

/** Shop prices, filled later by price ingestion. */
export const offers = pgTable(
  'offers',
  {
    id: serial().primaryKey(),
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: integer().references(() => productVariants.id, { onDelete: 'set null' }),
    shop: text().notNull(),
    country: text().notNull(),
    url: text().notNull(),
    price: money().notNull(),
    currency: text().notNull().default('EUR'),
    inStock: boolean().notNull().default(true),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.productId, t.shop, t.country, t.url)],
)

/**
 * Clicks on a buy link, written by /api/out as they happen: which product, from where on the site,
 * to its page at the shop or to a search. Nothing about the visitor beyond the country and the kind
 * of device: no address, no cookie, no identifier. The product is kept by slug rather than by
 * reference, so the history outlives a product's removal from the catalogue.
 */
export const outboundClicks = pgTable(
  'outbound_clicks',
  {
    id: serial().primaryKey(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    shop: text().notNull(),
    productSlug: text().notNull(),
    category: category().notNull(),
    /** Where the link sat: the sheet, the best match, a runner-up, a row of the results… */
    placement: text().notNull(),
    /** `page` when it opened the product's page at the shop, `search` for a search. */
    link: text().notNull(),
    locale: text().notNull(),
    /** The path the click came from. */
    page: text(),
    /** ISO 3166 code, from the CDN's geolocation. */
    country: text(),
    /** `mobile` or `desktop`, from the browser's user agent. */
    device: text(),
  },
  (t) => [index().on(t.at), index().on(t.productSlug)],
)
