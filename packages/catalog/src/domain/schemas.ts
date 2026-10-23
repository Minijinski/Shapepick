import { z } from 'zod'
import * as E from './enums'

// The input shapes double as the seed format (data/*.yaml) and, once resolved against brands and
// switches, as the items the finder works on. Units are normalised: mm, g, Hz, ms, cd/m², W, €.

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case slug')
const text = z.object({ fr: z.string(), en: z.string() })
const positive = z.number().positive()
const positiveInt = z.number().int().positive()
const unit = z.number().min(0).max(1)

export const brandSchema = z.object({
  slug,
  name: z.string(),
  country: z.string().length(2).optional(),
  website: z.url().optional(),
})
export type Brand = z.infer<typeof brandSchema>

export const switchSchema = z.object({
  slug,
  brand: z.string(),
  name: z.string(),
  feel: z.enum(E.switchFeels),
  silent: z.boolean().default(false),
  tech: z.enum(E.switchTechs),
  // A brand switch whose maker only names its feel ("GL Tactile") has no figures: none is guessed.
  actuationForceG: positive.optional(),
  bottomOutG: positive.optional(),
  preTravelMm: positive.optional(),
  totalTravelMm: positive.optional(),
  factoryLubed: z.boolean().default(false),
  soundProfile: z.enum(E.soundProfiles).optional(),
})
export type Switch = z.infer<typeof switchSchema>

export const productImageSchema = z.object({
  url: z.url(),
  kind: z.enum(E.imageKinds),
  width: positiveInt.optional(),
  height: positiveInt.optional(),
  primary: z.boolean().optional(),
})
export type ProductImage = z.infer<typeof productImageSchema>

const productBase = z.object({
  slug,
  brand: slug,
  name: z.string(),
  modelNumber: z.string().optional(),
  releaseYear: z.number().int().min(1990).max(2100).optional(),
  status: z.enum(E.productStatuses).default('active'),
  msrpEur: positive,
  msrpUsd: positive.optional(),
  popularity: unit.default(0.5),
  editorialScore: unit.default(0.5),
  tagline: text.optional(),
  description: text.optional(),
  images: z.array(productImageSchema).optional(),
  /** The Amazon.fr product (ASIN) a buy link opens: the AZERTY version when the model has one. */
  amazonAsin: z
    .string()
    .regex(/^[A-Z0-9]{10}$/, 'ASIN')
    .optional(),
  /** Pages the record was imported from (pnpm ingest), to re-check or refresh it later. */
  sources: z.array(z.url()).optional(),
  /** EAN/UPC codes the maker gives, kept in data/ only: they identify the product at a shop. */
  gtins: z.array(z.string().regex(/^\d{8,14}$/, 'GTIN')).optional(),
})

export const keyboardSpecsSchema = z.object({
  formFactor: z.enum(E.formFactors),
  technology: z.enum(E.keyboardTechnologies),
  lowProfile: z.boolean().default(false),
  hotSwap: z.enum(E.hotSwapKinds).default('none'),
  connWired: z.boolean().default(true),
  conn24ghz: z.boolean().default(false),
  connBt: z.boolean().default(false),
  btDevices: positiveInt.optional(),
  pollingHzWired: positiveInt.optional(),
  pollingHzWireless: positiveInt.optional(),
  rapidTrigger: z.boolean().default(false),
  adjustableActuation: z.boolean().default(false),
  minActuationMm: positive.optional(),
  mount: z.enum(E.mountKinds).optional(),
  caseMaterial: z.enum(E.caseMaterials).default('plastic'),
  plateMaterial: z.enum(E.plateMaterials).optional(),
  keycapMaterial: z.enum(E.keycapMaterials).default('abs'),
  keycapProfile: z.enum(E.keycapProfiles).optional(),
  backlight: z.enum(E.backlights).default('none'),
  southFacing: z.boolean().default(false),
  knob: z.boolean().default(false),
  screen: z.boolean().default(false),
  firmware: z.enum(E.firmwares).default('proprietary'),
  macSupport: z.boolean().default(false),
  batteryMah: positiveInt.optional(),
  wristRestIncluded: z.boolean().default(false),
  soundDampening: z.boolean().default(false),
  weightG: positiveInt.optional(),
  widthMm: positiveInt.optional(),
  depthMm: positiveInt.optional(),
  heightFrontMm: positive.optional(),
  typingAngleDeg: z.number().min(0).max(20).optional(),
})
export type KeyboardSpecs = z.infer<typeof keyboardSpecsSchema>

export const keyboardVariantSchema = z.object({
  sku: z.string().optional(),
  colorName: z.string(),
  colorFamily: z.enum(E.colorFamilies),
  layout: z.enum(E.keyboardLayouts),
  switch: slug.optional(),
  msrpEur: positive.optional(),
})

export const keyboardInputSchema = productBase.extend({
  specs: keyboardSpecsSchema,
  variants: z.array(keyboardVariantSchema).min(1),
})
export type KeyboardInput = z.infer<typeof keyboardInputSchema>

const monitorSpecsShape = z.object({
  diagonalIn: positive,
  aspect: z.enum(E.aspects),
  resW: positiveInt,
  resH: positiveInt,
  panel: z.enum(E.panels),
  dimmingZones: positiveInt.optional(),
  /** Curvature radius in mm (1800R → 1800). Absent means flat. */
  curvatureR: positiveInt.optional(),
  coating: z.enum(E.coatings).default('matte'),
  refreshHzMax: positiveInt,
  dualModeHz: positiveInt.optional(),
  responseGtgMs: positive.optional(),
  vrr: z.enum(E.vrrKinds).default('none'),
  hdrCert: z.enum(E.hdrCerts).default('none'),
  brightnessSdrNits: positiveInt.optional(),
  brightnessHdrPeakNits: positiveInt.optional(),
  contrastStatic: positiveInt.optional(),
  dciP3Pct: z.number().min(0).max(150).optional(),
  srgbPct: z.number().min(0).max(200).optional(),
  bitDepth: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]).optional(),
  factoryCalibrated: z.boolean().default(false),
  hdmiPorts: z.number().int().min(0).default(1),
  hdmiVersion: z.enum(E.hdmiVersions).optional(),
  dpVersion: z.enum(E.dpVersions).optional(),
  usbcPdW: z.number().int().min(0).default(0),
  thunderbolt: z.boolean().default(false),
  kvm: z.boolean().default(false),
  usbHub: z.boolean().default(false),
  speakers: z.boolean().default(false),
  /** Height travel of the stand, when the sheet gives it (0: not given, or a fixed stand). */
  standHeightMm: z.number().int().min(0).default(0),
  /** Whether the stand goes up and down: some sheets say so without giving the travel. */
  heightAdjustable: z.boolean().default(false),
  tilt: z.boolean().default(true),
  swivel: z.boolean().default(false),
  pivot: z.boolean().default(false),
  vesa: z.boolean().default(true),
  weightG: positiveInt.optional(),
})
// A stand with a height travel is height-adjustable, whatever the record says.
export const monitorSpecsSchema = monitorSpecsShape.transform((s) => ({
  ...s,
  heightAdjustable: s.heightAdjustable || s.standHeightMm > 0,
}))
export type MonitorSpecs = z.infer<typeof monitorSpecsSchema>

export const monitorVariantSchema = z.object({
  sku: z.string().optional(),
  colorName: z.string(),
  colorFamily: z.enum(E.colorFamilies),
  msrpEur: positive.optional(),
})

export const monitorInputSchema = productBase.extend({
  specs: monitorSpecsSchema,
  variants: z
    .array(monitorVariantSchema)
    .min(1)
    .default([{ colorName: 'Black', colorFamily: 'black' }]),
})
export type MonitorInput = z.infer<typeof monitorInputSchema>

/** Pixels per inch from a resolution and a diagonal. The database stores the same formula as a generated column. */
export const ppiOf = (s: Pick<MonitorSpecs, 'resW' | 'resH' | 'diagonalIn'>) =>
  Math.round(Math.hypot(s.resW, s.resH) / s.diagonalIn)
