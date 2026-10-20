import { type Category, type Locale, type Text, text } from '@choose/catalog'

// Interface copy in both locales. Catalog content (questions, options, criteria) carries its own
// FR/EN text in @choose/catalog; this file is only the chrome around it.

const count = (n: number, locale: Locale) =>
  new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB').format(n)

export const messages = {
  siteName: text('choose-a-device'),
  homeKicker: text(
    'Le bon appareil, sans tableau de specs',
    'The right device, without a spec sheet',
  ),
  homeTitle: text('Arrête de chercher.\nCommence à choisir.', 'Stop searching.\nStart choosing.'),
  homeSub: text(
    'Choisis un univers : le catalogue se resserre avec toi, question après question.',
    'Pick a world: the catalogue narrows with you, one question at a time.',
  ),
  homeLead: text(
    'Réponds à quelques questions : le catalogue se resserre à chaque réponse, en direct, jusqu’aux trois modèles faits pour toi.',
    'Answer a few questions: the catalogue narrows with every answer, live, down to the three models made for you.',
  ),
  start: text('Commencer', 'Start'),
  models: text('modèles', 'models'),
  category: {
    keyboard: text('Claviers', 'Keyboards'),
    monitor: text('Écrans', 'Monitors'),
  } satisfies Record<Category, Text>,
  categoryPitch: {
    keyboard: text('Format, switchs, AZERTY, budget', 'Size, switches, layout, budget'),
    monitor: text('Taille, dalle, fréquence, budget', 'Size, panel, refresh rate, budget'),
  } satisfies Record<Category, Text>,
  matching: {
    keyboard: text('claviers correspondent', 'keyboards match'),
    monitor: text('écrans correspondent', 'monitors match'),
  } satisfies Record<Category, Text>,
  of: text('sur', 'of'),
  back: text('Retour', 'Back'),
  reset: text('Recommencer', 'Start over'),
  continue: text('Continuer', 'Continue'),
  noPreference: text('Peu importe', 'No preference'),
  noPreferenceHint: text('Tout garder', 'Keep everything'),
  noMustHaves: text('Rien d’indispensable', 'No must-haves'),
  help: text('Aide', 'Help'),
  seeResults: (n: number, locale: Locale) =>
    locale === 'fr' ? `Voir les ${count(n, locale)} résultats` : `See ${count(n, locale)} results`,
  ifPicked: text('si choisi', 'if picked'),
  blockedBy: text('Bloqué par', 'Blocked by'),
  change: text('Changer', 'Change'),
  noMatch: text('Aucun résultat', 'No match'),
  budgetMin: text('Min', 'Min'),
  budgetMax: text('Max', 'Max'),
  noLimit: text('Sans limite', 'No limit'),
  inBudget: text('dans ce budget', 'in this budget'),
  resultsTitle: text('Tes meilleurs choix', 'Your best matches'),
  resultsEmpty: text(
    'Aucun modèle ne coche toutes les cases. Change une réponse pour élargir.',
    'No model ticks every box. Change an answer to widen the search.',
  ),
  match: text('compatibilité', 'match'),
  strengths: text('Points forts', 'Strengths'),
  caveats: text('À savoir', 'Worth knowing'),
  editAnswers: text('Modifier mes réponses', 'Edit my answers'),
  allResults: text('Tous les résultats', 'All results'),
  from: text('à partir de', 'from'),
  language: text('Langue', 'Language'),
  demoData: text('Données de démonstration', 'Demo data'),
  worlds: text('Univers', 'Worlds'),
  explore: text('Explorer', 'Explore'),
  canvasHint: text('Glisse pour explorer · survole un modèle', 'Drag to explore · hover a model'),
  canvasHintTouch: text('Glisse pour explorer · touche un modèle', 'Drag to explore · tap a model'),
  ruledOutBy: text('Écarté par', 'Ruled out by'),
  ruledOut: text('Écarté', 'Ruled out'),
} as const

export const formatCount = count
