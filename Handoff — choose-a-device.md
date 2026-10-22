# Handoff — choose-a-device

Oct 22, 2026 · @Eddy

## En bref

choose-a-device est un « finder » de claviers et d'écrans inspiré de [shapefinder.cc](https://shapefinder.cc/) : une suite de questions qui resserre le catalogue en direct, sans tableau ni filtres. Les phases 0 à 3 du plan sont terminées. Le 20 octobre 2026, le nuage de données a laissé place à une scène en canvas : un accueil en bandes inclinées qui s'ouvrent en canvas infini (voir « Scène : bandes et canvas »).

- **Ce qui marche** : accueil, parcours claviers (10 questions) et écrans (8) dans l'ordre que le visiteur choisit, résultats annotés, fiche produit (depuis le canvas, le podium ou les résultats), en français et en anglais, avec rendu côté serveur.
- **En ligne** : [choose-a-device.netlify.app](https://choose-a-device.netlify.app) sur Netlify, base Postgres sur Neon (Francfort), depuis le 20 octobre 2026.
- **Données** : 523 vrais claviers (34 marques, importés par pnpm ingest depuis 12 sources) et 25 écrans de démonstration. 369 claviers montrent leur photo détourée sur le canvas, les autres leur dessin.
- **Qualité** : 36 tests du moteur et typecheck des 4 paquets au vert ; Biome propre sur les fichiers au style Biome (plusieurs fichiers sont au format Prettier, voir « Pièges »).
- **État du dépôt** : `main` = `f54dc9b` « Updating performances », poussé et déployé le 22 octobre. Cinq correctifs faits après ce commit sont dans le dossier local, à pousser, dont celui du magasin de dessins (voir « Retours du 22 octobre »).

Pour reprendre : Node 24, `pnpm install`, puis `pnpm dev` ; le `.env` racine pointe sur la base Neon (détails dans « Lancer le projet » et « Mise en ligne »). Le plan d'origine est dans `~/.claude/plans/https-shapefinder-cc-j-aime-beaucoup-le-cheerful-yao.md`.

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
| Dizaines de produits flottant autour de la question | Repris en canvas infini : les produits dérivent derrière la question ; quand il en reste peu, ils se regroupent devant |
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
| `apps/web/src/features/finder/` | État du parcours (`useFinder`) et ses composants : console, podium, résultats, fiche produit en tiroir |
| `apps/web/src/features/scene/` | Scène partagée accueil ↔ canvas : géométrie des bandes et du motif (`geometry.ts`), rendu (`renderer.ts`), pont routes ↔ scène (`controller.ts`), navigation chorégraphiée (`navigation.ts`), sprites des silhouettes, popup produit |
| `apps/web/src/features/product/` | Silhouettes SVG générées depuis les specs, specs clés formatées, héros annoté et jauge de compatibilité partagés par les résultats et la fiche produit |
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
| `product_images` | URL, type de visuel, dimensions, couleur dominante | 1 353 vues de dessus des claviers ; le site lit la principale |
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

Le classement mêle l'adéquation au profil (75 %) et un a priori (25 %). L'adéquation est une moyenne géométrique pondérée des critères du profil, plancher 0,05 : un critère catastrophique fait chuter tout le score au lieu d'être noyé dans la moyenne. L'a priori combine note éditoriale (e) et popularité (p) ; les égalités se départagent par slug. Depuis le 21 octobre, le % affiché ajoute les réponses : chaque réponse qui filtre (n) est un critère que tout produit classé respecte, donc le % part de l'adéquation et monte à chaque réponse, sans changer l'ordre.

```latex
\text{fit} = 0{,}75 \cdot \exp\left(\frac{\sum_k w_k \ln \max(0{,}05,\ s_k)}{\sum_k w_k}\right) + 0{,}25 \cdot (0{,}6\,e + 0{,}4\,p) \qquad \text{score} = \frac{3\,\text{fit} + n}{3 + n}
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

Cette maquette date d'avant le 20 octobre 2026 : le nuage de points au centre a depuis laissé place au canvas des produits.

| Élément | Ce qu'il montre | Animation |
| --- | --- | --- |
| Compteur (`LiveCounter`) | Produits restants « 0 025 sur 25 », aperçu orange au survol (« → 6 si choisi ») | Les chiffres défilent (0,9 s) |
| Rail (`AnswerRail`) | Les réponses données, en puces reliées ; un clic rouvre l'étape | La nouvelle puce glisse en place |
| Canvas (`Scene`) | Les produits de la catégorie en motif répété à l'infini, rang 01-03 du podium, popup de specs au survol, fiche produit au clic | Dérive en diagonale, drag avec inertie, molette ; une réponse retire les écartés et resserre les retenus, en vague depuis la console ; une liste courte se regroupe devant le canvas |
| Console (`Console`) | Hauteur de sa question, animée d'une question à l'autre, bord bas fixe ; titre, aide en surimpression (en clair au-dessus des tuiles quand elles tiennent sur une rangée), tuiles avec compteur et coche, impasse « Bloqué par … » + « Changer → », Continuer, Peu importe | Se relève en 3D à l'arrivée depuis l'accueil ; titre lettre par lettre (SplitText), tuiles en cascade ; sortie jouée avant la navigation |
| Podium (`Podium`) | Top 5 : trois cartes (silhouette, % de compatibilité, prix), puis les n°4 et 5 en lignes compactes si la hauteur le permet ; « Voir tout » ouvre le classement complet ; un clic ouvre la fiche | Les cartes changent de place (Flip) |
| Résultats (`ResultsView`) | N°1 annoté comme un dessin technique, points forts et « à savoir », n°2 et n°3, liste des autres ; chaque produit ouvre sa fiche, « Modifier mes réponses » revient à l'étape quittée | Panneau qui monte, traits de rapport qui se dessinent |
| Fiche produit (`ProductDrawer`) | Rang et compatibilité, ou « Écarté par … » ; dessin annoté à légende numérotée, points forts, « à savoir », fiche technique, « Où l'acheter » (emplacement des offres affiliées) ; précédent / suivant dans le classement | Glisse depuis la droite (feuille du bas sur mobile) ; Échap, fond ou croix pour fermer |
| Budget (`BudgetControl`) | Histogramme des prix de ce que les autres réponses laissent, double curseur ; tout en haut signifie sans plafond | Les barres de la plage passent à l'encre au fil du curseur |
| Silhouettes (`glyphs.tsx`) | Claviers dessinés selon format et couleur, écrans à l'échelle selon ratio, diagonale, courbure et dalle | Aucune |
| Accueil | Accroche « Arrêter de chercher. Commencer à choisir. » sur une bande inclinée par catégorie | Bandes qui défilent ; au survol, nom et compteur de la catégorie sur une plaque floutée qui penche avec la bande ; au clic, la bande s'étend en masque par-dessus les autres et zoome jusqu'au canvas |

- **Mobile** : la console devient un panneau du bas limité à 56 % de la hauteur, avec défilement interne. Podium et rail défilent horizontalement, les tuiles sont compactes. Vérifié à 375 px : aucun défilement horizontal.
- **Mouvement réduit** : chaque animation teste `prefersReducedMotion()` et pose directement l'état final.
- **Onglet masqué** : le navigateur suspend les animations, donc la sortie de la console a une minuterie de secours. La navigation ne dépend jamais d'une animation.
- **Style** : tout passe par les tokens et recettes Panda ; seuls le canvas et les silhouettes ont des couleurs en dur.

## Scène : bandes et canvas

Depuis le 20 octobre 2026, l'accueil et les pages catégorie partagent une seule scène, un `<canvas>` 2D monté dans le layout `/$lang`. Comme c'est le même dessin des deux côtés, passer de l'un à l'autre n'est qu'une interpolation : rien n'est démonté, donc rien ne clignote.

- **Accueil** : une bande inclinée par catégorie (donc 2 aujourd'hui ; une catégorie ajoutée ajoute sa bande). Chaque bande est une fenêtre sur le « monde » de sa catégorie, qui dérive le long de la bande. Les bandes sont aussi de vrais liens posés par-dessus avec la même forme (`clip-path`), d'où survol, focus, clic du milieu et SEO. Au survol, la bande zoome, les autres se voilent et le nom de la catégorie apparaît sur une plaque floutée. Cette étiquette est posée à côté du lien, donc jamais coupée par sa découpe ; elle penche avec le bord gauche de sa bande et prend la largeur que la bande lui laisse, si bien qu'elle y tient quel que soit le nombre de catégories.
- **Ouverture** : au clic, la bande s'étend en masque par-dessus les autres (ombre portée pendant le mouvement) tandis que son monde zoome autour du point cliqué (1,25 s, `expo.inOut`). La page sort, la route change à mi-course, puis la console du parcours se relève en 3D quand la scène se pose. Le retour (logo, retour du navigateur) replie la bande dans son emplacement.
- **Canvas** : motif répété à l'infini (le catalogue y est posé plusieurs fois, mélangé, pour espacer les répétitions), dérive en diagonale du coin haut droit vers le bas gauche, drag avec inertie, molette. Survoler un produit arrête la dérive et ouvre une fiche (rang, compatibilité, specs) reliée au produit par un trait de rappel. Un clic (ou un tap) ouvre la fiche produit complète ; le curseur devient une main au survol d'un produit.
- **Filtres** : depuis le 22 octobre, le canvas ne montre que les produits retenus. Un produit écarté s'efface, les retenus glissent vers leur place dans un motif recomposé sans trous, le tout en vague depuis la console. Survoler une option entoure en orange les produits qu'elle garde.
- **Liste courte** : dès qu'il reste au plus 12 produits retenus et qu'ils tiennent dans l'espace libre (entre le compteur, le podium et la console, mesuré par `Finder` et transmis par `scene.setStage`), ils quittent le canvas et se regroupent en grille devant lui, chacun une seule fois, avec leur rang. Leurs copies sur le canvas s'effacent ; elles reviennent quand la liste s'allonge. La grille se centre sur l'axe de la console quand elle y tient (sinon sur tout l'espace libre) ; derrière elle, le canvas n'a plus que son papier pointillé.
- **Changement de catégorie** (header, depuis un canvas) : le canvas reste en place, les anciens produits se dissolvent et les nouveaux apparaissent en vague depuis le lien cliqué. La console ne bouge pas : seule sa question change. Chaque catégorie mémorise son parcours dans le stockage du navigateur (`choose-a-device:journey:<catégorie>`) et le reprend au retour ; « Recommencer » le remet à zéro.
- **Console** : même hauteur à toutes les étapes. Les tuiles se partagent l'espace (au-delà de deux rangées la grille défile ; une question qui tient sur une rangée, 5 tuiles au plus sur grand écran, garde des tuiles de hauteur normale et affiche son aide en clair au-dessus), le budget remplit l'espace avec l'histogramme des prix, l'aide s'ouvre par-dessus. La coche d'une tuile choisie déborde dans une marge intérieure de la grille : elle n'est jamais rognée.

| Fichier | Rôle |
| --- | --- |
| `features/scene/geometry.ts` | Forme des bandes selon l'écran, motif du canvas, tracés arrondis, `clip-path` des liens |
| `features/scene/renderer.ts` | Dessin, dérive, transitions (`go`), états des produits (`setTargets`), pointeur (`pick`, drag) |
| `features/scene/controller.ts` | Pont routes ↔ scène (`scene.showBands`, `scene.showCanvas`, `scene.setStage`), type de transition à l'arrivée, délais d'entrée |
| `features/scene/navigation.ts` | Sortie de page puis navigation (`useSceneNavigation`), parcours mémorisés par catégorie, délai d'entrée des pages |
| `features/scene/sprites.tsx` | Dessins partagés par signature, rastérisés à la demande, et magasin de photos (worker, budget mémoire) |
| `features/scene/Scene.tsx`, `PopupCard.tsx` | Le canvas, la gestion du pointeur, la fiche produit |

## Retours du 21 octobre

Deux tours de retours sur le site en ligne ont retouché le finder ; tout est vérifié dans le navigateur (typecheck, 32 tests et build au vert), puis commités et déployés avec la suite.

| Retour | Ce qui a changé | Où |
| --- | --- | --- |
| Le contour orange chevauche les pastilles 1, 2, 3 et les voisins | La pastille est posée sur le bord haut du contour, qui s'ouvre autour d'elle. Le contour garde la taille de repos (le dessin ne grossit que de 1,5 %) et la liste courte réserve sa place et celle de la pastille | `scene/renderer.ts` |
| Le gris clignote en passant d'une option à l'autre | Le survol tient 160 ms après la sortie d'une tuile : le canvas passe d'une option à la suivante sans repasser par « rien » | `finder/useFinder.ts` |
| Un % déjà rempli et un top à l'étape 1 | Rien n'est classé avant la première réponse utile (`isInformed`) : podium en pointillés, ni rang ni %. Ensuite le % monte à chaque réponse (formule du « Moteur de parcours ») | `catalog/finder/engine.ts`, `Podium.tsx` |
| Choisir l'ordre du parcours | Module « Parcours » sous la console : la frise garde l'ordre du questionnaire (✓ répondu, pointillés à venir) et la question en cours est détachée dans un emplacement « En cours ». Choisir une étape la monte dans l'emplacement ; flèche ↑ au survol, bulle d'aide à la première visite. L'ordre de réponse va dans l'URL (`order=`) et le moteur le lit (`withOrder`) | `finder/JourneyBar.tsx`, `engine.ts` |
| Une première version réordonnait la frise : confus | Remplacée par la frise fixe et l'emplacement « En cours » ci-dessus | `JourneyBar.tsx` |
| Console à hauteur fixe | Elle prend la hauteur de sa question. Un panneau unique (`DockPanel`) anime sa hauteur, bordures comprises, bord bas fixe ; au-delà d'un plafond, les tuiles défilent | `finder/DockPanel.tsx`, `Console.tsx` |
| L'ajustement de taille saute à la fin | La cible ignorait les 2 px de bordure ; le panneau rejoint aussi en douceur tout ce qui a bougé pendant l'animation | `DockPanel.tsx` |
| Popups du canvas pendant qu'une liste est affichée | Liste courte affichée : seuls ses produits réagissent. Résultats ouverts : plus rien ne réagit (`setPickable`) | `renderer.ts`, `controller.ts` |
| Un écran seul en fin de parcours à 79 % : pourquoi pas 100 % ? | Détail du % (« Tes réponses : N sur N », « Pour ton usage · X % ») dans la fiche et en tête des résultats, ⓘ sous « Compatibilité » dans le podium | `product/MatchBreakdown.tsx`, `Podium.tsx` |
| « Voir les N résultats » devrait prolonger le module du bas | La console s'efface, le même panneau s'étire jusqu'aux résultats et revient pour « Modifier mes réponses » ; le podium s'efface au lieu de disparaître | `DockPanel.tsx`, `ResultsView.tsx`, `Finder.tsx` |

Les animations ont été vérifiées par mesures (bord bas fixe, hauteur finale égale à la cible, survols enchaînés), pas regardées en temps réel : le panneau du navigateur les ralentit trop.

## Vraies données et photos (21–22 octobre)

Le catalogue de démo a laissé place à 523 vrais claviers de 34 marques, en base Neon depuis le seed du 22 octobre ; les écrans restent les 25 de démonstration.

| Sujet | État |
| --- | --- |
| Ingest | `packages/ingest`, `pnpm ingest <source> [--next N] [--dry-run] [--refresh]`. 12 sources : Keychron, mechanicalkeyboards.com, boutiques Shopify (Epomaker, Womier, Yunzii, Ajazz, HyperX, Turtle Beach), sites officiels (Logitech, Logitech G, Corsair, Razer, SteelSeries). Ajoute à `data/keyboards/<marque>.yaml` sans jamais réécrire une fiche ; `# à vérifier` marque les déductions |
| Curation | `data/excluded.yaml` liste les modèles et marques écartés exprès (éditions spéciales, marques à 1–3 modèles) ; le seed retire ce que `data/` ne liste plus, avec un garde-fou (`SEED_PRUNE=force` au-delà de max(30, la moitié du catalogue)) |
| Prix | Indicatifs, pas de promo : prix habituel, médiane des variantes, arrondi à 5 € ; boutiques US : € = $ × 1,2. Rafraîchissement hebdomadaire `pnpm ingest prices` |
| Switchs | Specs lues seulement sur des fiches texte ; les switchs maison (Razer, Corsair MLX, Logitech GX…) restent non résolus, donc ces claviers sortent à la question du ressenti |
| Photos | `product_images` rempli (1 353 vues `cutout_top`) ; le snapshot envoie la vue principale. Le navigateur la détoure et ne l'utilise sur le canvas que vue de dessus (remplissage ≥ 0,8, proportions 0,7–1,15 du dessin) ; la fiche produit, le podium et les résultats l'utilisent toujours (`ProductPicture`) |

- Pas fait : Cherry (page anti-bot, à ne pas contourner), NuPhy (429), ASUS ROG, Akko/MonsGeek, Apple, Microsoft. LDLC donnerait les prix € et l'AZERTY mais pose une question de droit des bases de données.
- Un seed de production se fait seulement avec l'accord explicite de l'utilisateur.

## Retours du 22 octobre

Cinq retours sur le site avec les vraies données ont donné un canvas qui démarre sans bloquer et tient en mémoire, des écartés qui quittent le canvas, plus de photos et un preloader. Tout est dans le commit `f54dc9b`, sauf cinq correctifs à pousser.

| Mesure | Avant | Après |
| --- | --- | --- |
| Blocage du fil principal au démarrage | 530 ms + \~800 ms de rastérisation (prod, DPR 1) | 0 ms de blocage, aucune frame longue (prod) |
| Bitmaps des dessins | 1 096 (couleur + esquisse par produit) : \~116 Mo en DPR 1, \~463 Mo en Retina | 98 partagés (77 dessins pour 523 claviers) : 45 Mo en Retina |
| Photos sur le canvas | 357 sur 522 | 369 sur 522 (Razer 0 → 13) |
| Photos Logitech | PNG 3840 × 2160 de \~4 Mo, \~200 ms de détourage chacune sur le fil principal | \~20 Ko en WebP, détourage dans un worker |
| Réponse du serveur | 0,6 s à chaud, 3 s à froid, `no-cache` | \~0,45 s depuis le cache durable Netlify |

| Retour | Ce qui a changé | Où |
| --- | --- | --- |
| « Bloqué par X » chevauche « Changer → » | Une tuile en impasse est un bloc `data-dead`, plus un bouton ; « Changer → » est un vrai bouton dans le flux, qui passe à la ligne si besoin ; les rangées grandissent (`minmax`) | `finder/Console.tsx`, recette `optionTile` |
| Une pastille de la frise oubliait le brouillon | Une pastille, une puce du rail ou « Changer → » valident le brouillon comme « Continuer » ; « Retour » l'abandonne. Les questions qui ne départagent plus rien restent à leur place, grisées et désactivées (`withDraft`, `journeyStates`) | `engine.ts`, `useFinder.ts`, `JourneyBar.tsx` |
| Le chargement initial rame | Dessins partagés par signature (`glyphKey`) et créés à la demande ; plaque discrète le temps d'un dessin ; plus d'esquisses | `scene/sprites.tsx`, `renderer.ts` |
| Zones vides en affinant | Les écartés quittent le canvas : ils s'effacent en vague, les retenus glissent vers leur place dans un motif recomposé (`regroup`, 160 ms d'attente pour le curseur du budget). Derrière une liste courte, le canvas n'a plus que son papier | `scene/renderer.ts`, `Finder.tsx` |
| Des photos ne remplacent jamais le dessin | Magasin de photos : visibles d'abord, deux finesses, nouvelles tentatives, budget 32/64 Mo ; détourage dans un Web Worker ; passage par Netlify Image CDN (Razer refusait le CORS ; ses URL sont déballées vers `medias-p1.phoenix.razer.com`) | `scene/sprites.tsx`, `product/photo.ts`, `product/cutout.worker.ts`, `netlify.toml` |
| Un preloader | « Clavier qui se remplit » : clavier 75 % en trait, touches encrées au fil du vrai chargement, Entrée orange à 100 %, rideau incliné à 16°. Visible dès le HTML ; `html[data-loading]` met les entrées CSS en pause et la timeline GSAP attend ; 0,65 s minimum, 2,6 s maximum, garde de 5 s | `scene/Preloader.tsx`, `styles.css`, `routes/$lang.tsx`, `routes/__root.tsx` |
| Chargement côté serveur | `Netlify-CDN-Cache-Control: public, durable, s-maxage=300, stale-while-revalidate=604800` sur les pages `/$lang` et l'API ; `/` (redirection par langue) reste sans cache | `routes/$lang.tsx`, `routes/api/catalog.$category.ts` |

- Mesurer : `__scene.stats()` dans la console en dev (en production après `localStorage['choose-a-device:stats'] = '1'`) donne bitmaps et octets, magasin de photos, temps de frame, frames longues et repères `scene:*`.
- Géométrie des dessins, détourage et garde-fou « vue de dessus » vivent dans `@choose/catalog/media`, partagés entre le site et l'ingest.
- Diagnostic des 165 claviers sans photo : 28 Razer bloqués par le CORS (13 récupérés), 33 photos sur fond non clair, 104 vues de biais ; 24 ont une meilleure image secondaire (à choisir à l'ingest).
- Pas encore vu en mouvement : la recomposition et le preloader ont été vérifiés par mesures et captures, panneau du navigateur masqué.

## SEO et i18n

Chaque page est rendue côté serveur avec son titre, sa description, une URL canonique et les liens `hreflang` FR/EN. Les chemins sont traduits ; les clés des paramètres restent en anglais dans les deux langues.

| URL | Rôle |
| --- | --- |
| `/` | Redirection 302 vers `/fr` ou `/en` selon `Accept-Language` |
| `/fr`, `/en` | Accueil |
| `/fr/claviers`, `/en/keyboards`, `/fr/ecrans`, `/en/monitors` | Parcours ; titre du type « Claviers : trouve le tien en quelques questions · choose-a-device » |
| `/api/catalog/keyboard`, `/api/catalog/monitor` | Snapshot JSON avec ETag, cache 60 s puis 600 s en stale-while-revalidate |
| Toute autre langue ou catégorie | 404 |

- **Paramètres** : chaînes simples, virgules non encodées (`?size=full,f96&layout=azerty`). `at=<étape>` rouvre une étape, `at=done` affiche les résultats ; il s'accompagne de from=<étape>, l'étape d'où ils ont été ouverts, où « Modifier mes réponses » revient.
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

Le site répond alors sur http://localhost:3000. Depuis le 20 octobre, le `.env` racine contient les variables écrites par `neon deploy` (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`) : `pnpm dev`, `pnpm db:migrate` et `pnpm db:seed` visent donc la branche `production` de Neon. Pour revenir au Postgres local (`pnpm pg:local`), remettre l'URL de `.env.example`.

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

## Mise en ligne : Netlify + Neon

Le site tourne depuis le 20 octobre 2026 sur [choose-a-device.netlify.app](https://choose-a-device.netlify.app) : Netlify construit `main` du dépôt GitLab à chaque push, et la base est un Postgres 18 sur Neon (AWS eu-central-1, Francfort), migré et rempli avec les données de démo.

| Élément | Réglage |
| --- | --- |
| Hébergement | Netlify : pages, server functions et API dans une seule Netlify Function (`@netlify/vite-plugin-tanstack-start`), fichiers statiques dans `apps/web/dist/client` |
| Base | Neon, projet `super-night-02529536`, branche `production`, organisation `org-purple-wave-32907016` |
| Lien local | `.neon` (ignoré par git) et `neon.ts` (politique de branches : une nouvelle branche expire après 7 jours) |
| Variables | `DATABASE_URL` (pooler, lue par le site, aussi définie sur Netlify), `DATABASE_URL_UNPOOLED` (directe, migrations et seed) |
| Driver du site | `@neondatabase/serverless` en HTTP quand l'hôte finit par `.neon.tech`, `postgres` en TCP sinon (`packages/db/src/client.ts`) |
| Seed et migrations | TCP direct (`connectDirect`, drizzle-kit sur `DATABASE_URL_UNPOOLED`) : le seed tient en une transaction, ce que le driver HTTP ne sait pas faire |

La CLI Neon passe par `npx` (l'installation globale est refusée sur cette machine) :

```bash
npx neon@latest login
npx neon@latest deploy
pnpm db:migrate && pnpm db:seed
```

- `neon deploy` réécrit le `.env` racine ; l'URL du Postgres local reste dans `.env.example`.
- `neon init` échoue dans un workspace pnpm sans `-w` : `@neon/config` et `@neon/env` sont donc en devDependencies de la racine.
- La connexion navigateur de la CLI expire en 60 s quand un agent la lance : `neon login` se fait à la main.
- Les fonctions Netlify tournent par défaut à us-east-2 (Ohio) et la base à Francfort : chaque requête traverse l'Atlantique. Si l'offre le permet, régler la région des fonctions sur eu-central-1.
- Le snapshot (4 requêtes en série par catégorie) reste 60 s en mémoire par instance de fonction.

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
| Navigateur en 375 × 812 | Accueil et canvas sans défilement horizontal ; la grille de la console défile dans sa hauteur fixe |
| Scène (712 × 1302 et 1280 × 800) | Bandes, survol avec le nom sur plaque floutée, ouverture en masque + zoom, popup de specs, retour à l'accueil, passage Claviers ↔ Écrans avec reprise du parcours |
| Console à hauteur fixe | 360 px aux 10 étapes claviers et aux étapes écrans en 1280 × 800, FR et EN, aucune tuile coupée |
| Liste courte | « 75 % » : les 4 claviers retenus regroupés devant le canvas, une fois chacun, esquisses graduées derrière |
| Accueil (1440 × 900 et 375 × 812) | Plaque « Écrans » à 16 px du séparateur en haut comme en bas (−17 px avant) ; sur téléphone, les deux étiquettes tiennent dans leur bande ; calcul de la place vérifié de 2 à 5 catégories |
| Console et liste courte (1440 × 900) | Tuiles d'une rangée à 112 px au lieu de 228, console toujours à 376 px ; coches entières ; liste courte centrée sur l'axe (claviers 3 × 3, écrans 5 en ligne) ; sous elle, aucune esquisse ne réagit au survol |
| Fiche produit, podium et résultats | Fiche ouverte depuis le canvas, le podium et les résultats, précédent / suivant, Échap ; « Voir les 9 résultats » garde la sélection en cours, « Modifier mes réponses » revient à l'étape quittée ; top 5 à 900 px de haut, top 3 + « Voir tout » à 790 px |

Les animations n'ont pas été vues en temps réel : le panneau du navigateur intégré les ralentit fortement. Les états finaux et quelques images intermédiaires ont été contrôlés, en forçant la fin des animations depuis la console.

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
- **Container queries** : le podium en colonne et le héros annoté se règlent sur leur conteneur, pas sur l'écran (`@container`). Le podium montre le n°4 dès 22rem de haut et le n°5 dès 25rem ; le héros passe en légende numérotée sous 40rem de large.
- **Sélection et glisser natif coupés** : `user-select: none` sur tout le site (sauf les champs de saisie) et `dragstart` annulé sur le document. Un texte qui doit se copier réactive la sélection localement.

* **Deux styles de formatage** : une partie de `apps/web` (Finder, Console, useFinder, Podium, ResultsView, messages, routes…) et `keyboards.ts` sont au format Prettier de l'éditeur (guillemets doubles), le reste suit Biome. Garder le style de chaque fichier, ne jamais lancer `biome check --write` sur un dossier entier.
* **Second serveur de dev** : si une autre session tient déjà le port 3000, lancer `cd apps/web && NETLIFY_DEV=1 pnpm exec vite dev --port 3001 --strictPort` ; sans `NETLIFY_DEV`, les deux émulations Netlify se disputent la base locale de `apps/web/.netlify/db`.
* **`fieldset` et débordement** : un `fieldset` ne coupe pas ce qui dépasse, même avec `overflow: auto` ; le défilement des tuiles est porté par un `div` autour.
* **Hauteur animée** : viser la hauteur du contenu plus les bordures du cadre, sinon il saute à la fin quand la hauteur repasse en `auto`.
* **Jamais de flushSync depuis un effet** : le magasin de dessins rend chaque SVG avec `flushSync` ; appelé depuis un effet React, il ne rend rien et le dessin manque pour la session. `pump()` et `dispose()` passent donc par une microtâche. Le commit `f54dc9b` n'a pas encore ce correctif : en production, 3 dessins sur 98 manquent et le preloader attend son délai maximal.
* **Image CDN en dev** : `/.netlify/images` n'existe qu'avec l'émulation Netlify (serveur sur le port 3000) ; avec `NETLIFY_DEV=1`, les photos repassent par l'URL de la boutique (Razer illisible). `netlify.toml` liste les hôtes autorisés : un nouvel hôte de photos doit y être ajouté.
* **Panneau masqué, pas d'images** : masqué, le panneau du navigateur ne dessine qu'à chaque capture ; le preloader et les animations ne s'y jugent pas.

## Limites connues et dette technique

La principale limite tient aux données : avec 25 produits fictifs par catégorie, le motif du canvas se répète vite et plusieurs étapes se sautent. Le reste est une dette assumée pour cette première version.

- **Données** : les écrans sont encore les 25 de démonstration ; environ 128 claviers n'ont pas de photo vue de dessus sur fond clair et gardent leur dessin sur le canvas.
- **Liste courte sur téléphone** : l'espace libre au-dessus de la console est trop petit pour regrouper les produits retenus ; les retenus restent alors serrés sur le canvas.
- **Canvas 2D** : à l'aise avec des centaines de produits depuis les dessins partagés (45 Mo en DPR 2) et le budget des photos (64 Mo au plus) ; WebGL n'est plus nécessaire à cette échelle.
- **Catalogue entier dans le HTML** : le loader envoie tout le snapshot au premier rendu, soit 724 Ko bruts (68 Ko en brotli) avec 523 claviers ; l'API en fait 909 Ko, dont 235 Ko de switchs recopiés dans chaque variante. Format compact à prévoir (switchs et marques en dictionnaire).
- **Poids du bundle** : un morceau partagé d'environ 120 Ko contient probablement Zod et le catalogue. Une entrée « moteur seul » sans Zod côté client l'allégerait, à mesurer.
- **Pas de prix boutiques** : la table `offers` est vide : la section « Où l'acheter » de la fiche produit n'affiche encore qu'un message d'attente.
- **Seuils de format** : « Grand format 42"+ » prend les écrans 16:9 dès 36". Les seuils sont à recaler sur les vraies données.
- **Accessibilité** : tuiles et canvas non audités (le canvas est masqué aux lecteurs d'écran ; les bandes sont de vrais liens focalisables), pas de test au clavier seul.
- **Podium rendu deux fois** : colonne sur grand écran, rangée sur mobile, l'une masquée en CSS.
- **Le seed supprime** ce que data/ ne liste plus, avec un garde-fou (SEED\_PRUNE=force au-delà de max(30, la moitié du catalogue)).
- **Ni tests d'interface ni CI.**
- **Prévu mais pas encore utilisé** : ScrollTrigger, three et React Three Fiber.

* **« À savoir » mal formulé** : la rubrique reprend le nom des critères où le produit est faible, ce qui donne des lignes qui se lisent comme des qualités (« Taille idéale pour l'e-sport »). Il faut un libellé négatif par critère.
* **Liste courte sur téléphone** : avec le module « Parcours », le dock est plus haut et l'indice « Glisse pour explorer » se masque faute de place.

## Prochaines étapes

Le premier commit est fait. La suite logique est la phase 5 (pages SEO) et les vraies données ; la phase 4 (nuage WebGL) devient facultative : la scène pourra passer en WebGL si le catalogue grossit.

- [x] **Premier commit** sur `main` : fait (`e4ca02a`).
- [ ] **Scène WebGL (si besoin)** : même rendu que `features/scene/renderer.ts` en shaders, si le catalogue dépasse quelques centaines de produits.
- [ ] **Phase 5, pages SEO** : fiche produit `/fr/claviers/<slug>` (héros annoté, fiche technique, JSON-LD), pages collections (« 75 % sans fil », « OLED 27" 240 Hz »), `sitemap.xml`, `robots.txt`, `noindex` des combinaisons, images OG, prérendu.
- [ ] **Vraies données** : claviers faits (523, photos détourées, voir « Vraies données et photos ») ; restent les vrais écrans, les prix boutiques (`offers`) et liens d'affiliation.
- [ ] **Offres et affiliation** : charger `offers` dans le snapshot, afficher les offres dans « Où l'acheter » de la fiche produit (liens `rel="sponsored"`, mention du programme d'affiliation Amazon), puis mesurer les clics.
- [ ] **Performance** : entrée moteur sans Zod côté client ; top produits rendu côté serveur, catalogue chargé ensuite.
- [ ] **Idées en attente** : spécimen 3D procédural (accueil, tuiles), sons et courbes de force des switchs, démo de fréquence et loupe PPI dans les tuiles, vue éclatée, thème sombre, analytics, back-office (interface interne ou Directus).

* [x] **Commiter et pousser** les retours du 21 octobre sur `main` (Netlify déploie `main`).
* [ ] **Reformuler « À savoir »** avec un libellé négatif par critère (`keyboards.ts`, `monitors.ts`).
* [ ] **Région des fonctions Netlify** sur eu-central-1, près de la base Neon, si l'offre le permet.
* [ ] **Branche Neon de développement** (`npx neon@latest checkout dev --create`) pour que `pnpm dev` et le seed ne touchent plus `production`.
* [ ] **Pousser les cinq correctifs** faits après `f54dc9b` (`scene/sprites.tsx` surtout, plus `renderer.ts`, `routes/$lang.tsx`, `routes/__root.tsx`, `catalog/src/media/drawing.ts`).
* [ ] **Voir en mouvement** la recomposition du canvas et le preloader, panneau du navigateur affiché, et régler si besoin.
* [ ] **`pnpm ingest photos`** : choisir à l'ingest la meilleure vue de dessus (+24 photos) et remplacer les vignettes Corsair `w_96`, puis reseed (production avec accord).
* [ ] **Netlify** : suivre les crédits de l'Image CDN ; corriger « Données de démonstration » sur l'accueil.
