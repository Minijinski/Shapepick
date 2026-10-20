# Handoff — choose-a-device

Oct 20, 2026 · @Eddy

## En bref

choose-a-device est un « finder » de claviers et d'écrans inspiré de [shapefinder.cc](https://shapefinder.cc/) : une suite de questions qui resserre le catalogue en direct, sans tableau ni filtres. Les phases 0 à 3 du plan sont terminées. Le 20 octobre 2026, le nuage de données a laissé place à une scène en canvas : un accueil en bandes inclinées qui s'ouvrent en canvas infini (voir « Scène : bandes et canvas »).

- **Ce qui marche** : accueil, parcours claviers (10 questions) et écrans (8), résultats annotés, en français et en anglais, avec rendu côté serveur.
- **Données** : 25 claviers et 25 écrans fictifs (marques inventées) pour développer. Les vraies données viendront plus tard.
- **Qualité** : 28 tests du moteur, typecheck, lint et build de production au vert.
- **État du dépôt** : commit de référence `e4ca02a` sur `main` (état initial, 20 octobre 2026) ; la refonte de l'accueil et du canvas est sur la branche `feat/bands-canvas`.

Pour reprendre : Node 24, puis `pnpm pg:local`, `pnpm db:migrate && pnpm db:seed` et `pnpm dev` (détails dans « Lancer le projet »). Le plan d'origine est dans `~/.claude/plans/https-shapefinder-cc-j-aime-beaucoup-le-cheerful-yao.md`.

## Contexte et objectifs

L'objectif est un site de choix de clavier et d'écran aussi fluide que shapefinder, avec sa propre mise en scène et un parcours plus pédagogique. La demande fixait React, Panda CSS, TypeScript et GSAP, un back à choisir, de la 3D possible, un site SEO-ready et minimaliste.

shapefinder a été analysé en direct le 19 octobre 2026 ([accueil](https://shapefinder.cc/), [claviers](https://shapefinder.cc/keyboards)). C'est un site statique en JavaScript sans framework : tout le catalogue est chargé dans le navigateur puis filtré en mémoire, d'où sa fluidité. Il couvre déjà les claviers (5 questions, données reprises de keeb-finder.com) mais pas les écrans, notre principal terrain de différenciation.

| Idée de shapefinder | Ce qu'on en a fait |
| --- | --- |
| État du parcours dans l'URL | Repris : `?size=f75,f65&budget=0-150`, donc partage et rechargement sans effort |
| Étape sautée quand elle ne départage rien | Repris (`isTrivial`) |
| Option en impasse grisée avec sa raison | Repris, avec un lien « Changer → » vers la réponse qui bloque |
| Choix multiple = OU, indispensables = ET | Repris |
| Compteur vivant, budget au curseur | Repris |
| Questions déclaratives séparées du moteur | Repris : définitions dans `packages/catalog`, moteur pur et testé |
| Dizaines de produits flottant autour de la question | Repris en canvas infini : les produits dérivent derrière la question, les écartés laissent leur place aux retenus |
| 5 questions pour les claviers | 10 questions (dont AZERTY, techno, ressenti) et un parcours écrans en 8 questions |

## Recherche design

La direction retenue, « Labo clair », croise l'industriel façon Teenage Engineering et le dessin technique : papier, encre, un seul orange, chiffres en mono. Elle vient de recherches Pinterest (sur le compte de l'utilisateur), de sites produits 3D et de shapefinder.

| Inspiration | Ce qu'on en retient | Où c'est utilisé |
| --- | --- | --- |
| Pins « KNOB », « Keyboard Hero » (esprit Teenage Engineering) | Fond clair, matériel industriel, un seul accent orange | Tokens de couleur |
| Pins « Lord Buds », « Tech specs » | Produit annoté : traits de rapport et étiquettes mono | Héros des résultats (fait), fiche produit (à faire) |
| Pins « exploded view » | Vue éclatée du produit | Plus tard : keycaps, switch, plaque, PCB, boîtier |
| Pin « WOVE » et le compteur `000 / 100` de [aulaf75.julius.site](https://aulaf75.julius.site/) | Progression et compteurs en chiffres mono | Compteur `0 025` et progression `02 / 10` (fait) |
| Pin « The Quiz » | Étapes reliées par un tracé | Rail de réponses (fait) |
| Pin « Audible Utility Quiz » | Question centrale, éléments qui réagissent autour | Esprit du nuage de données |

Recherches Pinterest faites : « keyboard website design ui », « interactive quiz website ui design », « tech product specs ui industrial design web », « exploded view product website animation ». Les quiz Awwwards n'ont été vus qu'en résultats de recherche, pas étudiés.

| Élément | Valeur dans le code |
| --- | --- |
| Fond « papier » | `#F3F1EC`, grille de points tous les 28 px |
| Encre et gris | `#141414`, gris techniques `grey.50` à `grey.700` |
| Accent « signal » | `#FF5A1F`, réservé à la sélection, au survol et au n°1 |
| Typographies | Inter Tight (interface), Geist Mono (chiffres, unités, libellés) |
| Rayons | 14 px (tuiles), 22 px (panneaux) |
| Courbe d'animation | `signal` = cubic-bezier(0.22, 1, 0.36, 1) |

## Décisions d'architecture

Tout est en TypeScript dans un seul monorepo, avec un Postgres auto-hébergé. Ce choix a été validé le 19 octobre 2026, avec le bilingue FR/EN, la direction « Labo clair » et la scène « nuage de données ».

| Sujet | Choix | Pourquoi |
| --- | --- | --- |
| Back | TanStack Start + Drizzle + Postgres, sans API séparée | Données lues bien plus qu'écrites, pas de temps réel. Des specs à facettes, c'est le terrain du SQL |
| Écartés | Convex ; FastAPI séparé | Convex : temps réel inutile, dépendance au fournisseur. FastAPI : 2 langages, 2 déploiements, types à générer |
| Framework | TanStack Start 1.169 sur Vite 8, sortie Node via Nitro | Paramètres d'URL typés et validés, Vite natif pour Panda, GSAP et Three.js |
| Styles | Panda CSS 2.3 via PostCSS | Tokens et recettes typés. PostCSS met le CSS dans le HTML rendu côté serveur |
| Animations | GSAP 3.15 + `@gsap/react` (Flip, SplitText, CustomEase) | Plugins gratuits. Flip pour le podium, SplitText pour les titres |
| i18n | Dictionnaires typés `{ fr, en }` | Voir les écarts ci-dessous |
| Validation | Zod 4 | Seed YAML, snapshot de la base, paramètres d'URL |
| Outillage | pnpm 9.9 + Turborepo, Biome, Vitest 5, `tsc` en TypeScript 7 | Vérifications rapides sur les 3 paquets |
| Python | Plus tard, seulement pour des scripts d'ingestion qui écrivent dans Postgres | Un seul langage côté application |

Écarts par rapport au plan approuvé :

- **Paraglide abandonné** : il télécharge ses plugins depuis un CDN à chaque compilation et impose sa détection de langue, en conflit avec `/fr` et `/en`. Remplacé par des objets `{ fr, en }` typés.
- **Panda v2**, sorti fin septembre 2026, n'ajoute plus ses presets : `@pandacss/preset-base` et `@pandacss/preset-panda` sont déclarés à la main ([guide de migration](https://raw.githubusercontent.com/chakra-ui/panda/v2/website/content/docs/get-started/upgrading-to-v2.mdx)).
- **Pas de Docker sur la machine** : Postgres 14 (Homebrew) tourne dans le dossier du projet via `scripts/pg-local.sh`. `infra/docker-compose.yml` (Postgres 17) reste prêt pour le serveur.
- **Scène en canvas 2D (20 octobre 2026)** : le nuage SVG a été remplacé par une scène dessinée sur un seul `<canvas>` 2D, sans three ni React Three Fiber (non installés).

## Structure du monorepo

Le monorepo compte trois paquets : `packages/catalog` (le cœur métier, sans base ni DOM), `packages/db` (Postgres) et `apps/web` (le site). Le même moteur tourne sur le serveur pour le premier rendu, puis dans le navigateur à chaque réponse.

&#91;embedded content: architecture · du YAML au navigateur\]

Les données vont du YAML versionné au navigateur en quatre étapes ; `packages/catalog` fournit à la fois la validation Zod et le moteur exécuté des deux côtés.

| Chemin | Rôle |
| --- | --- |
| `packages/catalog/src/domain/` | Énumérations partagées (Zod et Postgres), schémas Zod du seed, forme « item » lue par le moteur |
| `packages/catalog/src/finder/engine.ts` | Moteur pur : filtres, compteurs, sauts, impasses, classement |
| `packages/catalog/src/finder/keyboards.ts`, `monitors.ts` | Les deux questionnaires : étapes, options, critères, profils |
| `packages/catalog/src/registry.ts` | Slugs localisés (`claviers` ↔ `keyboards`) et questionnaire par catégorie |
| `packages/catalog/src/node/load-data.ts` | Lecture et validation des YAML, Node uniquement |
| `packages/catalog/test/` | 28 tests Vitest |
| `packages/db/src/schema.ts`, `packages/db/drizzle/` | Tables Drizzle et première migration |
| `packages/db/src/seed.ts`, `snapshot.ts` | YAML vers Postgres, puis Postgres vers items |
| `apps/web/src/routes/` | Redirection de langue, accueil, parcours, API JSON |
| `apps/web/src/server/` | Server function `getCatalog` et accès à la base, côté serveur seulement |
| `apps/web/src/features/finder/` | État du parcours (`useFinder`) et composants de la scène |
| `apps/web/src/features/scene/` | Scène partagée accueil ↔ canvas : géométrie des bandes et du motif (`geometry.ts`), rendu (`renderer.ts`), pont routes ↔ scène (`controller.ts`), navigation chorégraphiée (`navigation.ts`), sprites des silhouettes, popup produit |
| `apps/web/src/features/product/` | Silhouettes SVG générées depuis les specs, specs clés formatées |
| `apps/web/src/features/motion/` | Enregistrement de GSAP, durées et courbes communes |
| `apps/web/src/i18n/` | Textes d'interface FR/EN, langue de la page |
| `apps/web/panda.config.ts` | Tokens « Labo clair », recettes `button`, `chip`, `optionTile` |
| `data/` | Marques, switchs, claviers et écrans de démo en YAML |
| `scripts/pg-local.sh`, `infra/`, `.claude/launch.json` | Postgres local, Docker Compose, serveur de prévisualisation de l'app |

## Base de données et données de démo

La base compte 9 tables et 25 enums Postgres. Tout ce qui sert à filtrer ou classer est une colonne typée ; le reste ira dans une colonne `extra` en jsonb. Les valeurs des enums viennent des mêmes tableaux que les schémas Zod (`packages/catalog/src/domain/enums.ts`).

| Table | Contenu | À noter |
| --- | --- | --- |
| `brands` | Slug, nom, pays, site | Référencées par slug dans les YAML |
| `products` | Slug unique, catégorie, marque, prix conseillé (€, $), statut, `popularity` et `editorial_score` (0 à 1) | Index sur catégorie + statut |
| `product_translations` | Accroche, description, titre et description SEO par langue | Clé : produit + langue |
| `product_variants` | Couleur, famille de couleur, disposition (`iso_fr`, `ansi_us`…), switch, prix | Un produit correspond si une de ses variantes correspond |
| `switches` | Ressenti, silencieux, techno, forces (g), courses (mm), lubrification, son | Référentiel partagé entre claviers |
| `keyboard_specs` | 34 colonnes : format, techno, hot-swap, connexions, polling, rapid trigger, matériaux, firmware, mesures | Une ligne par clavier |
| `monitor_specs` | 37 colonnes : diagonale, ratio, définition, dalle, fréquence, HDR, connectique, pied | `ppi` calculé par Postgres (colonne générée) |
| `product_images` | URL, type de visuel, dimensions, couleur dominante | Vide : pas encore de photos |
| `offers` | Boutique, pays, URL, prix, stock, date | Vide : prévu pour les prix et l'affiliation |

- **Seed** (`pnpm db:seed`) : lit `data/`, valide chaque fichier avec Zod (l'erreur cite le fichier et le slug), fait un upsert par slug, puis remplace traductions, variantes et specs. Relancé deux fois sans écart. Il ne supprime pas un produit retiré des YAML.
- **Snapshot** (`loadSnapshot`) : relit la base, repasse par les mêmes schémas Zod et rend la liste d'items du moteur. Vérifié identique au YAML : 25/25 claviers, 25/25 écrans. Sa version (`<nombre>-<dernière mise à jour>`) sert d'ETag.
- **Données de démo** : 9 marques inventées (Northkey, Atelier Clavier, Pulse Dynamics, Hexa Works, Kestrel, Lumen Display, Vanta, Prism, Halcyon), 16 switchs, 25 claviers et 25 écrans aux specs plausibles. Un fichier YAML peut contenir un ou plusieurs produits.

## Moteur de parcours

Le moteur (`packages/catalog/src/finder/engine.ts`) est un ensemble de fonctions pures : il ne lit que le catalogue et les réponses de l'URL, sans état caché. Le même code calcule la première page sur le serveur, puis chaque réponse dans le navigateur.

Les réponses restent des chaînes, telles que l'URL les porte : `size=f75,f65` (plusieurs choix), `budget=0-150` (plage), `budget=200-` (sans plafond), `any` (peu importe). Chaque étape a un type : `single` (un choix), `multi` (OU), `musts` (ET) ou `range` (plage). Trois options modifient son comportement : `weightOnly` (ne filtre jamais, choisit le profil de classement), `required` (pas de « Peu importe ») et `applies` (étape conditionnelle).

| Fonction | Rôle |
| --- | --- |
| `sanitizeAnswers` | Garde seulement les clés et valeurs valides, pour qu'une URL modifiée à la main ne casse rien |
| `filter` | Applique les réponses des étapes qui s'appliquent (option `without` pour en exclure une) |
| `optionCounts` | Résultats par option compte tenu des autres réponses ; pour les indispensables, la sélection en cours reste appliquée |
| `isTrivial` | Saute une étape quand chaque option garde soit tout, soit rien, d'après les réponses précédentes |
| `firstPending`, `previousStep`, `askedSteps` | Étape suivante, cible du bouton Retour, progression `03 / 08` |
| `deadEnd` | Pour une option à zéro, la réponse antérieure unique qui la débloquerait |
| `rank` | Score de 0 à 1, points forts et points faibles |
| `histogram` | Répartition des prix pour l'étape budget |
| `describeAnswer` | Libellé des puces du rail : « 75 % · 65 % », « ≤ 150 € » |

Le classement mêle l'adéquation au profil (75 %) et un a priori (25 %). L'adéquation est une moyenne géométrique pondérée des critères du profil, plancher 0,05 : un critère catastrophique fait chuter tout le score au lieu d'être noyé dans la moyenne. L'a priori combine note éditoriale (e) et popularité (p) ; les égalités se départagent par slug.

```latex
\text{score} = 0{,}75 \cdot \exp\left(\frac{\sum_k w_k \ln \max(0{,}05,\ s_k)}{\sum_k w_k}\right) + 0{,}25 \cdot (0{,}6\,e + 0{,}4\,p)
```

Les points forts sont les critères notés au moins 0,75 ; les points faibles, les critères importants notés sous 0,35. Le prix d'un produit est celui de sa variante la moins chère.

## Parcours claviers et écrans

Les deux parcours suivent le même ordre : l'usage d'abord (il règle le classement sans rien écarter), puis la décision physique, les choix techniques, le budget et les indispensables. Un bouton « Voir les N résultats » permet de sortir à tout moment.

### Claviers, 10 étapes

| # | Question | Options | Type |
| --- | --- | --- | --- |
| 1 | À quoi va-t-il servir ? | Jeu compétitif, Jeu polyvalent, Bureau & frappe, Code, Nomade | Profil seulement, obligatoire |
| 2 | Quelle taille ? | 100 %, 96 %, TKL, 75 %, 65 %, 60 %, 40 % et moins, Ergonomique | Multi, obligatoire |
| 3 | Quelle disposition ? | AZERTY, QWERTY US, QWERTY ISO | Multi, testé sur les variantes |
| 4 | Quel type de touches ? | Mécanique (Topre inclus), Magnétique, Optique, Membrane, Ciseaux | Multi |
| 5 | Quel ressenti sous les doigts ? | Linéaire, Tactile, Clicky, Silencieux | Multi, seulement si des switchs restent possibles |
| 6 | Plutôt plat ou standard ? | Standard, Extra-plat | Choix unique |
| 7 | Comment le connecter ? | Sans fil 2.4 GHz, Bluetooth, 2.4 GHz + Bluetooth, Filaire uniquement | Choix unique |
| 8 | Quel budget ? | De 0 à 400 €, par pas de 10 € | Plage |
| 9 | Des indispensables ? | Hot-swap, RGB, Molette, QMK/VIA, Compatible Mac, Rapid trigger, Keycaps PBT, Repose-poignets, Écran | ET |
| 10 | Une couleur ? | Noir, Blanc, Coloré, Transparent | Multi |

### Écrans, 8 étapes

| # | Question | Options | Type |
| --- | --- | --- | --- |
| 1 | Pour quoi faire ? | FPS compétitif, Jeu immersif, Console, Création, Bureau & code, Polyvalent | Profil seulement, obligatoire |
| 2 | Quelle taille ? | 24", 27", 32", Ultra-large 34", Ultra-large 38–40", Super-ultra-large, Grand format 42"+ | Multi, obligatoire |
| 3 | Quelle netteté ? | 1080p, 1440p, 4K, 5K et plus | Multi |
| 4 | Quelle dalle ? | IPS, VA, OLED, Mini-LED, TN | Multi |
| 5 | Quelle fluidité ? | 60, 100, 144, 240, 360 Hz « et plus » | Choix unique, lu comme un minimum |
| 6 | Plat ou incurvé ? | Plat, Incurvé | Choix unique |
| 7 | Quel budget ? | De 0 à 2 000 €, par pas de 50 € | Plage |
| 8 | Des indispensables ? | USB-C 65 W+, KVM, HDR véritable, HDMI 2.1, Pied réglable, Rotation portrait, Haut-parleurs, Brillant, Calibré usine | ET |

### Profils de classement

La première réponse choisit les poids des critères ; sans réponse, un profil par défaut s'applique.

| Profil | Critères et poids |
| --- | --- |
| Clavier, jeu compétitif | Réactivité 3, rapid trigger 3, polling 2, compacité 2, construction 1 |
| Clavier, jeu polyvalent | Réactivité 2, RGB 1,5, construction 1,5, compacité 1, sans fil 1, polling 1 |
| Clavier, bureau & frappe | Silence 3, multi-appareils 2, toutes les touches 2, confort 2, construction 1 |
| Clavier, code | Programmable 3, confort 2, construction 2, silence 1 |
| Clavier, nomade | Légèreté 3, compacité 2, multi-appareils 2, autonomie 2, sans fil 1 |
| Écran, FPS compétitif | Fréquence 3, temps de réponse 3, taille e-sport 2, contraste 0,5 |
| Écran, jeu immersif | Contraste 3, HDR 2,5, immersion 2, fréquence 1 |
| Écran, console | Compatibilité console 3, HDR 2, contraste 1,5, fréquence 1 |
| Écran, création | Couleurs 3, netteté 2,5, ergonomie 1, contraste 1 |
| Écran, bureau & code | Netteté 2,5, ergonomie 2, connectique 2, espace de travail 1,5 |
| Écran, polyvalent | Fréquence 1,5, contraste 1,5, netteté 1,5, HDR 1, ergonomie 1 |

## Interface et animations

Chaque catégorie tient sur un seul écran : compteur et rail en haut à gauche, canvas infini des produits derrière, podium à droite, console des questions en bas. En fin de parcours, la console laisse la place aux résultats.

&#91;embedded content: maquette de la scène · écran de bureau\]

Le bleu tient ici la place de l'orange du site : n°1 du podium et option survolée. Sur mobile, le podium passe en rangée défilante au-dessus de la console, qui devient un panneau du bas.

| Élément | Ce qu'il montre | Animation |
| --- | --- | --- |
| Compteur (`LiveCounter`) | Produits restants « 0 025 sur 25 », aperçu orange au survol (« → 6 si choisi ») | Les chiffres défilent (0,9 s) |
| Rail (`AnswerRail`) | Les réponses données, en puces reliées ; un clic rouvre l'étape | La nouvelle puce glisse en place |
| Canvas (`Scene`) | Les produits de la catégorie en motif répété à l'infini, rang 01-03 du podium, popup de specs au survol | Dérive en diagonale, drag avec inertie, molette ; une réponse transforme les écartés en esquisses puis leur place est reprise par un produit retenu, en vague depuis la console |
| Console (`Console`) | Titre, aide, tuiles avec compteur et coche, impasse « Bloqué par … » + « Changer → », Continuer, Peu importe | Titre lettre par lettre (SplitText), tuiles en cascade ; sortie jouée avant la navigation |
| Podium (`Podium`) | Top 3 : silhouette, % de compatibilité, prix | Les cartes changent de place (Flip) |
| Résultats (`ResultsView`) | N°1 annoté comme un dessin technique, points forts et « à savoir », n°2 et n°3, liste des autres | Panneau qui monte, traits de rapport qui se dessinent |
| Budget (`BudgetControl`) | Double curseur ; tout en haut signifie sans plafond | Aucune |
| Silhouettes (`glyphs.tsx`) | Claviers dessinés selon format et couleur, écrans à l'échelle selon ratio, diagonale, courbure et dalle | Aucune |
| Accueil | Accroche « Arrête de chercher. Commence à choisir. » sur une bande inclinée par catégorie | Bandes qui défilent ; au survol, nom et compteur de la catégorie ; au clic, la bande s'étend en masque par-dessus les autres et zoome jusqu'au canvas |

- **Mobile** : la console devient un panneau du bas limité à 56 % de la hauteur, avec défilement interne. Podium et rail défilent horizontalement, les tuiles sont compactes. Vérifié à 375 px : aucun défilement horizontal.
- **Mouvement réduit** : chaque animation teste `prefersReducedMotion()` et pose directement l'état final.
- **Onglet masqué** : le navigateur suspend les animations, donc la sortie de la console a une minuterie de secours. La navigation ne dépend jamais d'une animation.
- **Style** : tout passe par les tokens et recettes Panda ; seuls le canvas et les silhouettes ont des couleurs en dur.

## Scène : bandes et canvas

Depuis le 20 octobre 2026, l'accueil et les pages catégorie partagent une seule scène, un `<canvas>` 2D monté dans le layout `/$lang`. Comme c'est le même dessin des deux côtés, passer de l'un à l'autre n'est qu'une interpolation : rien n'est démonté, donc rien ne clignote.

- **Accueil** : une bande inclinée par catégorie (donc 2 aujourd'hui ; une catégorie ajoutée ajoute sa bande). Chaque bande est une fenêtre sur le « monde » de sa catégorie, qui dérive le long de la bande. Les bandes sont aussi de vrais liens posés par-dessus avec la même forme (`clip-path`), d'où survol, focus, clic du milieu et SEO. Au survol, la bande zoome, les autres se voilent et le nom de la catégorie apparaît.
- **Ouverture** : au clic, la bande s'étend en masque par-dessus les autres (ombre portée pendant le mouvement) tandis que son monde zoome autour du point cliqué (1,25 s, `expo.inOut`). La page sort, la route change à mi-course, puis la console du parcours se relève en 3D quand la scène se pose. Le retour (logo, retour du navigateur) replie la bande dans son emplacement.
- **Canvas** : motif répété à l'infini (le catalogue y est posé plusieurs fois, mélangé, pour espacer les répétitions), dérive en diagonale du coin haut droit vers le bas gauche, drag avec inertie, molette. Survoler un produit arrête la dérive et ouvre une fiche (rang, compatibilité, specs) reliée au produit par un trait de rappel.
- **Filtres** : une réponse transforme les produits écartés en esquisses (contours pointillés, comme les lignes cachées d'un dessin technique), puis leur place est reprise par des produits retenus ; tout part en vague depuis la console. Survoler une option entoure en orange les produits qu'elle garde.

| Fichier | Rôle |
| --- | --- |
| `features/scene/geometry.ts` | Forme des bandes selon l'écran, motif du canvas, tracés arrondis, `clip-path` des liens |
| `features/scene/renderer.ts` | Dessin, dérive, transitions (`go`), états des produits (`setTargets`), pointeur (`pick`, drag) |
| `features/scene/controller.ts` | Pont routes ↔ scène (`scene.showBands`, `scene.showCanvas`), délais d'entrée |
| `features/scene/navigation.ts` | Sortie de page puis navigation (`useSceneNavigation`), délai d'entrée des pages |
| `features/scene/sprites.tsx` | Silhouettes rendues hors écran puis converties en images (couleur et esquisse) |
| `features/scene/Scene.tsx`, `PopupCard.tsx` | Le canvas, la gestion du pointeur, la fiche produit |

## SEO et i18n

Chaque page est rendue côté serveur avec son titre, sa description, une URL canonique et les liens `hreflang` FR/EN. Les chemins sont traduits ; les clés des paramètres restent en anglais dans les deux langues.

| URL | Rôle |
| --- | --- |
| `/` | Redirection 302 vers `/fr` ou `/en` selon `Accept-Language` |
| `/fr`, `/en` | Accueil |
| `/fr/claviers`, `/en/keyboards`, `/fr/ecrans`, `/en/monitors` | Parcours ; titre du type « Claviers : trouve le tien en quelques questions · choose-a-device » |
| `/api/catalog/keyboard`, `/api/catalog/monitor` | Snapshot JSON avec ETag, cache 60 s puis 600 s en stale-while-revalidate |
| Toute autre langue ou catégorie | 404 |

- **Paramètres** : chaînes simples, virgules non encodées (`?size=full,f96&layout=azerty`). `at=<étape>` rouvre une étape, `at=done` affiche les résultats.
- **Canonique** : une URL de parcours avec réponses pointe vers la page de catégorie, pour ne pas indexer chaque combinaison.
- **Changement de langue** : garde la catégorie et les réponses (`/fr/claviers?…` ↔ `/en/keyboards?…`).
- **Textes** : interface dans `apps/web/src/i18n/messages.ts` ; questions, options et critères dans `packages/catalog`, toujours sous la forme `{ fr, en }`.
- **Pas encore fait (phase 5)** : fiches produit, pages collections, `sitemap.xml`, `robots.txt`, JSON-LD, images OG, `noindex` des combinaisons, prérendu.

## Lancer le projet

Il faut Node 22.12 ou plus : sur cette machine le Node par défaut est en v20, donc on passe par le Node 24 de Homebrew. Postgres vient de Homebrew (`postgresql@14`) en local, ou de Docker sur un serveur.

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
pnpm install
pnpm pg:local
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Le site répond alors sur http://localhost:3000. Le fichier `.env` à la racine contient `DATABASE_URL=postgres://choose:choose@localhost:54329/choose_a_device`, copié de `.env.example`.

| Commande | Effet |
| --- | --- |
| `pnpm dev` | Serveur de dev du site, port 3000 |
| `pnpm build` | Build de production dans `apps/web/.output` |
| `pnpm --filter @choose/web start` | Lance le build de production avec le `.env` racine |
| `pnpm test` | 28 tests du moteur (Vitest) |
| `pnpm typecheck` | `tsc` sur `catalog`, `db` et `web` |
| `pnpm lint`, `pnpm format` | Biome : vérification, puis correction automatique |
| `pnpm pg:local` (ou `stop`, `status`) | Postgres local : port 54329, données dans `.pgdata` |
| `pnpm db:generate`, `db:migrate`, `db:seed`, `db:studio` | Migrations Drizzle, seed YAML, interface de la base |

- Si `apps/web/styled-system/` manque (dossier généré, non versionné) : `pnpm --filter @choose/web exec panda codegen`.
- Dans l'app Claude, le serveur de prévisualisation « web » est décrit dans `.claude/launch.json`.

## Ce qui a été vérifié

Tout ce qui se vérifie sans regarder l'écran est au vert ; les animations en mouvement, elles, n'ont pas été vues.

| Vérification | Résultat |
| --- | --- |
| Tests du moteur (Vitest) | 28 sur 28 : 17 sur un mini-catalogue vérifiable à la main, 11 sur les vrais questionnaires et les données de démo |
| Typecheck (`tsc`, TypeScript 7) | 0 erreur sur `catalog`, `db` et `web` |
| Lint (Biome) | 0 erreur |
| Build de production | OK, seulement des avertissements `use client` de TanStack Router, sans effet |
| Migration et seed | 9 marques, 16 switchs, 25 claviers, 25 écrans ; seed relancé sans écart |
| Snapshot de la base contre YAML | Identiques : 25/25 claviers, 25/25 écrans |
| Rendu serveur en production (`curl`) | `/en/monitors?use=fps` : `lang="en"`, titre traduit, `hreflang`, question « How big? » présente. `/` redirige selon la langue, `/xx/claviers` répond 404, l'API répond 200 (35 Ko, ETag) |
| Bundle client | Aucune trace de `postgres` ni de `drizzle` |
| Navigateur en 1440 × 900 | Parcours clavier complet, choix multiple, impasse « Bloqué par Taille », budget en direct (700 € → 4 écrans), résultats annotés, FR et EN |
| Navigateur en 375 × 812 | Aucun défilement horizontal, console défilable |

Les animations n'ont été vérifiées que par leur état final : le panneau du navigateur était masqué, ce qui les met en pause. Pour les captures, la fin de chaque animation a été forcée depuis la console.

## Pièges et points d'attention

Chacun de ces pièges a coûté du temps pendant la mise en place ; les connaître évite de les redécouvrir.

- **Node 20 par défaut** : TanStack Start exige Node 22.12 ou plus. Toujours préfixer le `PATH` avec `/opt/homebrew/opt/node@24/bin`.
- **Panda v2, presets** : sans `@pandacss/preset-base` et `@pandacss/preset-panda` dans `presets`, plus aucun utilitaire ni token par défaut.
- **Panda, extraction statique** : aucune valeur calculée dans `css()`, pas de template string avec variable. Faire deux classes statiques et choisir entre elles, ou passer par `style={}`.
- **Accès à la base** : uniquement via `await import('./snapshot.server')` dans un handler de server function ou de route serveur. Un import statique de `@choose/db` embarque `postgres` dans le bundle client (« Buffer is not defined »).
- **`navigator` existe côté serveur** : Node 24 l'expose. Pour savoir si on est dans le navigateur, tester `typeof window`.
- **Animations et onglet masqué** : `requestAnimationFrame` s'arrête. Tout code qui attend la fin d'une animation GSAP doit avoir une minuterie de secours.
- **Scène** : elle est montée une fois dans le layout `/$lang` ; une page demande ce qu'elle doit montrer (`scene.showBands()`, `scene.showCanvas(c)`) et ne la démonte jamais. Les entrées de page sont des animations CSS (`animation-fill-mode: backwards`) pour ne pas clignoter au rendu serveur ; les sorties sont en GSAP.
- **Panneau du navigateur masqué** : rAF, animations et minuteries y ralentissent fortement ; les captures peuvent montrer une image ancienne. Vérifier l'état par le DOM ou forcer la fin des animations.
- **Tester une animation sans la voir** : dans la console du navigateur, `(await import('/src/features/motion/gsap.ts')).gsap.globalTimeline.getChildren(true, true, true).forEach(t => t.progress(1))`.
- **YAML** : une valeur avec une virgule dans une map en ligne `{ … }` doit être entre guillemets.
- **TypeScript** : `tsc` est TypeScript 7 (natif, rapide) ; le paquet `typescript` est un alias vers TypeScript 6 pour les outils qui ont besoin de son API JavaScript.
- **Rechargement à chaud** : une modification de code pendant un parcours peut remettre à zéro un choix multiple en cours (vu une fois en dev).

## Limites connues et dette technique

La principale limite tient aux données : avec 25 produits fictifs par catégorie, le nuage paraît clairsemé et plusieurs étapes se sautent vite. Le reste est une dette assumée pour cette première version.

- **Données** : grappes de 1 à 4 points. Après « 40 % », il ne reste qu'un clavier et le parcours va directement aux résultats.
- **Canvas 2D** : à l'aise avec quelques centaines de produits ; les sprites coûtent environ 50 Mo de mémoire sur un écran DPR 2. Au-delà, passer la scène en WebGL.
- **Catalogue entier dans le HTML** : le loader envoie tout le snapshot au premier rendu. Correct à 50 produits ; à 2 000, rendre seulement le top côté serveur et charger le reste ensuite.
- **Poids du bundle** : un morceau partagé d'environ 120 Ko contient probablement Zod et le catalogue. Une entrée « moteur seul » sans Zod côté client l'allégerait, à mesurer.
- **Ni photos, ni prix boutiques, ni fiche produit** : les visuels sont des silhouettes SVG, la table `offers` est vide et les résultats ne mènent encore nulle part.
- **Seuils de format** : « Grand format 42"+ » prend les écrans 16:9 dès 36". Les seuils sont à recaler sur les vraies données.
- **Accessibilité** : tuiles et canvas non audités (le canvas est masqué aux lecteurs d'écran ; les bandes sont de vrais liens focalisables), pas de test au clavier seul.
- **Podium rendu deux fois** : colonne sur grand écran, rangée sur mobile, l'une masquée en CSS.
- **Le seed ne supprime rien** : un produit retiré des YAML reste en base.
- **Ni tests d'interface ni CI**, et aucun commit pour l'instant.
- **Prévu mais pas encore utilisé** : ScrollTrigger, three et React Three Fiber.

## Prochaines étapes

La suite logique est la phase 5 (pages SEO) et les vraies données ; la scène pourra passer en WebGL si le catalogue grossit.

- [x] **Premier commit** sur `main` : fait (`e4ca02a`).
- [ ] **Scène WebGL (si besoin)** : même rendu que `features/scene/renderer.ts` en shaders, si le catalogue dépasse quelques centaines de produits.
- [ ] **Phase 5, pages SEO** : fiche produit `/fr/claviers/<slug>` (héros annoté, fiche technique, JSON-LD), pages collections (« 75 % sans fil », « OLED 27" 240 Hz »), `sitemap.xml`, `robots.txt`, `noindex` des combinaisons, images OG, prérendu.
- [ ] **Vraies données** : rechercher les claviers et écrans, écrire les scripts d'ingestion (TS, ou Python qui écrit dans Postgres), ajouter photos détourées, prix (`offers`) et liens d'affiliation.
- [ ] **Performance** : entrée moteur sans Zod côté client ; top produits rendu côté serveur, catalogue chargé ensuite.
- [ ] **Idées en attente** : spécimen 3D procédural (accueil, tuiles), sons et courbes de force des switchs, démo de fréquence et loupe PPI dans les tuiles, vue éclatée, thème sombre, analytics, back-office (interface interne ou Directus).
