import { type Category, type Locale, type Text, text } from "@choose/catalog";

// Interface copy in both locales. Catalog content (questions, options, criteria) carries its own
// FR/EN text in @choose/catalog; this file is only the chrome around it.

const count = (n: number, locale: Locale) =>
  new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB").format(n);

export const messages = {
  siteName: text("choose-a-device"),
  homeKicker: text(
    "Le bon appareil, sans tableau de specs",
    "The right device, without a spec sheet",
  ),
  homeTitle: text(
    "Arrêter de chercher.\nCommencer à choisir.",
    "Stop searching.\nStart choosing.",
  ),
  homeSub: text(
    "Choisis un univers : le catalogue se resserre avec toi, question après question.",
    "Pick a world: the catalogue narrows with you, one question at a time.",
  ),
  homeLead: text(
    "Réponds à quelques questions : le catalogue se resserre à chaque réponse, en direct, jusqu’aux trois modèles faits pour toi.",
    "Answer a few questions: the catalogue narrows with every answer, live, down to the three models made for you.",
  ),
  start: text("Commencer", "Start"),
  models: text("modèles", "models"),
  category: {
    keyboard: text("Claviers", "Keyboards"),
    monitor: text("Écrans", "Monitors"),
  } satisfies Record<Category, Text>,
  categoryPitch: {
    keyboard: text(
      "Format, switchs, AZERTY, budget",
      "Size, switches, layout, budget",
    ),
    monitor: text(
      "Taille, dalle, fréquence, budget",
      "Size, panel, refresh rate, budget",
    ),
  } satisfies Record<Category, Text>,
  matching: {
    keyboard: text("claviers correspondent", "keyboards match"),
    monitor: text("écrans correspondent", "monitors match"),
  } satisfies Record<Category, Text>,
  of: text("sur", "of"),
  back: text("Retour", "Back"),
  reset: text("Recommencer", "Start over"),
  continue: text("Continuer", "Continue"),
  noPreference: text("Peu importe", "No preference"),
  noPreferenceHint: text("Tout garder", "Keep everything"),
  noMustHaves: text("Rien d’indispensable", "No must-haves"),
  help: text("Aide", "Help"),
  gotIt: text("Compris", "Got it"),
  seeResults: (n: number, locale: Locale) =>
    locale === "fr"
      ? `Voir les ${count(n, locale)} résultats`
      : `See ${count(n, locale)} results`,
  ifPicked: text("si choisi", "if picked"),
  blockedBy: text("Bloqué par", "Blocked by"),
  change: text("Changer", "Change"),
  noMatch: text("Aucun résultat", "No match"),
  budgetMin: text("Min", "Min"),
  budgetMax: text("Max", "Max"),
  noLimit: text("Sans limite", "No limit"),
  inBudget: text("dans ce budget", "in this budget"),
  resultsTitle: text("Tes meilleurs choix", "Your best matches"),
  resultsEmpty: text(
    "Aucun modèle ne coche toutes les cases. Change une réponse pour élargir.",
    "No model ticks every box. Change an answer to widen the search.",
  ),
  match: text("compatibilité", "match"),
  strengths: text("Points forts", "Strengths"),
  caveats: text("À savoir", "Worth knowing"),
  editAnswers: text("Modifier mes réponses", "Edit my answers"),
  allResults: text("Tous les résultats", "All results"),
  from: text("à partir de", "from"),
  language: text("Langue", "Language"),
  demoData: text("Données de démonstration", "Demo data"),
  worlds: text("Univers", "Worlds"),
  explore: text("Explorer", "Explore"),
  canvasHint: text(
    "Glisse pour explorer · survole un modèle",
    "Drag to explore · hover a model",
  ),
  canvasHintTouch: text(
    "Glisse pour explorer · touche un modèle",
    "Drag to explore · tap a model",
  ),
  ruledOutBy: text("Écarté par", "Ruled out by"),
  ruledOut: text("Écarté", "Ruled out"),
  seeAll: text("Voir tout", "See all"),
  ranking: text("Classement", "Ranking"),
  rankingSoon: text(
    "Ton classement se dessine dès ta première réponse.",
    "Your ranking takes shape with your first answer.",
  ),
  journey: text("Parcours", "Journey"),
  answerNow: text("Y répondre maintenant", "Answer it now"),
  inProgress: text("En cours", "Now"),
  results: text("Résultats", "Results"),
  journeyHint: text(
    "Pas d’ordre imposé : choisis ici ta prochaine question.",
    "No set order: pick your next question here.",
  ),
  matchHow: text("Comment lire ce %", "How to read this %"),
  matchExplain: text(
    "Les modèles listés respectent toutes tes réponses, et chacune fait monter leur score. Le reste dépend de ce qui compte le plus pour ton usage : un modèle peut cocher toutes tes cases sans être idéal pour lui.",
    "The models listed meet all your answers, and each one raises their score. The rest depends on what matters most for your use: a model can tick every box without being ideal for it.",
  ),
  matchSeeSheet: text(
    "Sa fiche détaille le calcul.",
    "Its sheet breaks the number down.",
  ),
  yourAnswers: text("Tes réponses", "Your answers"),
  allMet: (n: number, locale: Locale) =>
    locale === "fr" ? `${n} sur ${n}` : `${n} of ${n}`,
  forYourUse: text("Pour ton usage", "For your use"),
  overallQuality: text("Qualité générale", "Overall quality"),
  matchNote: text(
    "Chaque réponse respectée fait monter la compatibilité ; le reste dépend de ce qui compte le plus pour ton usage.",
    "Each answer it meets raises the match; the rest depends on what matters most for your use.",
  ),
  matchHelp: text(
    "Compatibilité avec ton usage et tes réponses, sur 100",
    "How well it fits your use and your answers, out of 100",
  ),
  clickForSheet: text("Clique pour ouvrir sa fiche", "Click to open its sheet"),
  viewSheet: text("Voir la fiche", "View details"),
  sheetOf: (name: string, locale: Locale) =>
    locale === "fr" ? `Voir la fiche : ${name}` : `View details: ${name}`,
  close: text("Fermer", "Close"),
  previous: text("Précédent", "Previous"),
  next: text("Suivant", "Next"),
  specSheet: text("Fiche technique", "Spec sheet"),
  whereToBuy: text("Où l’acheter", "Where to buy"),
  listPrice: text("Prix indicatif", "Typical price"),
  offersSoon: text(
    "Les offres des marchands arrivent bientôt : prix du jour, stock et livraison, au même endroit.",
    "Shop offers are coming soon: today’s prices, stock and delivery, all in one place.",
  ),
} as const;

export const formatCount = count;
