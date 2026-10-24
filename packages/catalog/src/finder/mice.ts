import type { MouseItem } from '../domain/items'
import { text } from '../i18n'
import { gripFit, gripOf, type SizeBand, sizeBandOf, sizeIndex } from './mouse-fit'
import { settleTies } from './settle'
import { ANY, type Answers, type FinderDefinition, type Option } from './types'

// The mouse questionnaire. The use first (ranking profile only), then the hand and the shape, the
// two answers that decide which shells can be used at all; then the fit: the grip steers the
// ranking, the size (each tile says which hands it suits) and the weight narrow the catalogue; the
// side buttons, the connection, the budget and must-haves last. No hand-size question: it read too
// much like the mouse's own size, so its guidance went into the size tiles. No colour question, as
// for keyboards: a colour rarely decides between mice. No "8 buttons" or "MMO grid" must-have: the
// side-button question says it better. The grip model lives in mouse-fit.ts.

type M = MouseItem
const opt = (
  id: string,
  fr: string,
  en: string,
  match: (m: M) => boolean,
  hint?: [string, string],
): Option<M> => ({
  id,
  label: text(fr, en),
  hint: hint && text(...hint),
  match,
})

const shapesOf = (answers: Answers) =>
  answers.shape && answers.shape !== ANY ? answers.shape.split(',') : []
/** Whether the answers keep shells held by a grip (symmetrical or ergonomic), or say nothing yet. */
const keepsShells = (answers: Answers) => {
  const shapes = shapesOf(answers)
  return !shapes.length || shapes.includes('sym') || shapes.includes('ergo')
}

/** Whether the answers keep a mouse with a flank under the thumb: trackballs alone have none. */
const keepsFlanks = (answers: Answers) => {
  const shapes = shapesOf(answers)
  return !shapes.length || shapes.some((s) => !s.startsWith('tb_'))
}

/**
 * A trackball stays put on the desk: the size and weight questions, asked of the shells a hand
 * moves, leave it in whatever the visitor picks (a shape answer may keep both kinds).
 */
const sitsStill = (m: M) => m.specs.shape === 'trackball'
const inBand = (band: SizeBand) => (m: M) => sitsStill(m) || sizeBandOf(m) === band
/** A few grams either side of a band are not another mouse: they still count. */
const GRACE_G = 3
const weighs = (lo: number, hi: number) => (m: M) =>
  sitsStill(m) ||
  (m.specs.weightG != null && m.specs.weightG >= lo - GRACE_G && m.specs.weightG < hi + GRACE_G)
/** Buttons on the thumb's flank, between lo and hi. A mouse whose count is unknown answers none. */
const sides =
  (lo: number, hi = lo) =>
  (m: M) =>
    m.specs.sideButtons != null && m.specs.sideButtons >= lo && m.specs.sideButtons <= hi
const wireless = (m: M) => m.specs.conn24ghz || m.specs.connBt
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export const mouseFinder: FinderDefinition<M> = {
  category: 'mouse',
  profileStep: 'use',
  id: (m) => m.slug,
  price: (m) => m.priceEur,
  prior: (m) => 0.6 * m.editorialScore + 0.4 * m.popularity,
  settle: settleTies,
  maker: (m) => m.brand.slug,
  // A mouse like another fits the same hand (never one for the other hand), then has its shape,
  // its size, its weight and its link.
  likeness: [
    { key: 'hand', weight: 1, hard: true },
    { key: 'shape', weight: 3 },
    { key: 'size', weight: 2 },
    { key: 'weight', weight: 2 },
    { key: 'connection', weight: 1 },
  ],
  steps: [
    {
      key: 'use',
      kind: 'single',
      weightOnly: true,
      required: true,
      label: text('Usage', 'Use'),
      title: text('À quoi va-t-elle servir ?', 'What is it for?'),
      help: text(
        "Cette réponse n'écarte aucune souris : elle règle ce qui compte le plus dans le classement (légèreté et réactivité pour le jeu compétitif, molette et multi-appareils pour le bureau, compacité pour le voyage…).",
        'This answer rules nothing out: it decides what matters most in the ranking (lightness and responsiveness for competitive play, the wheel and multi-device for the office, compactness on the go…).',
      ),
      // Each hint says what the ranking looks for first for this use.
      options: [
        opt('competitive', 'Jeu compétitif', 'Competitive gaming', () => true, [
          'Légère, capteur de pointe',
          'Light, top sensor',
        ]),
        opt('gaming', 'Jeu polyvalent', 'All-round gaming', () => true, [
          'Boutons, autonomie, confort',
          'Buttons, battery, comfort',
        ]),
        opt('office', 'Bureau & productivité', 'Office & productivity', () => true, [
          'Molette, multi‑appareils, silence',
          'Wheel, multi-device, quiet',
        ]),
        opt('travel', 'Nomade', 'On the go', () => true, [
          'Compacte, Bluetooth, autonome',
          'Compact, Bluetooth, long battery',
        ]),
      ],
    },
    {
      key: 'hand',
      kind: 'single',
      required: true,
      label: text('Main', 'Hand'),
      title: text('Avec quelle main ?', 'Which hand do you use?'),
      help: text(
        'Une souris ergonomique est sculptée pour une main, et les boutons de côté se placent sous le pouce. À gauche restent les souris ambidextres (des boutons des deux côtés, ou aucun sur les flancs) et les modèles pour gauchers.',
        'An ergonomic mouse is sculpted for one hand, and side buttons sit under the thumb. Left-handed, you keep the ambidextrous mice (buttons on both sides, or none on the sides) and the left-handed models.',
      ),
      options: [
        opt('right', 'Main droite', 'Right hand', (m) => m.specs.hand !== 'left', [
          'Toutes les souris pour droitiers',
          'Every right-handed mouse',
        ]),
        opt('left', 'Main gauche', 'Left hand', (m) => m.specs.hand !== 'right', [
          'Ambidextres et modèles gauchers',
          'Ambidextrous and left-handed',
        ]),
      ],
    },
    {
      key: 'shape',
      kind: 'multi',
      required: true,
      label: text('Forme', 'Shape'),
      title: text('Quelle forme ?', 'Which shape?'),
      help: text(
        'La forme décide de la façon de tenir la souris. **Symétrique** : les deux flancs se ressemblent, à l’aise en griffe et du bout des doigts. **Ergonomique** : sculptée pour la main, la paume s’y pose. **Verticale** : la main se tient de profil, comme pour serrer une main, et le poignet ne se tord plus. **Trackball** : on fait rouler une boule au lieu de déplacer la souris, sous le pouce ou sous les doigts. Choisis-en plusieurs si tu hésites.',
        'The shape decides how you hold it. **Symmetrical**: both sides alike, at ease in a claw or fingertip grip. **Ergonomic**: sculpted for the hand, the palm rests on it. **Vertical**: the hand stands sideways, as in a handshake, and the wrist no longer twists. **Trackball**: you roll a ball instead of moving the mouse, under the thumb or under the fingers. Pick several if unsure.',
      ),
      // The drawing shows the shape: one short line each.
      options: [
        opt('sym', 'Symétrique', 'Symmetrical', (m) => m.specs.shape === 'symmetrical', [
          'Même profil des deux côtés',
          'Same on both sides',
        ]),
        opt('ergo', 'Ergonomique', 'Ergonomic', (m) => m.specs.shape === 'ergonomic', [
          'Sculptée pour la main',
          'Sculpted for the hand',
        ]),
        opt('vertical', 'Verticale', 'Vertical', (m) => m.specs.shape === 'vertical', [
          'Poignet au repos',
          'Relaxed wrist',
        ]),
        opt(
          'tb_thumb',
          'Trackball au pouce',
          'Thumb trackball',
          (m) => m.specs.shape === 'trackball' && m.specs.ballPosition === 'thumb',
          ['Boule sous le pouce', 'Ball under the thumb'],
        ),
        opt(
          'tb_finger',
          'Trackball aux doigts',
          'Finger trackball',
          (m) => m.specs.shape === 'trackball' && m.specs.ballPosition === 'finger',
          ['Grande boule au centre', 'Large ball in the middle'],
        ),
      ],
    },
    {
      key: 'grip',
      kind: 'multi',
      weightOnly: true,
      feeds: ['gripFit'],
      anyLabel: text('Je ne sais pas', 'Not sure'),
      applies: keepsShells,
      label: text('Prise', 'Grip'),
      title: text('Comment la tiens-tu ?', 'How do you hold it?'),
      help: text(
        '**Paume** : toute la main repose sur la souris, qui doit être assez longue et bombée. **Griffe** : les doigts sont arqués, seule la base de la paume touche l’arrière. **Bout des doigts** : seuls les doigts la tiennent, une souris courte et légère va mieux. Entre deux prises ? Choisis les deux voisines.',
        '**Palm**: the whole hand rests on the mouse, which must be long and domed enough. **Claw**: the fingers are arched, only the base of the palm touches the back. **Fingertip**: only the fingers hold it, a short and light mouse suits best. Between two grips? Pick both neighbours.',
      ),
      options: [
        opt('palm', 'Paume', 'Palm', () => true, ['Toute la main posée', 'Whole hand resting']),
        opt('claw', 'Griffe', 'Claw', () => true, ['Doigts arqués', 'Arched fingers']),
        opt('fingertip', 'Bout des doigts', 'Fingertip', () => true, [
          'Seuls les doigts',
          'Fingertips only',
        ]),
      ],
    },
    {
      key: 'size',
      kind: 'multi',
      applies: keepsShells,
      label: text('Taille', 'Size'),
      title: text('Quelle taille de souris ?', 'How big should the mouse be?'),
      help: text(
        'Main mesurée du poignet au bout du majeur. En prise paume, prends la taille au-dessus ; du bout des doigts, celle en dessous. **Petite** : jusqu’à 119 mm. **Moyenne** : 119 à 126 mm. **Grande** : 126 à 130 mm. **Très grande** : au-delà.',
        'Hand measured from wrist to middle fingertip. In a palm grip, go one size up; at the fingertips, one down. **Small**: up to 119 mm. **Medium**: 119 to 126 mm. **Large**: 126 to 130 mm. **Extra large**: beyond.',
      ),
      // The drawing shows the size; the line under it, the hands it suits.
      options: [
        opt('small', 'Petite', 'Small', inBand('small'), [
          'Main de moins de 17 cm',
          'Hand under 17 cm',
        ]),
        opt('medium', 'Moyenne', 'Medium', inBand('medium'), [
          'Main de 17 à 19 cm',
          'Hand 17 to 19 cm',
        ]),
        opt('large', 'Grande', 'Large', inBand('large'), [
          'Main de 19 à 21 cm',
          'Hand 19 to 21 cm',
        ]),
        opt('xl', 'Très grande', 'Extra large', inBand('xl'), [
          'Main de plus de 21 cm',
          'Hand over 21 cm',
        ]),
      ],
    },
    {
      key: 'weight',
      kind: 'multi',
      applies: keepsShells,
      label: text('Poids', 'Weight'),
      title: text('Quel poids ?', 'How heavy?'),
      help: text(
        'Le poids de la souris seule, sans câble ni dongle (piles comprises pour une souris à piles). Une souris légère part au moindre geste en jeu ; un peu de poids pose la main au bureau. À 3 g près, une souris compte aussi dans la tranche voisine. Choisis-en plusieurs si tu hésites.',
        'The weight of the mouse alone, without cable or dongle (batteries included for a battery mouse). A light mouse moves at the slightest flick in games; a little weight steadies the hand at a desk. Within 3 g, a mouse also counts in the next band. Pick several if unsure.',
      ),
      options: [
        opt('feather', 'Plume', 'Featherweight', weighs(0, 40), ['Moins de 40 g', 'Under 40 g']),
        opt('ultralight', 'Ultra-légère', 'Ultralight', weighs(40, 55), [
          'De 40 à 55 g',
          '40 to 55 g',
        ]),
        opt('light', 'Légère', 'Light', weighs(55, 70), ['De 55 à 70 g', '55 to 70 g']),
        opt('mid', 'Moyenne', 'Mid-weight', weighs(70, 90), ['De 70 à 90 g', '70 to 90 g']),
        opt('heavy', 'Lourde', 'Heavy', weighs(90, Number.POSITIVE_INFINITY), [
          'Plus de 90 g',
          'Over 90 g',
        ]),
      ],
    },
    {
      key: 'sideButtons',
      kind: 'multi',
      applies: keepsFlanks,
      label: text('Boutons', 'Buttons'),
      title: text('Combien de boutons sur le côté ?', 'How many side buttons?'),
      help: text(
        'Les boutons sous le pouce : avant, arrière, et ceux qu’on ajoute pour jouer ou travailler (tir de précision, geste, pavé MMO). Une ambidextre compte ceux d’un seul côté. Choisis-en plusieurs si tu hésites.',
        'The buttons under the thumb: back, forward, and those added for games or work (sniper, gesture, MMO grid). An ambidextrous mouse counts one side. Pick several if unsure.',
      ),
      options: [
        opt('none', 'Aucun', 'None', sides(0), ['Rien sous le pouce', 'Nothing under the thumb']),
        opt('two', '2', '2', sides(2), ['Avant et arrière', 'Back and forward']),
        opt('few', '3 à 5', '3 to 5', sides(3, 5), [
          'G502, Basilisk, MX Master',
          'G502, Basilisk, MX Master',
        ]),
        opt('many', '6 et plus', '6 or more', sides(6, Number.POSITIVE_INFINITY), [
          'Pavé MMO',
          'MMO grid',
        ]),
      ],
    },
    {
      key: 'connection',
      kind: 'single',
      label: text('Connexion', 'Connection'),
      title: text('Comment la connecter ?', 'How should it connect?'),
      help: text(
        '**2,4 GHz** : un dongle USB, la latence du jeu. **Bluetooth** : sans dongle, passe d’un appareil à l’autre (ordinateur, tablette). **Filaire uniquement** : pas de batterie, souvent moins chère.',
        '**2.4 GHz**: a USB dongle, gaming latency. **Bluetooth**: no dongle, hops between devices (computer, tablet). **Wired only**: no battery, often cheaper.',
      ),
      options: [
        opt('dongle', 'Sans fil 2,4 GHz', '2.4 GHz wireless', (m) => m.specs.conn24ghz, [
          'Dongle USB, latence de jeu',
          'USB dongle, gaming latency',
        ]),
        opt('bluetooth', 'Bluetooth', 'Bluetooth', (m) => m.specs.connBt, [
          'Sans dongle, plusieurs appareils',
          'No dongle, several devices',
        ]),
        opt(
          'both',
          '2,4 GHz + Bluetooth',
          '2.4 GHz + Bluetooth',
          (m) => m.specs.conn24ghz && m.specs.connBt,
          ['Latence de jeu et multi‑appareils', 'Gaming latency and multi-device'],
        ),
        opt('wired', 'Filaire uniquement', 'Wired only', (m) => !wireless(m), [
          'Sans batterie, souvent moins chère',
          'No battery, often cheaper',
        ]),
      ],
    },
    {
      key: 'budget',
      kind: 'range',
      label: text('Budget', 'Budget'),
      title: text('Quel budget ?', "What's your budget?"),
      help: text(
        'L’histogramme montre combien de souris restent à chaque prix avec tes autres réponses.',
        'The histogram shows how many mice remain at each price given your other answers.',
      ),
      value: (m) => m.priceEur,
      // Most mice sell between 20 and 180 €: 5 € steps, the top of the scale for anything above.
      bounds: [0, 200],
      snap: 5,
    },
    {
      key: 'musts',
      kind: 'musts',
      label: text('Indispensables', 'Must-haves'),
      title: text('Des indispensables ?', 'Any must-haves?'),
      help: text(
        'Chaque indispensable s’ajoute aux autres : une souris doit tous les avoir. Seuls ceux qui départagent encore les souris restantes sont proposés.',
        'Must-haves add up: a mouse has to have all of them. Only the ones that still split the remaining mice are offered.',
      ),
      options: [
        opt('poll8k', '8 000 Hz', '8,000 Hz', (m) => (m.specs.pollingHz ?? 0) >= 8000, [
          'Fréquence max, dongle inclus',
          'Top report rate, dongle included',
        ]),
        opt('multidevice', 'Multi-appareils', 'Multi-device', (m) => m.specs.hosts >= 2, [
          'Bascule entre plusieurs ordis',
          'Switches between computers',
        ]),
        opt('silent', 'Clics silencieux', 'Silent clicks', (m) => m.specs.silentClicks, [
          'Pour l’open space, la nuit',
          'For open offices, late nights',
        ]),
        opt('freespin', 'Molette rapide', 'Free-spin wheel', (m) => m.specs.freeSpinWheel, [
          'Défile sans crans',
          'Spins without notches',
        ]),
        opt(
          'hscroll',
          'Défilement horizontal',
          'Horizontal scroll',
          (m) => m.specs.thumbWheel || m.specs.tiltWheel,
          ['Molette latérale ou inclinable', 'Thumb or tilt wheel'],
        ),
        opt('charging', 'Recharge sans fil', 'Wireless charging', (m) => m.specs.wirelessCharging, [
          'Sur un tapis ou un socle',
          'On a pad or a dock',
        ]),
        opt(
          'rechargeable',
          'Batterie rechargeable',
          'Rechargeable battery',
          (m) => m.specs.power === 'rechargeable',
          ['Pas de piles à changer', 'No batteries to swap'],
        ),
        opt(
          'optical',
          'Switchs optiques',
          'Optical switches',
          (m) => m.specs.switchType === 'optical' || m.specs.switchType === 'magnetic',
          ['Pas de double-clic fantôme', 'No phantom double clicks'],
        ),
        opt('rgb', 'RGB', 'RGB', (m) => m.specs.rgb, ['Éclairage réglable', 'Adjustable lighting']),
      ],
    },
  ],

  // ---- Ranking -------------------------------------------------------------------------------
  criteria: [
    {
      key: 'gripFit',
      label: text('Forme adaptée à ta prise', 'Shaped for your grip'),
      weakLabel: text('Forme moins adaptée à ta prise', 'Less suited to your grip'),
      active: (answers) => gripOf(answers) != null,
      score: gripFit,
    },
    {
      key: 'light',
      label: text('Très légère', 'Very light'),
      weakLabel: text('Plutôt lourde', 'On the heavy side'),
      // A trackball's sheet may not give its weight: it counts as the typical one of its kind.
      known: (m) => m.specs.weightG != null,
      peers: (m) => m.specs.shape,
      score: (m) => 1 / (1 + Math.exp(((m.specs.weightG ?? 80) - 80) / 12)),
    },
    {
      key: 'sensor',
      label: text('Capteur et fréquence de pointe', 'Top sensor and report rate'),
      weakLabel: text('Fréquence modeste', 'Modest report rate'),
      known: (m) => m.specs.pollingHz != null,
      peers: (m) => m.specs.segment,
      // On a log scale: 125 Hz (an office mouse) → 0.1, 1 000 Hz → 0.55, 8 000 Hz → 1.
      score: (m) =>
        clamp01(
          0.1 +
            (0.45 * Math.log2((m.specs.pollingHz ?? 1000) / 125)) / 3 +
            (m.specs.switchType === 'optical' || m.specs.switchType === 'magnetic' ? 0.05 : 0),
        ),
    },
    {
      key: 'wireless',
      label: text('Sans fil', 'Wireless'),
      weakLabel: text('Filaire seulement', 'Wired only'),
      score: (m) => (m.specs.conn24ghz ? 1 : m.specs.connBt ? 0.6 : 0.3),
    },
    {
      key: 'battery',
      label: text('Grande autonomie', 'Long battery life'),
      weakLabel: text('Autonomie courte', 'Short battery life'),
      // Wired: nothing to charge, nothing to praise. Batteries last months. A rechargeable mouse
      // without a figure counts as the typical rechargeable one.
      known: (m) =>
        !wireless(m) || m.specs.power !== 'rechargeable' || m.specs.batteryHours != null,
      peers: (m) => m.specs.power ?? 'wired',
      score: (m) => {
        if (!wireless(m)) return 0.7
        if (m.specs.power === 'aa' || m.specs.power === 'aaa') return 0.9
        return Math.min(1, (m.specs.batteryHours ?? 70) / 150) ** 0.6
      },
    },
    {
      key: 'multidevice',
      label: text('Plusieurs appareils', 'Several devices'),
      weakLabel: text('Un seul appareil', 'One device only'),
      score: (m) =>
        m.specs.hosts >= 3 ? 1 : m.specs.hosts === 2 ? 0.75 : m.specs.connBt ? 0.45 : 0.1,
    },
    {
      key: 'scroll',
      label: text('Molette polyvalente', 'Versatile wheel'),
      weakLabel: text('Molette simple', 'Basic wheel'),
      score: (m) =>
        Math.min(
          1,
          0.15 +
            (m.specs.freeSpinWheel ? 0.45 : 0) +
            (m.specs.thumbWheel ? 0.3 : 0) +
            (m.specs.tiltWheel ? 0.15 : 0),
        ),
    },
    {
      key: 'quiet',
      label: text('Clics silencieux', 'Silent clicks'),
      // Ordinary clicks are no flaw: they never fall below the weakness line.
      weakLabel: text('Clics sonores', 'Audible clicks'),
      score: (m) => (m.specs.silentClicks ? 1 : 0.35),
    },
    {
      key: 'comfort',
      label: text('Confort ergonomique', 'Ergonomic comfort'),
      weakLabel: text('Peu ergonomique', 'Not very ergonomic'),
      score: (m) =>
        ({
          vertical: 1,
          trackball: 0.85,
          ergonomic: m.specs.segment === 'office' ? 0.9 : 0.75,
          symmetrical: 0.45,
        })[m.specs.shape],
    },
    {
      key: 'compact',
      label: text('Compacte, se glisse partout', 'Compact, travels well'),
      weakLabel: text('Encombrante en voyage', 'Bulky to carry'),
      score: (m) =>
        m.specs.shape === 'trackball' ? 0.3 : clamp01(0.2 + ((125 - sizeIndex(m)) / 25) * 0.8),
    },
    {
      key: 'buttons',
      label: text('Nombreux boutons', 'Plenty of buttons'),
      weakLabel: text('Peu de boutons', 'Few buttons'),
      known: (m) => m.specs.buttons != null || m.specs.mmo,
      peers: (m) => m.specs.segment,
      score: (m) => (m.specs.mmo ? 1 : clamp01(((m.specs.buttons ?? 5) - 3) / 9)),
    },
  ],
  profiles: {
    competitive: { gripFit: 1, light: 2.5, sensor: 2, wireless: 1 },
    gaming: { gripFit: 1, sensor: 1, light: 1, wireless: 1, battery: 1, buttons: 1 },
    office: {
      gripFit: 0.5,
      comfort: 2,
      multidevice: 2,
      scroll: 2,
      quiet: 1.5,
      battery: 1.5,
    },
    travel: { compact: 3, multidevice: 2, battery: 2, wireless: 2, light: 1 },
    default: { gripFit: 1, sensor: 1, light: 1, wireless: 1 },
  },
}
