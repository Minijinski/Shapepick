import {
  type Answers,
  type CatalogItem,
  type Category,
  filter,
  finderOf,
  type Locale,
  type Ranked,
  rank,
  readRange,
  stepOf,
  type Text,
  text,
} from '@choose/catalog'

// The catalogue's collections: the products that share a few of the questionnaire's answers
// ("Claviers 75 % sans fil": the 75 % size, a wireless link), or every product ranked for one use,
// ranked by the finder's own engine. Each has a page (routes/$lang_.$category.catalogue.$collection
// .tsx), and a product's sheet says where it stands in the ones it belongs to. Only what people
// search for, and what holds at least six products (MIN_SIZE): a smaller one has no page.

/** The questionnaire's options a collection keeps: any of a question's, every question's. */
type Picks = Record<string, readonly string[]>

/** Where a collection sits on the catalogue's page, among the others of its category. */
export type CollectionGroup =
  | 'size'
  | 'keys'
  | 'panel'
  | 'layout'
  | 'link'
  | 'feature'
  | 'price'
  | 'use'

export type Collection = {
  /** Its name in the code, unique within its category. */
  id: string
  category: Category
  group: CollectionGroup
  /** The last part of its address, in each locale. */
  slug: Text
  /** Its heading, the start of its page's title: "Claviers 75 % sans fil". */
  name: Text
  /** Beside the category's name, on a chip or a sheet's line: "75 % sans fil". */
  short: Text
  picks: Picks
  /**
   * The use it ranks for, when its answers say what it is for (USB-C: the office; 240 Hz: an FPS);
   * the finder's overall ranking otherwise.
   */
  use?: string
  /** Answers that only steer the ranking (a grip). */
  steer?: Answers
}

/** Fewer products than this make no collection: its page waits until the catalogue grows. */
export const MIN_SIZE = 6

/** How many products a collection's page lists, at most; the catalogue's index has them all. */
export const LISTED = 100

const WIRELESS = ['dongle', 'bluetooth']

const collection =
  (category: Category, group: CollectionGroup) =>
  (
    id: string,
    slug: [string, string],
    name: [string, string],
    short: [string, string],
    picks: Picks,
    ranking: { use?: string; steer?: Answers } = {},
  ): Collection => ({
    id,
    category,
    group,
    slug: text(...slug),
    name: text(...name),
    short: text(...short),
    picks,
    ...ranking,
  })

const keyboard = (group: CollectionGroup) => collection('keyboard', group)
const monitor = (group: CollectionGroup) => collection('monitor', group)
const mouse = (group: CollectionGroup) => collection('mouse', group)

const keyboards: Collection[] = [
  keyboard('size')(
    'f75',
    ['75-pourcent', '75-percent'],
    ['Claviers 75 %', '75% keyboards'],
    ['75 %', '75%'],
    { size: ['f75'] },
  ),
  keyboard('size')(
    'f65',
    ['65-pourcent', '65-percent'],
    ['Claviers 65 %', '65% keyboards'],
    ['65 %', '65%'],
    { size: ['f65'] },
  ),
  keyboard('size')(
    'f60',
    ['60-pourcent', '60-percent'],
    ['Claviers 60 %', '60% keyboards'],
    ['60 %', '60%'],
    { size: ['f60'] },
  ),
  keyboard('size')('tkl', ['tkl', 'tkl'], ['Claviers TKL', 'TKL keyboards'], ['TKL', 'TKL'], {
    size: ['tkl'],
  }),
  keyboard('size')(
    'f96',
    ['96-pourcent', '96-percent'],
    ['Claviers 96 %', '96% keyboards'],
    ['96 %', '96%'],
    { size: ['f96'] },
  ),
  keyboard('size')(
    'full',
    ['pave-numerique', 'full-size'],
    ['Claviers avec pavé numérique', 'Full-size keyboards'],
    ['Pavé numérique', 'Full size'],
    { size: ['full'] },
    { use: 'office' },
  ),
  keyboard('size')(
    'ergo',
    ['ergonomiques', 'ergonomic'],
    ['Claviers ergonomiques', 'Ergonomic keyboards'],
    ['Ergonomiques', 'Ergonomic'],
    { size: ['ergo'] },
    { use: 'office' },
  ),
  keyboard('keys')(
    'magnetic',
    ['magnetiques', 'magnetic'],
    ['Claviers magnétiques', 'Magnetic keyboards'],
    ['Magnétiques', 'Magnetic'],
    { tech: ['magnetic'] },
    { use: 'competitive' },
  ),
  keyboard('keys')(
    'mechanical',
    ['mecaniques', 'mechanical'],
    ['Claviers mécaniques', 'Mechanical keyboards'],
    ['Mécaniques', 'Mechanical'],
    { tech: ['mechanical'] },
  ),
  keyboard('keys')(
    'optical',
    ['optiques', 'optical'],
    ['Claviers optiques', 'Optical keyboards'],
    ['Optiques', 'Optical'],
    { tech: ['optical'] },
    { use: 'gaming' },
  ),
  keyboard('keys')(
    'low',
    ['extra-plats', 'low-profile'],
    ['Claviers extra-plats', 'Low-profile keyboards'],
    ['Extra-plats', 'Low profile'],
    { profile: ['low'] },
    { use: 'office' },
  ),
  keyboard('keys')(
    'silent',
    ['silencieux', 'silent'],
    ['Claviers mécaniques silencieux', 'Silent mechanical keyboards'],
    ['Silencieux', 'Silent'],
    { feel: ['silent'] },
    { use: 'office' },
  ),
  keyboard('layout')(
    'azerty',
    ['azerty', 'azerty'],
    ['Claviers AZERTY', 'AZERTY keyboards'],
    ['AZERTY', 'AZERTY'],
    { layout: ['azerty'] },
  ),
  keyboard('layout')(
    'f75-azerty',
    ['75-pourcent-azerty', '75-percent-azerty'],
    ['Claviers 75 % AZERTY', '75% AZERTY keyboards'],
    ['75 % AZERTY', '75% AZERTY'],
    { size: ['f75'], layout: ['azerty'] },
  ),
  keyboard('layout')(
    'f65-azerty',
    ['65-pourcent-azerty', '65-percent-azerty'],
    ['Claviers 65 % AZERTY', '65% AZERTY keyboards'],
    ['65 % AZERTY', '65% AZERTY'],
    { size: ['f65'], layout: ['azerty'] },
  ),
  keyboard('layout')(
    'f60-azerty',
    ['60-pourcent-azerty', '60-percent-azerty'],
    ['Claviers 60 % AZERTY', '60% AZERTY keyboards'],
    ['60 % AZERTY', '60% AZERTY'],
    { size: ['f60'], layout: ['azerty'] },
  ),
  keyboard('layout')(
    'tkl-azerty',
    ['tkl-azerty', 'tkl-azerty'],
    ['Claviers TKL AZERTY', 'TKL AZERTY keyboards'],
    ['TKL AZERTY', 'TKL AZERTY'],
    { size: ['tkl'], layout: ['azerty'] },
  ),
  keyboard('layout')(
    'f96-azerty',
    ['96-pourcent-azerty', '96-percent-azerty'],
    ['Claviers 96 % AZERTY', '96% AZERTY keyboards'],
    ['96 % AZERTY', '96% AZERTY'],
    { size: ['f96'], layout: ['azerty'] },
  ),
  keyboard('layout')(
    'full-azerty',
    ['pave-numerique-azerty', 'full-size-azerty'],
    ['Claviers AZERTY avec pavé numérique', 'Full-size AZERTY keyboards'],
    ['Pavé num. AZERTY', 'Full-size AZERTY'],
    { size: ['full'], layout: ['azerty'] },
    { use: 'office' },
  ),
  keyboard('layout')(
    'magnetic-azerty',
    ['magnetiques-azerty', 'magnetic-azerty'],
    ['Claviers magnétiques AZERTY', 'Magnetic AZERTY keyboards'],
    ['Magnétiques AZERTY', 'Magnetic AZERTY'],
    { tech: ['magnetic'], layout: ['azerty'] },
    { use: 'competitive' },
  ),
  keyboard('layout')(
    'wireless-mechanical-azerty',
    ['mecaniques-sans-fil-azerty', 'wireless-mechanical-azerty'],
    ['Claviers mécaniques sans fil AZERTY', 'Wireless mechanical AZERTY keyboards'],
    ['Sans fil AZERTY', 'Wireless AZERTY'],
    { tech: ['mechanical'], connection: WIRELESS, layout: ['azerty'] },
    { use: 'office' },
  ),
  keyboard('layout')(
    'low-azerty',
    ['extra-plats-azerty', 'low-profile-azerty'],
    ['Claviers extra-plats AZERTY', 'Low-profile AZERTY keyboards'],
    ['Extra-plats AZERTY', 'Low-profile AZERTY'],
    { profile: ['low'], layout: ['azerty'] },
    { use: 'office' },
  ),
  keyboard('layout')(
    'hotswap-azerty',
    ['hot-swap-azerty', 'hot-swap-azerty'],
    ['Claviers hot-swap AZERTY', 'Hot-swap AZERTY keyboards'],
    ['Hot-swap AZERTY', 'Hot-swap AZERTY'],
    { musts: ['hotswap'], layout: ['azerty'] },
  ),
  keyboard('link')(
    'wireless-mechanical',
    ['mecaniques-sans-fil', 'wireless-mechanical'],
    ['Claviers mécaniques sans fil', 'Wireless mechanical keyboards'],
    ['Mécaniques sans fil', 'Wireless mechanical'],
    { tech: ['mechanical'], connection: WIRELESS },
    { use: 'office' },
  ),
  keyboard('link')(
    'f75-wireless',
    ['75-pourcent-sans-fil', 'wireless-75-percent'],
    ['Claviers 75 % sans fil', 'Wireless 75% keyboards'],
    ['75 % sans fil', 'Wireless 75%'],
    { size: ['f75'], connection: WIRELESS },
  ),
  keyboard('link')(
    'f65-wireless',
    ['65-pourcent-sans-fil', 'wireless-65-percent'],
    ['Claviers 65 % sans fil', 'Wireless 65% keyboards'],
    ['65 % sans fil', 'Wireless 65%'],
    { size: ['f65'], connection: WIRELESS },
  ),
  keyboard('link')(
    'f60-wireless',
    ['60-pourcent-sans-fil', 'wireless-60-percent'],
    ['Claviers 60 % sans fil', 'Wireless 60% keyboards'],
    ['60 % sans fil', 'Wireless 60%'],
    { size: ['f60'], connection: WIRELESS },
  ),
  keyboard('link')(
    'tkl-wireless',
    ['tkl-sans-fil', 'wireless-tkl'],
    ['Claviers TKL sans fil', 'Wireless TKL keyboards'],
    ['TKL sans fil', 'Wireless TKL'],
    { size: ['tkl'], connection: WIRELESS },
  ),
  keyboard('link')(
    'full-wireless',
    ['pave-numerique-sans-fil', 'wireless-full-size'],
    ['Claviers sans fil avec pavé numérique', 'Wireless full-size keyboards'],
    ['Pavé num. sans fil', 'Wireless full-size'],
    { size: ['full'], connection: WIRELESS },
    { use: 'office' },
  ),
  keyboard('link')(
    'magnetic-wireless',
    ['magnetiques-sans-fil', 'wireless-magnetic'],
    ['Claviers magnétiques sans fil', 'Wireless magnetic keyboards'],
    ['Magnétiques sans fil', 'Wireless magnetic'],
    { tech: ['magnetic'], connection: WIRELESS },
    { use: 'competitive' },
  ),
  keyboard('feature')(
    'hotswap',
    ['hot-swap', 'hot-swap'],
    ['Claviers hot-swap', 'Hot-swap keyboards'],
    ['Hot-swap', 'Hot-swap'],
    { musts: ['hotswap'] },
  ),
  keyboard('feature')(
    'knob',
    ['molette', 'with-knob'],
    ['Claviers avec molette', 'Keyboards with a knob'],
    ['Molette', 'Knob'],
    { musts: ['knob'] },
  ),
  keyboard('price')(
    'mechanical-under-100',
    ['mecaniques-moins-de-100-euros', 'mechanical-under-100'],
    ['Claviers mécaniques à moins de 100 €', 'Mechanical keyboards under €100'],
    ['Mécaniques < 100 €', 'Mechanical < €100'],
    { tech: ['mechanical'], budget: ['0-100'] },
  ),
  keyboard('use')(
    'gaming',
    ['gamer', 'gaming'],
    ['Claviers gamer', 'Gaming keyboards'],
    ['Pour jouer', 'For gaming'],
    {},
    { use: 'gaming' },
  ),
  keyboard('use')(
    'office',
    ['bureau', 'office'],
    ['Claviers de bureau', 'Office keyboards'],
    ['Pour le bureau', 'For the office'],
    {},
    { use: 'office' },
  ),
  // No page for coding yet: a firmware the catalogue does not know counts as proprietary, and its
  // ranking's first ten were all Keychron. It comes back with the known firmwares (audit, lot 2).
]

const ULTRAWIDE = ['uw34', 'uw38', 'suw']

const monitors: Collection[] = [
  monitor('size')(
    's24',
    ['24-pouces', '24-inch'],
    ['Écrans 24 pouces', '24-inch monitors'],
    ['24 pouces', '24-inch'],
    { format: ['s24'] },
  ),
  monitor('size')(
    's27',
    ['27-pouces', '27-inch'],
    ['Écrans 27 pouces', '27-inch monitors'],
    ['27 pouces', '27-inch'],
    { format: ['s27'] },
  ),
  monitor('size')(
    's32',
    ['32-pouces', '32-inch'],
    ['Écrans 32 pouces', '32-inch monitors'],
    ['32 pouces', '32-inch'],
    { format: ['s32'] },
  ),
  monitor('size')(
    'uw34',
    ['34-pouces', '34-inch'],
    ['Écrans 34 pouces ultra-larges', '34-inch ultrawide monitors'],
    ['34 pouces', '34-inch'],
    { format: ['uw34'] },
    { use: 'immersive' },
  ),
  monitor('size')(
    'suw',
    ['49-pouces', '49-inch'],
    ['Écrans 49 pouces', '49-inch monitors'],
    ['49 pouces', '49-inch'],
    { format: ['suw'] },
    { use: 'immersive' },
  ),
  monitor('size')(
    'ultrawide',
    ['ultra-larges', 'ultrawide'],
    ['Écrans ultra-larges', 'Ultrawide monitors'],
    ['Ultra-larges', 'Ultrawide'],
    { format: ULTRAWIDE },
    { use: 'immersive' },
  ),
  monitor('size')(
    's27-curved',
    ['27-pouces-incurves', '27-inch-curved'],
    ['Écrans 27 pouces incurvés', '27-inch curved monitors'],
    ['27 pouces incurvés', '27-inch curved'],
    { format: ['s27'], curve: ['curved'] },
    { use: 'immersive' },
  ),
  monitor('size')(
    'curved',
    ['incurves', 'curved'],
    ['Écrans incurvés', 'Curved monitors'],
    ['Incurvés', 'Curved'],
    { curve: ['curved'] },
    { use: 'immersive' },
  ),
  monitor('panel')(
    'oled',
    ['oled', 'oled'],
    ['Écrans OLED', 'OLED monitors'],
    ['OLED', 'OLED'],
    {
      panel: ['oled'],
    },
    { use: 'immersive' },
  ),
  monitor('panel')(
    'oled-27',
    ['oled-27-pouces', 'oled-27-inch'],
    ['Écrans OLED 27 pouces', '27-inch OLED monitors'],
    ['OLED 27 pouces', '27-inch OLED'],
    { panel: ['oled'], format: ['s27'] },
    { use: 'immersive' },
  ),
  monitor('panel')(
    'oled-32',
    ['oled-32-pouces', 'oled-32-inch'],
    ['Écrans OLED 32 pouces', '32-inch OLED monitors'],
    ['OLED 32 pouces', '32-inch OLED'],
    { panel: ['oled'], format: ['s32'] },
    { use: 'immersive' },
  ),
  monitor('panel')(
    'oled-4k',
    ['oled-4k', 'oled-4k'],
    ['Écrans OLED 4K', '4K OLED monitors'],
    ['OLED 4K', '4K OLED'],
    { panel: ['oled'], resolution: ['uhd'] },
    { use: 'immersive' },
  ),
  monitor('panel')(
    'oled-ultrawide',
    ['oled-ultra-larges', 'oled-ultrawide'],
    ['Écrans OLED ultra-larges', 'Ultrawide OLED monitors'],
    ['OLED ultra-larges', 'Ultrawide OLED'],
    { panel: ['oled'], format: ULTRAWIDE },
    { use: 'immersive' },
  ),
  monitor('panel')('uhd', ['4k', '4k'], ['Écrans 4K', '4K monitors'], ['4K', '4K'], {
    resolution: ['uhd'],
  }),
  monitor('panel')(
    's27-uhd',
    ['27-pouces-4k', '27-inch-4k'],
    ['Écrans 27 pouces 4K', '27-inch 4K monitors'],
    ['27 pouces 4K', '27-inch 4K'],
    { format: ['s27'], resolution: ['uhd'] },
  ),
  monitor('panel')(
    's32-uhd',
    ['32-pouces-4k', '32-inch-4k'],
    ['Écrans 32 pouces 4K', '32-inch 4K monitors'],
    ['32 pouces 4K', '32-inch 4K'],
    { format: ['s32'], resolution: ['uhd'] },
  ),
  monitor('panel')(
    's27-qhd',
    ['27-pouces-1440p', '27-inch-1440p'],
    ['Écrans 27 pouces 1440p', '27-inch 1440p monitors'],
    ['27 pouces 1440p', '27-inch 1440p'],
    { format: ['s27'], resolution: ['qhd'] },
  ),
  monitor('panel')(
    '5k',
    ['5k', '5k'],
    ['Écrans 5K et plus', '5K and higher monitors'],
    ['5K et plus', '5K and higher'],
    { resolution: ['5k'] },
    { use: 'creative' },
  ),
  monitor('link')(
    'r144',
    ['144-hz', '144hz'],
    ['Écrans 144 Hz', '144 Hz monitors'],
    ['144 Hz', '144 Hz'],
    { refresh: ['144'] },
    { use: 'fps' },
  ),
  monitor('link')(
    'r240',
    ['240-hz', '240hz'],
    ['Écrans 240 Hz', '240 Hz monitors'],
    ['240 Hz', '240 Hz'],
    { refresh: ['240'] },
    { use: 'fps' },
  ),
  monitor('link')(
    'r360',
    ['360-hz', '360hz'],
    ['Écrans 360 Hz', '360 Hz monitors'],
    ['360 Hz', '360 Hz'],
    { refresh: ['360'] },
    { use: 'fps' },
  ),
  monitor('link')(
    'r480',
    ['480-hz', '480hz'],
    ['Écrans 480 Hz', '480 Hz monitors'],
    ['480 Hz', '480 Hz'],
    { refresh: ['480'] },
    { use: 'fps' },
  ),
  monitor('link')(
    's24-r240',
    ['24-pouces-240-hz', '24-inch-240hz'],
    ['Écrans 24 pouces 240 Hz', '24-inch 240 Hz monitors'],
    ['24 pouces 240 Hz', '24-inch 240 Hz'],
    { format: ['s24'], refresh: ['240'] },
    { use: 'fps' },
  ),
  monitor('link')(
    's27-r144',
    ['27-pouces-144-hz', '27-inch-144hz'],
    ['Écrans 27 pouces 144 Hz', '27-inch 144 Hz monitors'],
    ['27 pouces 144 Hz', '27-inch 144 Hz'],
    { format: ['s27'], refresh: ['144'] },
    { use: 'fps' },
  ),
  monitor('link')(
    's27-r240',
    ['27-pouces-240-hz', '27-inch-240hz'],
    ['Écrans 27 pouces 240 Hz', '27-inch 240 Hz monitors'],
    ['27 pouces 240 Hz', '27-inch 240 Hz'],
    { format: ['s27'], refresh: ['240'] },
    { use: 'fps' },
  ),
  monitor('link')(
    'uhd-r144',
    ['4k-144-hz', '4k-144hz'],
    ['Écrans 4K 144 Hz', '4K 144 Hz monitors'],
    ['4K 144 Hz', '4K 144 Hz'],
    { resolution: ['uhd'], refresh: ['144'] },
    { use: 'fps' },
  ),
  monitor('link')(
    'uhd-r240',
    ['4k-240-hz', '4k-240hz'],
    ['Écrans 4K 240 Hz', '4K 240 Hz monitors'],
    ['4K 240 Hz', '4K 240 Hz'],
    { resolution: ['uhd'], refresh: ['240'] },
    { use: 'fps' },
  ),
  monitor('feature')(
    'usbc',
    ['usb-c', 'usb-c'],
    ['Écrans USB-C', 'USB-C monitors'],
    ['USB-C', 'USB-C'],
    { musts: ['usbc'] },
    { use: 'office' },
  ),
  monitor('feature')(
    'kvm',
    ['kvm', 'kvm'],
    ['Écrans KVM', 'KVM monitors'],
    ['KVM', 'KVM'],
    {
      musts: ['kvm'],
    },
    { use: 'office' },
  ),
  monitor('feature')(
    'hdr',
    ['hdr', 'hdr'],
    ['Écrans HDR', 'HDR monitors'],
    ['HDR', 'HDR'],
    {
      musts: ['hdr'],
    },
    { use: 'immersive' },
  ),
  monitor('feature')(
    'pivot',
    ['pivotants', 'pivot'],
    ['Écrans pivotants', 'Pivoting monitors'],
    ['Pivotants', 'Pivot'],
    { musts: ['pivot'] },
    { use: 'office' },
  ),
  monitor('feature')(
    'speakers',
    ['haut-parleurs', 'speakers'],
    ['Écrans avec haut-parleurs', 'Monitors with speakers'],
    ['Haut-parleurs', 'Speakers'],
    { musts: ['speakers'] },
    { use: 'office' },
  ),
  monitor('price')(
    'under-200',
    ['moins-de-200-euros', 'under-200'],
    ['Écrans à moins de 200 €', 'Monitors under €200'],
    ['< 200 €', '< €200'],
    { budget: ['0-200'] },
  ),
  monitor('price')(
    'r144-under-200',
    ['144-hz-moins-de-200-euros', '144hz-under-200'],
    ['Écrans 144 Hz à moins de 200 €', '144 Hz monitors under €200'],
    ['144 Hz < 200 €', '144 Hz < €200'],
    { refresh: ['144'], budget: ['0-200'] },
    { use: 'fps' },
  ),
  monitor('use')(
    'gaming',
    ['gamer', 'gaming'],
    ['Écrans gamer', 'Gaming monitors'],
    ['Pour jouer', 'For gaming'],
    {},
    { use: 'fps' },
  ),
  monitor('use')(
    'console',
    ['ps5', 'ps5'],
    ['Écrans pour PS5 et Xbox', 'Monitors for PS5 and Xbox'],
    ['PS5 et Xbox', 'PS5 and Xbox'],
    { musts: ['hdmi21'] },
    { use: 'console' },
  ),
  monitor('use')(
    'creative',
    ['retouche-photo', 'photo-editing'],
    ['Écrans pour la retouche photo', 'Monitors for photo editing'],
    ['Retouche photo', 'Photo editing'],
    {},
    { use: 'creative' },
  ),
  monitor('use')(
    'office',
    ['bureautique', 'office'],
    ['Écrans bureautiques', 'Office monitors'],
    ['Bureautique', 'Office'],
    {},
    { use: 'office' },
  ),
]

/** Shells held by a grip: a vertical mouse or a trackball is not. */
const HELD = ['sym', 'ergo']

const mice: Collection[] = [
  mouse('size')(
    'left',
    ['gaucher', 'left-handed'],
    ['Souris pour gaucher', 'Left-handed mice'],
    ['Gaucher', 'Left-handed'],
    { hand: ['left'] },
  ),
  mouse('size')(
    'ergo',
    ['ergonomiques', 'ergonomic'],
    ['Souris ergonomiques', 'Ergonomic mice'],
    ['Ergonomiques', 'Ergonomic'],
    { shape: ['ergo'] },
    { use: 'office' },
  ),
  mouse('size')(
    'small',
    ['petites-mains', 'small-hands'],
    ['Souris pour petites mains', 'Mice for small hands'],
    ['Petites mains', 'Small hands'],
    { size: ['small'] },
  ),
  mouse('size')(
    'large',
    ['grandes-mains', 'large-hands'],
    ['Souris pour grandes mains', 'Mice for large hands'],
    ['Grandes mains', 'Large hands'],
    { size: ['large', 'xl'] },
  ),
  mouse('size')(
    'ultralight',
    ['ultra-legeres', 'ultralight'],
    ['Souris ultra-légères', 'Ultralight mice'],
    ['Ultra-légères', 'Ultralight'],
    { weight: ['feather', 'ultralight'] },
    { use: 'competitive' },
  ),
  mouse('link')(
    'light-wireless',
    ['legeres-sans-fil', 'light-wireless'],
    ['Souris légères sans fil', 'Light wireless mice'],
    ['Légères sans fil', 'Light wireless'],
    { weight: ['feather', 'ultralight', 'light'], connection: WIRELESS },
    { use: 'competitive' },
  ),
  mouse('link')(
    'wireless',
    ['sans-fil', 'wireless'],
    ['Souris sans fil', 'Wireless mice'],
    ['Sans fil', 'Wireless'],
    { connection: WIRELESS },
  ),
  mouse('link')(
    'bluetooth',
    ['bluetooth', 'bluetooth'],
    ['Souris Bluetooth', 'Bluetooth mice'],
    ['Bluetooth', 'Bluetooth'],
    { connection: ['bluetooth'] },
    { use: 'travel' },
  ),
  mouse('link')(
    'wired',
    ['filaires', 'wired'],
    ['Souris filaires', 'Wired mice'],
    ['Filaires', 'Wired'],
    { connection: ['wired'] },
  ),
  mouse('feature')(
    'poll8k',
    ['8000-hz', '8000hz'],
    ['Souris 8 000 Hz', '8,000 Hz mice'],
    ['8 000 Hz', '8,000 Hz'],
    { musts: ['poll8k'] },
    { use: 'competitive' },
  ),
  mouse('feature')(
    'silent',
    ['silencieuses', 'silent'],
    ['Souris silencieuses', 'Silent mice'],
    ['Silencieuses', 'Silent'],
    { musts: ['silent'] },
    { use: 'office' },
  ),
  mouse('feature')(
    'freespin',
    ['molette-infinie', 'free-spin-wheel'],
    ['Souris à molette infinie', 'Mice with a free-spin wheel'],
    ['Molette infinie', 'Free-spin wheel'],
    { musts: ['freespin'] },
    { use: 'office' },
  ),
  mouse('feature')(
    'rechargeable',
    ['rechargeables', 'rechargeable'],
    ['Souris rechargeables', 'Rechargeable mice'],
    ['Rechargeables', 'Rechargeable'],
    { musts: ['rechargeable'] },
  ),
  mouse('price')(
    'under-50',
    ['moins-de-50-euros', 'under-50'],
    ['Souris à moins de 50 €', 'Mice under €50'],
    ['< 50 €', '< €50'],
    { budget: ['0-50'] },
  ),
  mouse('use')(
    'gaming',
    ['gamer', 'gaming'],
    ['Souris gamer', 'Gaming mice'],
    ['Pour jouer', 'For gaming'],
    {},
    { use: 'gaming' },
  ),
  mouse('use')(
    'office',
    ['bureau', 'office'],
    ['Souris de bureau', 'Office mice'],
    ['Pour le bureau', 'For the office'],
    {},
    { use: 'office' },
  ),
  mouse('use')(
    'claw',
    ['claw-grip', 'claw-grip'],
    ['Souris pour claw grip', 'Mice for a claw grip'],
    ['Claw grip', 'Claw grip'],
    { shape: HELD },
    { steer: { grip: 'claw' } },
  ),
  mouse('use')(
    'palm',
    ['palm-grip', 'palm-grip'],
    ['Souris pour palm grip', 'Mice for a palm grip'],
    ['Palm grip', 'Palm grip'],
    { shape: HELD },
    { steer: { grip: 'palm' } },
  ),
  mouse('use')(
    'fingertip',
    ['fingertip-grip', 'fingertip-grip'],
    ['Souris pour fingertip grip', 'Mice for a fingertip grip'],
    ['Fingertip grip', 'Fingertip grip'],
    { shape: HELD },
    { steer: { grip: 'fingertip' } },
  ),
]

/** Every collection of a category, in the order its catalogue lists them. */
export const collections: Record<Category, readonly Collection[]> = {
  keyboard: keyboards,
  monitor: monitors,
  mouse: mice,
}

/** The collection a page's address names, in its locale or the other one (to send it there). */
export function collectionFromSlug(category: Category, slug: string, locale: Locale) {
  const list = collections[category]
  const own = list.find((c) => c.slug[locale] === slug)
  if (own) return { collection: own, elsewhere: false }
  const other = list.find((c) => Object.values(c.slug).includes(slug))
  return other ? { collection: other, elsewhere: true } : null
}

/** A collection in a sentence, after "the 85": "claviers 75 % sans fil", "AZERTY keyboards". */
export const inSentence = (name: string) =>
  /^\p{Lu}\p{Ll}/u.test(name) ? name.charAt(0).toLocaleLowerCase() + name.slice(1) : name

// ---- Members and ranking ------------------------------------------------------------------------

/**
 * Whether the questionnaire still asks what a collection answers: a question or an option it
 * names may have gone since (the engine would ignore it, and the collection would hold every
 * product).
 */
function stillAsked(c: Collection) {
  const def = finderOf(c.category)
  const named = Object.entries({
    ...c.picks,
    ...Object.fromEntries(Object.entries(c.steer ?? {}).map(([key, id]) => [key, [id]])),
    ...(c.use ? { [def.profileStep]: [c.use] } : {}),
  })
  return named.every(([key, ids]) => {
    const step = def.steps.find((s) => s.key === key)
    if (!step) return false
    if (step.kind === 'range') return ids.every((id) => readRange(id) !== undefined)
    return ids.every((id) => step.options.some((o) => o.id === id))
  })
}

/**
 * A collection as the engine reads it: its answers, and the tests the engine's filters cannot
 * carry. They read one option of a single-answer question (the link): any of several (2.4 GHz or
 * Bluetooth) is a test of its own. A collection the questionnaire no longer answers holds
 * nothing, so it has no page, rather than a page of everything.
 */
function readPicks(c: Collection) {
  const def = finderOf(c.category)
  const answers: Answers = { ...c.steer }
  if (!stillAsked(c)) {
    console.warn(`The ${c.category} collection "${c.id}" names an answer the finder no longer has`)
    return { def, answers, passes: () => false }
  }
  if (c.use) answers[def.profileStep] = c.use
  const tests: ((item: CatalogItem) => boolean)[] = []
  for (const [key, ids] of Object.entries(c.picks)) {
    const step = stepOf(def, key)
    if (step.kind === 'single' && ids.length > 1) {
      const options = step.options.filter((o) => ids.includes(o.id))
      tests.push((item) => options.some((o) => o.match(item)))
    } else answers[key] = ids.join(',')
  }
  const passes = (item: CatalogItem) => tests.every((test) => test(item))
  return { def, answers, passes }
}

/** Per catalogue (the list a page or the finder holds) and per collection, what is worked out. */
const kept = new WeakMap<
  CatalogItem[],
  Map<string, { members?: CatalogItem[]; ranked?: Ranked<CatalogItem>[] }>
>()
const keptFor = (c: Collection, items: CatalogItem[]) => {
  let byId = kept.get(items)
  if (!byId) {
    byId = new Map()
    kept.set(items, byId)
  }
  let entry = byId.get(c.id)
  if (!entry) {
    entry = {}
    byId.set(c.id, entry)
  }
  return entry
}

/** A collection's products, in the catalogue's order: cheap, the engine's filters only. */
export function membersOf(c: Collection, items: CatalogItem[]): CatalogItem[] {
  const entry = keptFor(c, items)
  if (!entry.members) {
    const { def, answers, passes } = readPicks(c)
    entry.members = filter(def, items, answers).filter(passes)
  }
  return entry.members
}

/**
 * A collection's products, ranked as the finder ranks them for the same answers: over the whole
 * catalogue, so that a missing figure counts as the catalogue's typical one, as in the finder.
 */
export function rankingOf(c: Collection, items: CatalogItem[]): Ranked<CatalogItem>[] {
  const entry = keptFor(c, items)
  if (!entry.ranked) {
    const { def, answers, passes } = readPicks(c)
    entry.ranked = rank(def, items, answers).filter((r) => passes(r.item))
  }
  return entry.ranked
}

/** A category's collections with enough products for a page of their own, in the catalogue. */
export const livingCollections = (category: Category, items: CatalogItem[]) =>
  collections[category].filter((c) => membersOf(c, items).length >= MIN_SIZE)

/** The living collections a product belongs to: only those are ranked for its sheet. */
const holding = (item: CatalogItem, items: CatalogItem[]) =>
  livingCollections(item.category, items).filter((c) =>
    membersOf(c, items).some((member) => member.slug === item.slug),
  )

/**
 * The collections a page suggests beside its own: those that share one of its answers (the same
 * size, another link), then those that answer the same questions otherwise (another size), the
 * narrower and wider ones first. Uses go with uses.
 */
export function neighboursOf(
  c: Collection,
  living: readonly Collection[],
  count = 8,
): Collection[] {
  const keys = Object.keys(c.picks)
  const score = (other: Collection) => {
    let s = 0
    for (const [key, ids] of Object.entries(other.picks)) {
      const own = c.picks[key]
      if (!own) continue
      s += ids.some((id) => own.includes(id)) ? 3 : 1
    }
    const otherKeys = Object.keys(other.picks)
    // One answer more or less than this one: a narrower or a wider view of it.
    if (Math.abs(otherKeys.length - keys.length) === 1 && s >= 3) s += 1
    if (!keys.length && !otherKeys.length) s += 2
    return s
  }
  return living
    .filter((other) => other.id !== c.id)
    .map((other) => ({ other, s: score(other) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, count)
    .map(({ other }) => other)
}

// ---- Where a product stands ---------------------------------------------------------------------

export type Standing = { collection: Collection; rank: number; size: number }

/**
 * Where a product stands in the collections it belongs to, best placed first: its rank against
 * the collection's size, then the narrower collection. What its sheet lists.
 */
export function standingsOf(item: CatalogItem, items: CatalogItem[]): Standing[] {
  const out: Standing[] = []
  for (const c of holding(item, items)) {
    const ranked = rankingOf(c, items)
    const index = ranked.findIndex((r) => r.item.slug === item.slug)
    if (index >= 0 && index < LISTED)
      out.push({ collection: c, rank: index + 1, size: ranked.length })
  }
  return out.sort((a, b) => a.rank / a.size - b.rank / b.size || a.size - b.size)
}

/** What a product's sheet says first about it, when it stands out somewhere. */
export type Highlight = { kind: 'cheapest' | 'first'; collection: Collection; size: number }

/**
 * The one line worth saying about a product among its peers: first of a collection, or the
 * cheapest of one (no other at its price); the widest such collection, which says the most, first
 * place before the price. A whole catalogue ranked for a use, shells ranked for a grip, or the
 * products under a price have no cheapest worth saying.
 */
export function highlightOf(item: CatalogItem, items: CatalogItem[]): Highlight | null {
  const found: Highlight[] = []
  for (const c of holding(item, items)) {
    const ranked = rankingOf(c, items)
    const size = ranked.length
    if (ranked[0]?.item.slug === item.slug) found.push({ kind: 'first', collection: c, size })
    if (!Object.keys(c.picks).length || c.steer || c.group === 'price') continue
    if (ranked.every((r) => r.item.slug === item.slug || r.item.priceEur > item.priceEur))
      found.push({ kind: 'cheapest', collection: c, size })
  }
  const firstFirst = (a: Highlight, b: Highlight) =>
    a.kind === b.kind ? 0 : a.kind === 'first' ? -1 : 1
  return found.sort((a, b) => b.size - a.size || firstFirst(a, b))[0] ?? null
}
