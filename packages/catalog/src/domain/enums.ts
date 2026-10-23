// Every enumerated spec value, in one place. Zod schemas and the Drizzle pgEnums are both built
// from these arrays, so adding a value here is the only change a new panel or form factor needs
// before a migration.

export const categories = ['keyboard', 'monitor', 'mouse'] as const
export type Category = (typeof categories)[number]
export const productStatuses = ['active', 'discontinued'] as const
export const imageKinds = ['cutout_top', 'cutout_front', 'three_quarter', 'lifestyle'] as const
export const colorFamilies = ['black', 'white', 'color', 'transparent'] as const

// Keyboards
export const formFactors = [
  'full',
  'f96',
  'tkl',
  'f75',
  'f65',
  'f60',
  'f40',
  'split',
  'alice',
  'numpad',
] as const
export const keyboardTechnologies = [
  'mechanical',
  'magnetic',
  'optical',
  'membrane',
  'scissor',
  'topre',
] as const
export const keyboardLayouts = [
  'ansi_us',
  'iso_fr',
  'iso_uk',
  'iso_de',
  'iso_nordic',
  'jis',
] as const
export const hotSwapKinds = ['none', '3pin', '5pin', 'magnetic'] as const
export const mountKinds = ['tray', 'gasket', 'top', 'sandwich', 'plateless', 'integrated'] as const
export const caseMaterials = ['plastic', 'aluminum', 'polycarbonate', 'wood', 'steel'] as const
export const plateMaterials = ['steel', 'aluminum', 'brass', 'fr4', 'polycarbonate', 'pom'] as const
export const keycapMaterials = ['abs', 'pbt', 'pom'] as const
export const keycapProfiles = ['cherry', 'oem', 'sa', 'xda', 'mda', 'ksa', 'low'] as const
export const backlights = ['none', 'white', 'rgb'] as const
export const firmwares = ['qmk', 'via', 'vial', 'zmk', 'proprietary'] as const

// Switches
export const switchFeels = ['linear', 'tactile', 'clicky'] as const
export const switchTechs = ['mechanical', 'magnetic', 'optical'] as const
export const soundProfiles = ['deep', 'clacky', 'muted', 'poppy', 'crisp'] as const

// Monitors
export const aspects = ['16:9', '16:10', '21:9', '32:9', '3:2'] as const
export const panels = ['ips', 'va', 'tn', 'woled', 'qdoled', 'miniled_ips', 'miniled_va'] as const
export const coatings = ['matte', 'semi', 'glossy'] as const
export const vrrKinds = [
  'none',
  'freesync',
  'freesync_premium',
  'freesync_premium_pro',
  'gsync_compatible',
  'gsync_module',
] as const
export const hdrCerts = [
  'none',
  'hdr400',
  'hdr500',
  'hdr600',
  'hdr1000',
  'hdr1400',
  'true_black_400',
  'true_black_500',
  'true_black_600',
] as const
export const hdmiVersions = ['1.4', '2.0', '2.1'] as const
export const dpVersions = ['1.2', '1.4', '2.1'] as const

// Mice
/** A trackball is its own shape: the ball, not the hand, moves the pointer. */
export const mouseShapes = ['symmetrical', 'ergonomic', 'vertical', 'trackball'] as const
/** The hand a mouse is made for. Ambidextrous: buttons on both sides, or none on the sides. */
export const mouseHands = ['right', 'left', 'ambidextrous'] as const
/** The maker's line it belongs to: gaming and office shells are shaped differently. */
export const mouseSegments = ['gaming', 'office'] as const
export const mouseSwitchTypes = ['mechanical', 'optical', 'hybrid', 'magnetic'] as const
/** What powers a wireless mouse. */
export const mousePowers = ['rechargeable', 'aa', 'aaa'] as const
export const ballPositions = ['thumb', 'finger'] as const
export const grips = ['palm', 'claw', 'fingertip'] as const
