import { type Category, type Locale, type Text, text } from "@choose/catalog";
import { SITE } from "~/site";

// Interface copy in both locales. Catalog content (questions, options, criteria) carries its own
// FR/EN text in @choose/catalog; this file is only the chrome around it.

const count = (n: number, locale: Locale) =>
  new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB").format(n);

export const messages = {
  siteName: text(SITE.name),
  homeKicker: text(
    "Le bon appareil, en quelques questions",
    "The right device, in a few questions",
  ),
  homeTitle: text(
    "Arrêter de chercher.\nCommencer à choisir.",
    "Stop searching.\nStart choosing.",
  ),
  homeLead: text(
    "Quelques questions, trois modèles. Claviers, écrans et souris.",
    "A few questions, three models. Keyboards, monitors and mice.",
  ),
  start: text("Commencer", "Start"),
  models: text("modèles", "models"),
  category: {
    keyboard: text("Claviers", "Keyboards"),
    monitor: text("Écrans", "Monitors"),
    mouse: text("Souris", "Mice"),
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
    mouse: text("Main, prise, poids, budget", "Hand, grip, weight, budget"),
  } satisfies Record<Category, Text>,
  /** The question a category page answers: its heading, and the start of its title. */
  categoryQuestion: {
    keyboard: text("Quel clavier choisir ?", "Which keyboard should you buy?"),
    monitor: text("Quel écran choisir ?", "Which monitor should you buy?"),
    mouse: text("Quelle souris choisir ?", "Which mouse should you buy?"),
  } satisfies Record<Category, Text>,
  /** How a category page answers it: the rest of its title. */
  modelsCompared: (models: number, questions: number, locale: Locale) =>
    locale === "fr"
      ? `${count(models, locale)} modèles comparés en ${questions} questions`
      : `${count(models, locale)} models compared in ${questions} questions`,
  /** A category page's description, for search results and share cards. */
  categoryDescription: (
    pitch: string,
    name: string,
    models: number,
    questions: number,
    locale: Locale,
  ) =>
    locale === "fr"
      ? `${pitch}. ${questions} questions pour choisir parmi ${count(models, locale)} ${name}.`
      : `${pitch}. ${questions} questions to choose from ${count(models, locale)} ${name}.`,
  /** A product page's title, before the site's name: its name, then what it is. */
  productTitle: (name: string, kind: string) => `${name}, ${kind}`,
  /** A product page's description, for search results and share cards: what it is, its price. */
  productDescription: (
    name: string,
    summary: string,
    price: string,
    locale: Locale,
  ) =>
    locale === "fr"
      ? `${name} : ${summary}. Autour de ${price}.`
      : `${name}: ${summary}. Around ${price}.`,
  /** The home page's title, after the site's name. */
  homeHeadline: text(
    "Le bon clavier, écran ou souris en quelques questions",
    "The right keyboard, monitor or mouse in a few questions",
  ),
  /** What the share card's picture shows. */
  shareImageAlt: text(
    "Arrêter de chercher. Commencer à choisir. Une souris, un clavier et un écran, avec leurs dimensions.",
    "Stop searching. Start choosing. A mouse, a keyboard and a monitor, with their sizes.",
  ),
  matching: {
    keyboard: text("claviers correspondent", "keyboards match"),
    monitor: text("écrans correspondent", "monitors match"),
    mouse: text("souris correspondent", "mice match"),
  } satisfies Record<Category, Text>,
  of: text("sur", "of"),
  back: text("Retour", "Back"),
  reset: text("Recommencer", "Start over"),
  continue: text("Continuer", "Continue"),
  noPreference: text("Peu importe", "No preference"),
  noPreferenceHint: text("Tout garder", "Keep everything"),
  noMustHaves: text("Rien d’indispensable", "No must-haves"),
  help: text("Aide", "Help"),
  oneAnswer: text("Une seule réponse", "One answer"),
  manyAnswers: text("Plusieurs réponses possibles", "Pick as many as you like"),
  rangeAnswer: text("Glisse l’un ou l’autre curseur", "Drag either handle"),
  /** The step on screen, as a screen reader says the journey button. */
  stepOf: (n: number, total: number, locale: Locale) =>
    locale === "fr"
      ? `Étape ${n} sur ${total} : voir le parcours`
      : `Step ${n} of ${total}: see the journey`,
  seeResults: (n: number, locale: Locale) =>
    locale === "fr"
      ? `Voir les ${count(n, locale)} résultats`
      : `See ${count(n, locale)} results`,
  seeResultsShort: (n: number, locale: Locale) =>
    locale === "fr"
      ? `${count(n, locale)} résultats`
      : `${count(n, locale)} results`,
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
  editShort: text("Modifier", "Edit"),
  allResults: text("Tous les résultats", "All results"),
  from: text("à partir de", "from"),
  language: text("Langue", "Language"),
  /** The header's link to the legal notice and privacy page. */
  legal: text("Mentions légales", "Legal"),
  worlds: text("Univers", "Worlds"),
  categories: text("Catégories", "Categories"),
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
  journey: text("Parcours", "Journey"),
  answerNow: text("Y répondre maintenant", "Answer it now"),
  nothingToDecide: text(
    "Plus rien à départager avec tes réponses",
    "Nothing left to decide with your answers",
  ),
  scrollBack: text("Étapes précédentes", "Earlier steps"),
  scrollMore: text("Étapes suivantes", "Later steps"),
  results: text("Résultats", "Results"),
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
  similarModels: text("Modèles proches", "Similar models"),
  listPrice: text("Prix indicatif", "Typical price"),
  price: text("Prix", "Price"),
  runnersUp: text("Juste derrière", "Close behind"),
  searchOnAmazon: text("Chercher sur Amazon", "Search on Amazon"),
  viewOnAmazon: text("Voir sur Amazon", "View on Amazon"),
  amazon: text("Amazon", "Amazon"),
  /** The name of a compact Amazon link (a pill or an arrow), which does not show the model. */
  amazonOf: (name: string, direct: boolean, locale: Locale) =>
    locale === "fr"
      ? `${direct ? "Voir" : "Chercher"} ${name} sur Amazon`
      : direct
        ? `View ${name} on Amazon`
        : `Search Amazon for ${name}`,
  amazonProduct: text(
    "La fiche du modèle sur Amazon.fr, en AZERTY quand il existe dans cette disposition.",
    "The model’s page on Amazon.fr, in AZERTY when it comes in that layout.",
  ),
  amazonQuery: (query: string, locale: Locale) =>
    locale === "fr"
      ? `Recherche « ${query} » sur Amazon.fr`
      : `Searches Amazon.fr for “${query}”`,
  amazonNotice: text(
    "En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises.",
    "As an Amazon Associate I earn from qualifying purchases.",
  ),
  loadingCatalogue: text("Chargement du catalogue", "Loading the catalogue"),
  brands: text("Marques", "Brands"),
  allBrands: text("Toutes", "All"),
  brandCount: (n: number, locale: Locale) =>
    locale === "fr" ? `${n} marques` : `${n} brands`,
  allBut: (what: string, locale: Locale) =>
    locale === "fr" ? `Sauf ${what}` : `All but ${what}`,
  showAllBrands: text("Tout afficher", "Show all"),
  allBrandsAgain: text("Revenir à toutes les marques", "Back to every brand"),
  onlyBrand: text("Seulement", "Only"),
  onlyBrandOf: (name: string, locale: Locale) =>
    locale === "fr" ? `Seulement ${name}` : `Only ${name}`,
  findBrand: text("Chercher une marque", "Find a brand"),
  noBrandFound: text("Aucune marque à ce nom", "No brand by that name"),
  brandsShown: (n: number, total: number, locale: Locale) =>
    locale === "fr" ? `${n} sur ${total}` : `${n} of ${total}`,

  // ---- The catalogue: every product of a category, and its collections ----
  catalogue: text("Catalogue", "Catalogue"),
  /** The catalogue's heading. */
  catalogueTitle: {
    keyboard: text("Tous les claviers, de A à Z", "Every keyboard, A to Z"),
    monitor: text("Tous les écrans, de A à Z", "Every monitor, A to Z"),
    mouse: text("Toutes les souris, de A à Z", "Every mouse, A to Z"),
  } satisfies Record<Category, Text>,
  /** What a line of the catalogue gives of each product. */
  catalogueSpecs: {
    keyboard: text("format, touches, connexion", "size, keys, connection"),
    monitor: text(
      "taille, définition, dalle, fréquence",
      "size, resolution, panel, refresh rate",
    ),
    mouse: text(
      "forme, taille, poids, connexion",
      "shape, size, weight, connection",
    ),
  } satisfies Record<Category, Text>,
  /** How many products, from how many brands, at what prices. */
  catalogueFacts: (
    models: number,
    brands: number,
    from: string,
    to: string,
    locale: Locale,
  ) =>
    locale === "fr"
      ? `${count(models, locale)} modèles de ${brands} marques, de ${from} à ${to}.`
      : `${count(models, locale)} models from ${brands} brands, ${from} to ${to}.`,
  /** The catalogue's title, before the site's name. */
  catalogueHeadTitle: (title: string, models: number, locale: Locale) =>
    locale === "fr"
      ? `${title} : ${count(models, locale)} modèles`
      : `${title}: ${count(models, locale)} models`,
  /** The catalogue's description, for search results. */
  catalogueDescription: (
    models: number,
    name: string,
    specs: string,
    locale: Locale,
  ) =>
    locale === "fr"
      ? `Les ${count(models, locale)} ${name} du site, marque par marque : ${specs} et prix.`
      : `All ${count(models, locale)} ${name} on the site, brand by brand: ${specs} and price.`,
  collections: text("Sélections", "Collections"),
  /** How the catalogue's page groups a category's collections. */
  collectionGroups: {
    keyboard: {
      size: text("Format", "Size"),
      keys: text("Touches", "Keys"),
      layout: text("AZERTY", "AZERTY"),
      link: text("Sans fil", "Wireless"),
      feature: text("Options", "Features"),
      price: text("Prix", "Price"),
      use: text("Usages", "Uses"),
    },
    monitor: {
      size: text("Taille", "Size"),
      panel: text("Dalle et définition", "Panel and resolution"),
      link: text("Fréquence", "Refresh rate"),
      feature: text("Connectique et pied", "Ports and stand"),
      price: text("Prix", "Price"),
      use: text("Usages", "Uses"),
    },
    mouse: {
      size: text("Main et forme", "Hand and shape"),
      link: text("Connexion", "Connection"),
      feature: text("Options", "Features"),
      price: text("Prix", "Price"),
      use: text("Usages et prises", "Uses and grips"),
    },
  } satisfies Record<Category, Partial<Record<string, Text>>>,
  chooseIn: (questions: number, locale: Locale) =>
    locale === "fr"
      ? `Choisir en ${questions} questions`
      : `Choose in ${questions} questions`,
  everyModel: text("Tous les modèles, de A à Z", "Every model, A to Z"),
  /** A collection's title, before the site's name. */
  collectionTitle: (name: string, models: number, locale: Locale) =>
    locale === "fr"
      ? `${name} : ${count(models, locale)} modèles classés`
      : `${name}: ${count(models, locale)} models ranked`,
  /** A collection's description: the first ones, then what it holds. */
  collectionDescription: (
    leaders: string[],
    models: number,
    name: string,
    from: string,
    to: string,
    category: Category,
    locale: Locale,
  ) => {
    const and = locale === "fr" ? " et " : " and ";
    const first = `${leaders.slice(0, -1).join(", ")}${leaders.length > 1 ? and : ""}${leaders.at(-1) ?? ""}`;
    const ranked = category === "mouse" ? "classées" : "classés";
    return locale === "fr"
      ? `${first} en tête. Les ${count(models, locale)} ${name} ${ranked}, de ${from} à ${to}.`
      : `${first} lead. All ${count(models, locale)} ${name} ranked, ${from} to ${to}.`;
  },
  rankingDefault: text("Classement général", "Overall ranking"),
  /** What the overall ranking weighs, per category (the finder's default profile). */
  rankingBasis: {
    keyboard: text(
      "Construction, confort, sans-fil, réactivité",
      "Build, comfort, wireless, speed",
    ),
    monitor: text(
      "Fluidité, contraste, netteté, pied",
      "Smoothness, contrast, sharpness, stand",
    ),
    mouse: text("Capteur, poids, sans-fil", "Sensor, weight, wireless"),
  } satisfies Record<Category, Text>,
  /** Past the products a collection's page lists. */
  firstOf: (listed: number, total: number, locale: Locale) =>
    locale === "fr"
      ? `Les ${listed} premiers sur ${count(total, locale)}`
      : `The top ${listed} of ${count(total, locale)}`,
  seeAlso: text("Voir aussi", "See also"),
  refine: text(
    "Affiner avec le questionnaire",
    "Narrow it down with the questions",
  ),
  /** On a product's sheet: where it stands in the collections it belongs to. */
  standings: text("Classements", "Rankings"),
  /** A product's sheet, when it is the cheapest of a collection. */
  cheapestOf: (name: string, category: Category, locale: Locale) =>
    locale === "fr"
      ? `${category === "mouse" ? "La moins chère" : "Le moins cher"} des ${name}.`
      : `The cheapest of the ${name}.`,
  /** A product's sheet, when it ranks first in a collection. */
  firstIn: (name: string, locale: Locale) =>
    locale === "fr" ? `N° 1 des ${name}.` : `No. 1 of the ${name}.`,
} as const;

export const formatCount = count;
