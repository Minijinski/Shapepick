import type { MonitorItem } from '../domain/items'
import { text } from '../i18n'
import type { FinderDefinition, Option } from './types'

// The monitor questionnaire. Same shape as the keyboard one: use first (ranking profile only),
// then the physical format, the technical choices with their demos, budget, must-haves.

type M = MonitorItem
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

const wide = (m: M) =>
  m.specs.aspect === '16:9' || m.specs.aspect === '16:10' || m.specs.aspect === '3:2'
const between = (v: number, lo: number, hi: number) => v >= lo && v < hi
const isOled = (m: M) => m.specs.panel === 'woled' || m.specs.panel === 'qdoled'
const isMiniLed = (m: M) => m.specs.panel === 'miniled_ips' || m.specs.panel === 'miniled_va'
const trueHdr = (m: M) =>
  ['hdr600', 'hdr1000', 'hdr1400', 'true_black_400', 'true_black_500'].includes(m.specs.hdrCert)
const atLeast = (hz: number) => (m: M) => m.specs.refreshHzMax >= hz

/** Normalised log scale: 60 Hz → 0, 540 Hz → 1. */
const refreshScore = (hz: number) =>
  Math.min(1, Math.max(0, Math.log(hz / 60) / Math.log(540 / 60)))

export const monitorFinder: FinderDefinition<M> = {
  category: 'monitor',
  profileStep: 'use',
  id: (m) => m.slug,
  price: (m) => m.priceEur,
  prior: (m) => 0.6 * m.editorialScore + 0.4 * m.popularity,
  steps: [
    {
      key: 'use',
      kind: 'single',
      weightOnly: true,
      required: true,
      label: text('Usage', 'Use'),
      title: text('Pour quoi faire ?', 'What is it for?'),
      help: text(
        "Cette réponse n'écarte aucun écran : elle règle ce qui compte le plus dans le classement (fluidité pour l'e-sport, contraste et HDR pour l'immersion, fidélité des couleurs pour la création…).",
        'This answer rules nothing out: it decides what matters most in the ranking (motion clarity for esports, contrast and HDR for immersion, colour accuracy for creative work…).',
      ),
      options: [
        opt('fps', 'FPS compétitif', 'Competitive FPS', () => true, [
          'Chaque milliseconde compte',
          'Every millisecond counts',
        ]),
        opt('immersive', 'Jeu immersif', 'Immersive gaming', () => true, [
          'AAA, simulation, HDR',
          'AAA, sim, HDR',
        ]),
        opt('console', 'Console', 'Console', () => true, [
          'PS5, Xbox, Switch 2',
          'PS5, Xbox, Switch 2',
        ]),
        opt('creative', 'Création', 'Creative work', () => true, [
          'Photo, vidéo, design',
          'Photo, video, design',
        ]),
        opt('office', 'Bureau & code', 'Office & code', () => true, [
          'Texte net, ergonomie',
          'Sharp text, ergonomics',
        ]),
        opt('mixed', 'Polyvalent', 'All-rounder', () => true, [
          'Un peu de tout',
          'A bit of everything',
        ]),
      ],
    },
    {
      key: 'format',
      kind: 'multi',
      required: true,
      label: text('Format', 'Format'),
      title: text('Quelle taille ?', 'How big?'),
      help: text(
        'La diagonale se lit avec la distance : à 60–80 cm, un 27" remplit le champ de vision, un 32" demande de tourner la tête. Les ultra-larges (21:9, 32:9) remplacent deux écrans. Choisis-en plusieurs si tu hésites.',
        'Read the diagonal against the distance: at 60–80 cm a 27" fills your view, a 32" makes you turn your head. Ultrawides (21:9, 32:9) replace two screens. Pick several if unsure.',
      ),
      options: [
        opt('s24', '24"', '24"', (m) => wide(m) && m.specs.diagonalIn < 25.5, [
          'Compact, e-sport',
          'Compact, esports',
        ]),
        opt('s27', '27"', '27"', (m) => wide(m) && between(m.specs.diagonalIn, 25.5, 29.5), [
          'Le plus polyvalent',
          'The all-rounder',
        ]),
        opt('s32', '32"', '32"', (m) => wide(m) && between(m.specs.diagonalIn, 29.5, 36), [
          'Grand espace de travail',
          'Big workspace',
        ]),
        opt(
          'uw34',
          'Ultra-large 34"',
          'Ultrawide 34"',
          (m) => m.specs.aspect === '21:9' && m.specs.diagonalIn < 36.5,
          ['21:9', '21:9'],
        ),
        opt(
          'uw38',
          'Ultra-large 38–40"',
          'Ultrawide 38–40"',
          (m) => m.specs.aspect === '21:9' && m.specs.diagonalIn >= 36.5,
          ['21:9, très large', '21:9, very wide'],
        ),
        opt('suw', 'Super-ultra-large', 'Super ultrawide', (m) => m.specs.aspect === '32:9', [
          '32:9, deux écrans en un',
          '32:9, two screens in one',
        ]),
        opt('big', 'Grand format 42"+', 'Large 42"+', (m) => wide(m) && m.specs.diagonalIn >= 36, [
          'Comme une TV',
          'TV-like',
        ]),
      ],
    },
    {
      key: 'resolution',
      kind: 'multi',
      label: text('Netteté', 'Sharpness'),
      title: text('Quelle netteté ?', 'How sharp?'),
      help: text(
        'Ce qui compte vraiment, c’est la densité de pixels (PPI) : 1440p sur un 27" donne 109 PPI, 4K sur la même taille 163 PPI, un texte nettement plus fin. La 1080p reste idéale en 24" pour l’e-sport.',
        'What really matters is pixel density (PPI): 1440p on a 27" is 109 PPI, 4K on the same size is 163 PPI, visibly finer text. 1080p is still ideal on a 24" for esports.',
      ),
      options: [
        opt('fhd', '1080p', '1080p', (m) => m.specs.resH <= 1080, ['Full HD', 'Full HD']),
        opt('qhd', '1440p', '1440p', (m) => between(m.specs.resH, 1081, 2160), [
          'QHD, le bon équilibre',
          'QHD, the sweet spot',
        ]),
        opt('uhd', '4K', '4K', (m) => between(m.specs.resH, 2160, 2880), [
          'Très net',
          'Very sharp',
        ]),
        opt('5k', '5K et plus', '5K and up', (m) => m.specs.resH >= 2880, [
          'Type Retina',
          'Retina-class',
        ]),
      ],
    },
    {
      key: 'panel',
      kind: 'multi',
      label: text('Dalle', 'Panel'),
      title: text('Quelle dalle ?', 'Which panel?'),
      help: text(
        'IPS : couleurs fidèles, bons angles, noirs moyens. VA : fort contraste, idéal dans le noir, un peu de traînée. OLED : noirs parfaits et réactivité instantanée, attention au marquage sur les éléments fixes. Mini-LED : très lumineux, excellent en HDR. TN : réactif et bon marché, couleurs ternes.',
        'IPS: accurate colours, good angles, average blacks. VA: high contrast, great in the dark, some smearing. OLED: perfect blacks and instant response, watch for burn-in on static elements. Mini-LED: very bright, excellent HDR. TN: fast and cheap, washed-out colours.',
      ),
      options: [
        opt('ips', 'IPS', 'IPS', (m) => m.specs.panel === 'ips', [
          'Couleurs fidèles',
          'Accurate colours',
        ]),
        opt('va', 'VA', 'VA', (m) => m.specs.panel === 'va', ['Contraste élevé', 'High contrast']),
        opt('oled', 'OLED', 'OLED', isOled, ['Noirs parfaits', 'Perfect blacks']),
        opt('miniled', 'Mini-LED', 'Mini-LED', isMiniLed, ['HDR très lumineux', 'Very bright HDR']),
        opt('tn', 'TN', 'TN', (m) => m.specs.panel === 'tn', ['Rapide, économique', 'Fast, cheap']),
      ],
    },
    {
      key: 'refresh',
      kind: 'single',
      label: text('Fluidité', 'Refresh rate'),
      title: text('Quelle fluidité ?', 'How smooth?'),
      help: text(
        'La fréquence minimale que tu acceptes. 60 Hz suffit pour la bureautique, 144 Hz change tout en jeu, 240 Hz et plus visent l’e-sport. Au-delà de la fréquence, la clarté en mouvement dépend aussi de la dalle (l’OLED est la plus nette).',
        'The lowest refresh rate you accept. 60 Hz is fine for office work, 144 Hz transforms gaming, 240 Hz and up targets esports. Beyond the number, motion clarity also depends on the panel (OLED is the clearest).',
      ),
      options: [
        opt('60', '60 Hz suffisent', '60 Hz is fine', atLeast(60), ['Bureautique', 'Office work']),
        opt('100', '100 Hz et plus', '100 Hz and up', atLeast(100), [
          'Plus doux au quotidien',
          'Smoother everyday',
        ]),
        opt('144', '144 Hz et plus', '144 Hz and up', atLeast(144), [
          'Le standard du jeu',
          'The gaming standard',
        ]),
        opt('240', '240 Hz et plus', '240 Hz and up', atLeast(240), ['Jeu rapide', 'Fast games']),
        opt('360', '360 Hz et plus', '360 Hz and up', atLeast(360), ['E-sport', 'Esports']),
      ],
    },
    {
      key: 'curve',
      kind: 'single',
      label: text('Courbure', 'Curvature'),
      title: text('Plat ou incurvé ?', 'Flat or curved?'),
      help: text(
        'La courbure garde les bords à la même distance des yeux : utile au-delà de 32" et sur les ultra-larges, moins pour la retouche où les lignes droites doivent le rester.',
        'A curve keeps the edges at the same distance from your eyes: useful past 32" and on ultrawides, less so for retouching where straight lines must stay straight.',
      ),
      options: [
        opt('flat', 'Plat', 'Flat', (m) => m.specs.curvatureR == null),
        opt('curved', 'Incurvé', 'Curved', (m) => m.specs.curvatureR != null),
      ],
    },
    {
      key: 'budget',
      kind: 'range',
      label: text('Budget', 'Budget'),
      title: text('Quel budget ?', "What's your budget?"),
      help: text(
        'L’histogramme montre combien d’écrans restent à chaque prix avec tes réponses précédentes.',
        'The histogram shows how many monitors remain at each price given your previous answers.',
      ),
      value: (m) => m.priceEur,
      bounds: [0, 2000],
      snap: 50,
    },
    {
      key: 'musts',
      kind: 'musts',
      label: text('Indispensables', 'Must-haves'),
      title: text('Des indispensables ?', 'Any must-haves?'),
      help: text(
        'Chaque indispensable s’ajoute aux autres : un écran doit tous les avoir. Seuls ceux qui départagent encore les écrans restants sont proposés.',
        'Must-haves add up: a monitor has to have all of them. Only the ones that still split the remaining monitors are offered.',
      ),
      options: [
        opt('usbc', 'USB-C 65 W+', 'USB-C 65 W+', (m) => m.specs.usbcPdW >= 65, [
          'Un câble pour le portable',
          'One cable for the laptop',
        ]),
        opt('kvm', 'KVM', 'KVM', (m) => m.specs.kvm, [
          'Clavier/souris partagés',
          'Shared keyboard/mouse',
        ]),
        opt('hdr', 'HDR véritable', 'True HDR', trueHdr, [
          'DisplayHDR 600+ ou True Black',
          'DisplayHDR 600+ or True Black',
        ]),
        opt('hdmi21', 'HDMI 2.1', 'HDMI 2.1', (m) => m.specs.hdmiVersion === '2.1', [
          '4K 120 Hz sur console',
          '4K 120 Hz on console',
        ]),
        opt('height', 'Pied réglable', 'Height-adjustable', (m) => m.specs.standHeightMm >= 100, [
          'En hauteur',
          'In height',
        ]),
        opt('pivot', 'Rotation portrait', 'Portrait pivot', (m) => m.specs.pivot),
        opt('speakers', 'Haut-parleurs', 'Speakers', (m) => m.specs.speakers),
        opt('glossy', 'Brillant', 'Glossy', (m) => m.specs.coating === 'glossy', [
          'Image plus éclatante',
          'Punchier image',
        ]),
        opt('calibrated', 'Calibré usine', 'Factory calibrated', (m) => m.specs.factoryCalibrated),
      ],
    },
  ],

  // ---- Ranking -------------------------------------------------------------------------------
  criteria: [
    {
      key: 'refresh',
      label: text('Très fluide', 'Very smooth'),
      score: (m) => refreshScore(m.specs.refreshHzMax),
    },
    {
      key: 'response',
      label: text('Temps de réponse très court', 'Very fast response'),
      score: (m) =>
        m.specs.responseGtgMs != null
          ? Math.min(1, Math.max(0, (5 - m.specs.responseGtgMs) / 4.9))
          : isOled(m)
            ? 1
            : 0.4,
    },
    {
      key: 'esportsSize',
      label: text('Taille idéale pour l’e-sport', 'Ideal esports size'),
      score: (m) => (m.specs.diagonalIn < 25.5 ? 1 : m.specs.diagonalIn < 28 ? 0.7 : 0.25),
    },
    {
      key: 'contrast',
      label: text('Noirs profonds', 'Deep blacks'),
      score: (m) =>
        ({ woled: 1, qdoled: 1, miniled_va: 0.9, miniled_ips: 0.8, va: 0.65, ips: 0.35, tn: 0.2 })[
          m.specs.panel
        ],
    },
    {
      key: 'hdr',
      label: text('HDR convaincant', 'Convincing HDR'),
      score: (m) =>
        ({
          none: 0.05,
          hdr400: 0.25,
          hdr500: 0.4,
          hdr600: 0.6,
          hdr1000: 0.9,
          hdr1400: 1,
          true_black_400: 0.85,
          true_black_500: 0.95,
        })[m.specs.hdrCert],
    },
    {
      key: 'immersion',
      label: text('Très immersif', 'Very immersive'),
      score: (m) =>
        Math.min(1, (m.specs.diagonalIn - 22) / 20 + (m.specs.curvatureR != null ? 0.2 : 0)),
    },
    {
      key: 'console',
      label: text('Pensé pour les consoles', 'Console-ready'),
      score: (m) => (m.specs.hdmiVersion === '2.1' ? (m.specs.resH >= 2160 ? 1 : 0.7) : 0.1),
    },
    {
      key: 'color',
      label: text('Couleurs fidèles et étendues', 'Wide, accurate colour'),
      score: (m) =>
        Math.min(
          1,
          ((m.specs.dciP3Pct ?? 75) - 70) / 30 +
            (m.specs.factoryCalibrated ? 0.15 : 0) +
            (m.specs.bitDepth === 10 ? 0.1 : 0),
        ),
    },
    {
      key: 'sharpness',
      label: text('Texte très net', 'Very sharp text'),
      score: (m) => Math.min(1, Math.max(0, (m.specs.ppi - 80) / 140)),
    },
    {
      key: 'ergonomics',
      label: text('Pied complet', 'Fully adjustable stand'),
      score: (m) =>
        Math.min(
          1,
          (m.specs.standHeightMm >= 100 ? 0.5 : 0) +
            (m.specs.pivot ? 0.25 : 0) +
            (m.specs.swivel ? 0.15 : 0) +
            (m.specs.tilt ? 0.1 : 0),
        ),
    },
    {
      key: 'connectivity',
      label: text('Un seul câble pour le portable', 'One cable for the laptop'),
      score: (m) =>
        Math.min(
          1,
          (m.specs.usbcPdW >= 65 ? 0.6 : m.specs.usbcPdW > 0 ? 0.3 : 0) +
            (m.specs.kvm ? 0.25 : 0) +
            (m.specs.thunderbolt ? 0.15 : 0),
        ),
    },
    {
      key: 'workspace',
      label: text('Grand espace de travail', 'Large workspace'),
      score: (m) => Math.min(1, (m.specs.resW * m.specs.resH) / (5120 * 2160)),
    },
  ],
  profiles: {
    fps: { refresh: 3, response: 3, esportsSize: 2, contrast: 0.5 },
    immersive: { contrast: 3, hdr: 2.5, immersion: 2, refresh: 1 },
    console: { console: 3, hdr: 2, contrast: 1.5, refresh: 1 },
    creative: { color: 3, sharpness: 2.5, ergonomics: 1, contrast: 1 },
    office: { sharpness: 2.5, ergonomics: 2, connectivity: 2, workspace: 1.5 },
    mixed: { refresh: 1.5, contrast: 1.5, sharpness: 1.5, hdr: 1, ergonomics: 1 },
    default: { refresh: 1, contrast: 1, sharpness: 1, ergonomics: 1 },
  },
}
