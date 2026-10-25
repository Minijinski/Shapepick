# Handoff — choose-a-device

Oct 25, 2026 · @Eddy

## En bref

shapepick (choose-a-device jusqu'au 24 octobre) est un « finder » de claviers, d'écrans et de souris inspiré de [shapefinder.cc](https://shapefinder.cc/) : une suite de questions qui resserre le catalogue en direct, sans tableau ni filtres. Les phases 0 à 3 du plan sont terminées. Le 20 octobre 2026, le nuage de données a laissé place à une scène en canvas : un accueil en bandes inclinées qui s'ouvrent en canvas infini (voir « Scène : bandes et canvas »).

- **Ce qui marche** : accueil, parcours claviers (9 questions), écrans (8) et souris (10 depuis le 24 octobre au soir : sans taille de main, avec les boutons latéraux) dans l'ordre que le visiteur choisit, filtre par marque, résultats, fiche produit (depuis le canvas, le podium ou les résultats), liens Amazon.fr affiliés (Partenaires, depuis le 24 octobre au soir) dans la fiche et les résultats, en français et en anglais, avec rendu côté serveur (interface et mentions légales revues le 24 octobre au soir, voir « Retours du 24 octobre (soir) ») ; repensé pour les téléphones le 24 octobre (voir « Mobile (24 octobre) ») ; une fiche indexable par produit depuis le même jour (voir « SEO : fiches produit, nom et domaine ») ; clics Amazon enregistrés en base, mentions légales et confidentialité (voir « Audit et lot 1 (24 octobre) ») ; catalogue A–Z et 92 collections par langue (voir « Soir du 24 octobre »).
- **En ligne** : [shapepick.com](https://shapepick.com) depuis le 24 octobre 2026, sur Netlify, base Postgres sur Neon (Francfort). Le site tournait depuis le 20 octobre sur choose-a-device.netlify.app, qui redirige désormais vers le domaine.
- **Données** : 685 vrais claviers (61 marques), 264 vrais écrans (8 marques, voir « Écrans : vrais modèles ») et 467 vraies souris (41 marques, voir « Souris : troisième catégorie »), dont 293 souris et 140 claviers ajoutés le 25 octobre sans fiche officielle relue (voir « Catalogue agrandi et photos (25 octobre) ») ; 92 marques et 255 switchs. 1 304 produits sur 1 416 ont une photo (principale choisie par `pnpm ingest photos`) ; les autres gardent leur dessin.
- **Qualité** : 104 tests du moteur et des parcours, 46 de l'import (mappers écrans et souris, switchs, variantes), typecheck des 4 paquets et build au vert ; Biome propre sur les fichiers au style Biome (plusieurs fichiers sont au format Prettier, voir « Pièges »).
- **État du dépôt** : `main` sur origin s'arrête à ce handoff, poussé le 25 octobre sur 3bf7934 (voir « Suites de l'audit (25 octobre) » ; « Catalogue agrandi et photos » et « Favicon, police, ROG et image de partage » pour les autres sessions du jour) ; poussé et déployé le 24 octobre au soir : le catalogue ZOWIE, Corsair, ASUS ROG et Akko (fusion `a777214`, hôte des photos Akko `124c2e2`, seed de production après le push), l'interface et les mentions légales (`6fd52ff` à `646fb65`, voir « Retours du 24 octobre (soir) »), le contrôle photo assoupli (`df86d23`, puis `74e0bf7` : le LG Swing garde son dessin) et le top 3 toujours plein du Finder (`0589107`, autre session), les photos trouvées sur le web (voir « Photos remplacées depuis le web »), sur le Store ID Amazon Partenaires (`a2d631a`), sur les collections (`7af8928`), les boutons latéraux (`bdb8eb9`, migration `0006` puis seed de production passés sur Neon avant le push) et les switchs (`539fdaf`) ; voir « Soir du 24 octobre ». Dessous : la question « taille de main » retirée (`fac57c1`) et le lot 1 de l'audit (`959f780`, migration `0005` passée sur Neon avant le push ; voir « Audit et lot 1 (24 octobre) »). Avant, le même jour : les fiches produit indexables (`1e4d0bf`), le nom shapepick (`709e57e`) et la redirection de l'ancienne adresse limitée aux pages (`287a219`), sur le fondu de la console (`1dfc469`) et le socle SEO (`0b69127` : `robots.txt`, `sitemap.xml`, JSON-LD, cartes de partage, avec le compteur et la popup revus) ; avant encore, `19ed09a`, la fusion de feat/mobile (`b2d2cc0` à `44699c9`, voir « Mobile (24 octobre) ») sur `c15905f`, qui porte aussi les cinq tours de la session canvas de la nuit du 23 au 24 octobre (`1e87ffa` à `c15905f`), pas encore décrits ici. Le 23 octobre au soir : la fusion `184fc39` de feat/souris, avec la migration `0004` passée sur Neon avant le push et le seed après (voir « Souris : troisième catégorie ») ; plus tôt le 23 octobre, les vrais écrans (`ad9f146`) avec la migration `0003` et leur seed, les « Retours du 23 octobre (2) » (`06057fa`), les ASIN Amazon (`65c326b`) et la migration `0002`.

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
| Typographies | Hubot Sans (interface ; Inter Tight jusqu'au 25 octobre), Geist Mono (chiffres, unités, libellés) |
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
| `packages/catalog/src/finder/similar.ts` | Modèles proches d'un produit : ressemblance pondérée sur les questions qui décrivent l'appareil (likeness de chaque questionnaire) et prix proche, 2 par marque au plus |
| `packages/catalog/src/finder/keyboards.ts`, `monitors.ts` | Les deux questionnaires : étapes, options, critères, profils |
| `packages/catalog/src/finder/mice.ts`, `mouse-fit.ts` | Le questionnaire souris et son modèle de prise : taille de main, prise, conseil de taille |
| `packages/ingest/` | Import des catalogues (`pnpm ingest <source>`) : un adaptateur par site (`src/sources/`, `sources/monitors/`, `sources/mice/`), mappers testés (`mapping.ts`, `monitor-specs.ts`, `mouse-specs.ts`), fiches de relecture, photos et prix |
| `packages/catalog/src/registry.ts` | Slugs localisés (`claviers` ↔ `keyboards`) et questionnaire par catégorie |
| `packages/catalog/src/node/load-data.ts` | Lecture et validation des YAML, Node uniquement |
| `packages/catalog/test/` | 28 tests Vitest |
| `packages/db/src/schema.ts`, `packages/db/drizzle/` | Tables Drizzle et première migration |
| `packages/db/src/seed.ts`, `snapshot.ts` | YAML vers Postgres, puis Postgres vers items |
| `apps/web/src/routes/` | Redirection de langue, accueil, parcours, API JSON |
| `apps/web/src/site.ts`, `seo.ts`, `server.ts` | Nom et adresse du site (SITE : un seul endroit pour renommer), balises et JSON-LD de chaque page, point d'entrée serveur (301 de l'ancienne adresse vers le domaine) |
| `apps/web/src/server/` | Server function `getCatalog` et accès à la base, côté serveur seulement |
| `apps/web/src/features/finder/` | État du parcours (`useFinder`) et ses composants : console, podium, résultats, fiche produit en tiroir |
| `apps/web/src/features/scene/` | Scène partagée accueil ↔ canvas : géométrie des bandes et du motif (`geometry.ts`), rendu (`renderer.ts`), pont routes ↔ scène (`controller.ts`), navigation chorégraphiée (`navigation.ts`), sprites des silhouettes, popup produit |
| `apps/web/src/features/product/` | Silhouettes SVG générées depuis les specs, specs clés formatées, héros annoté et jauge de compatibilité partagés par les résultats et la fiche produit |
| `apps/web/src/features/motion/` | Enregistrement de GSAP, durées et courbes communes |
| `apps/web/src/i18n/` | Textes d'interface FR/EN, langue de la page |
| `apps/web/panda.config.ts` | Tokens « Labo clair », recettes `button`, `chip`, `optionTile` |
| `data/` | Marques, switchs, claviers, écrans et souris en YAML (un fichier par marque), prix conseillés (msrp.yaml), exclusions (excluded.yaml) |
| `scripts/pg-local.sh`, `infra/`, `.claude/launch.json` | Postgres local, Docker Compose, serveur de prévisualisation de l'app |

## Base de données et données de démo

La base compte 11 tables et 32 enums Postgres. Tout ce qui sert à filtrer ou classer est une colonne typée ; le reste ira dans une colonne `extra` en jsonb. Les valeurs des enums viennent des mêmes tableaux que les schémas Zod (`packages/catalog/src/domain/enums.ts`).

| Table | Contenu | À noter |
| --- | --- | --- |
| `brands` | Slug, nom, pays, site | Référencées par slug dans les YAML |
| `products` | Slug unique, catégorie, marque, prix conseillé (€, $), statut, `popularity` et `editorial_score` (0 à 1) | Index sur catégorie + statut |
| `product_translations` | Accroche, description, titre et description SEO par langue | Clé : produit + langue |
| `product_variants` | Couleur, famille de couleur, disposition (`iso_fr`, `ansi_us`…), switch, prix | Un produit correspond si une de ses variantes correspond |
| `switches` | Ressenti, silencieux, techno, forces (g), courses (mm), lubrification, son | Référentiel partagé entre claviers |
| `keyboard_specs` | 34 colonnes : format, techno, hot-swap, connexions, polling, rapid trigger, matériaux, firmware, mesures | Une ligne par clavier |
| `monitor_specs` | 38 colonnes : diagonale, ratio, définition, dalle, fréquence, HDR, connectique, pied (dont height\_adjustable, migration 0003) | `ppi` calculé par Postgres (colonne générée) |
| `mouse_specs` | 31 colonnes : forme, main, segment, longueur, largeur, hauteur, poids, position de la boule, boutons, capteur, DPI, fréquence, switchs, liaisons, hôtes, autonomie, alimentation, molettes, RGB, plage de main et prises conseillées par la marque | Migrations 0004 et 0006 (boutons latéraux, 24 octobre) ; mesures obligatoires sauf pour un trackball |
| `product_images` | URL, type de visuel, dimensions, couleur dominante | 1 353 vues de dessus des claviers et 1 435 vues de face des écrans ; le site lit la principale |
| `offers` | Boutique, pays, URL, prix, stock, date | Vide : prévu pour les prix et l'affiliation |
| `outbound_clicks` | Clics sur un lien Amazon : produit (slug), catégorie, emplacement, type de lien (fiche ou recherche), langue, page, pays, appareil, date | Migration 0005 (24 octobre) ; écrite par /api/out ; ni IP ni cookie ; une ligne de test à ignorer (page /test-mise-en-ligne) |

- **Seed** (`pnpm db:seed`) : lit `data/`, valide chaque fichier avec Zod (l'erreur cite le fichier et le slug), fait un upsert par slug, puis remplace traductions, variantes et specs. Relancé deux fois sans écart. Il ne supprime pas un produit retiré des YAML.
- **Snapshot** (`loadSnapshot`) : relit la base, repasse par les mêmes schémas Zod et rend la liste d'items du moteur. Vérifié identique au YAML : 25/25 claviers, 25/25 écrans. Sa version (`<nombre>-<dernière mise à jour>`) sert d'ETag.
- **Données de démo** : 9 marques inventées (Northkey, Atelier Clavier, Pulse Dynamics, Hexa Works, Kestrel, Lumen Display, Vanta, Prism, Halcyon), 16 switchs, 25 claviers et 25 écrans aux specs plausibles. Un fichier YAML peut contenir un ou plusieurs produits.

## Moteur de parcours

Le moteur (`packages/catalog/src/finder/engine.ts`) est un ensemble de fonctions pures : il ne lit que le catalogue et les réponses de l'URL, sans état caché. Le même code calcule la première page sur le serveur, puis chaque réponse dans le navigateur.

Les réponses restent des chaînes, telles que l'URL les porte : `size=f75,f65` (plusieurs choix), `budget=0-150` (plage), `budget=200-` (sans plafond), `any` (peu importe). Chaque étape a un type : `single` (un choix), `multi` (OU), `musts` (ET) ou `range` (plage). Quatre options modifient son comportement : `weightOnly` (ne filtre jamais, choisit le profil de classement), `required` (pas de « Peu importe »), `applies` (étape conditionnelle) et `aside` (jamais posée comme question : les marques, voir ci-dessous).

Les marques sont une étape « à part » construite depuis le catalogue (`withBrands`, `packages/catalog/src/finder/brands.ts`) : `brand=keychron,logitech` dans l'URL, toutes les marques en son absence. Elle filtre, compte et peut bloquer une tuile comme toute réponse, compte comme réponse antérieure pour chaque question (`priorAnswers`), mais n'entre ni dans la progression, ni dans le parcours, ni dans l'ordre (`order=`), ni dans le % (`met`, `isInformed`).

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

Le classement mêle l'adéquation au profil et un a priori (note éditoriale e et popularité p). L'adéquation est une moyenne géométrique pondérée des critères du profil, plancher 0,05 : un critère catastrophique fait chuter tout le score au lieu d'être noyé dans la moyenne. Un critère peut dire qu'une fiche ne donne pas sa valeur (`known`) : elle compte alors comme la médiane de ses pairs qui la donnent (`peers` : Bluetooth avec Bluetooth, même format pour le poids…) et n'est jamais citée en point fort ou faible. Depuis le 25 octobre, l'a priori est centré sur 0,5 et déplace le fit de 2 points au plus, dans un sens ou dans l'autre (`PRIOR_REACH`) : e et p valent 0,5 partout, donc le fit est aujourd'hui l'adéquation seule. À score strictement égal : le moins cher d'abord, puis le plus récent, puis celui qui a un lien Amazon direct (`settleTies`, `finder/settle.ts`), puis le slug, jamais l'ordre alphabétique des marques ; à % affiché égal, les marques passent ensuite à tour de rôle (`maker`). Depuis le 21 octobre, le % affiché ajoute les réponses : chaque réponse qui filtre (n) est un critère que tout produit classé respecte, donc le % part de l'adéquation et monte à chaque réponse, sans changer l'ordre. Un modèle qui coche tous les critères de l'usage affiche 100 %.

```latex
\text{fit} = \min\left(1,\ \exp\left(\frac{\sum_k w_k \ln \max(0{,}05,\ s_k)}{\sum_k w_k}\right) + 0{,}02 \cdot (2\,\pi - 1)\right) \qquad \pi = 0{,}6\,e + 0{,}4\,p \qquad \text{score} = \frac{3\,\text{fit} + n}{3 + n}
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
| 2 | Quelle taille ? | 24", 27", 32", Ultra-large 34", Ultra-large 38"+, Super-ultra-large, Grand format 37"+ | Multi, obligatoire |
| 3 | Quel budget ? | De 0 à 1 600 € par pas de 25 € ; tout en haut, sans limite | Plage |
| 4 | Quelle netteté ? | 1080p, 1440p, 4K, 5K et plus, lus sur la hauteur de l'image (1920 × 1200 et 2560 × 1080 sont des 1080p) | Multi |
| 5 | Quelle dalle ? | IPS, VA, OLED, Mini-LED, TN (masquée tant qu'aucun écran du catalogue n'en a) | Multi |
| 6 | Quelle fluidité ? | 60, 100, 144, 240, 360, 480 Hz « et plus » | Choix unique, lu comme un minimum |
| 7 | Plat ou incurvé ? | Plat, Incurvé | Choix unique |
| 8 | Des indispensables ? | USB-C 65 W+, KVM, HDR véritable, HDMI 2.1, Pied réglable, Rotation portrait, Fixation VESA, Haut-parleurs, Brillant, Calibré usine | ET |

### Profils de classement

La première réponse choisit les poids des critères ; sans réponse, un profil par défaut s'applique.

| Profil | Critères et poids |
| --- | --- |
| Clavier, jeu compétitif | Réactivité 3, rapid trigger 3, polling 2, compacité 2, construction 1 |
| Clavier, jeu polyvalent | Réactivité 2, RGB 1,5, construction 1,5, compacité 1, sans fil 1, polling 1 |
| Clavier, bureau & frappe | Silence 3, multi-appareils 2, toutes les touches 2, confort 2 (sans construction depuis le 25 octobre) |
| Clavier, code | Programmable 3, confort 2, construction 2, silence 1 |
| Clavier, nomade | Légèreté 3, compacité 2, multi-appareils 2, autonomie 2, sans fil 1 |
| Écran, FPS compétitif | Fréquence 3, temps de réponse 3, taille e-sport 2, contraste 0,5 |
| Écran, jeu immersif | Contraste 3, HDR 2,5, immersion 2, fréquence 1 |
| Écran, console | Compatibilité console 3, HDR 2, contraste 1,5, fréquence 1 |
| Écran, création | Couleurs 3, netteté 2,5, ergonomie 1, marquage OLED 0,5 (cité seulement comme point faible), sans contraste depuis le 25 octobre |
| Écran, bureau & code | Netteté 2,5, ergonomie 2, connectique 2, espace de travail 1,5, marquage OLED 1 (cité seulement comme point faible) |
| Écran, polyvalent | Fréquence 1,5, contraste 1,5, netteté 1,5, HDR 1, ergonomie 1 |

## Interface et animations

Chaque catégorie tient sur un seul écran : compteur et rail en haut à gauche, canvas infini des produits derrière, podium à droite, console des questions en bas. En fin de parcours, la console laisse la place aux résultats.

&#91;embedded content: maquette de la scène · écran de bureau\]

Le bleu tient ici la place de l'orange du site : n°1 du podium et option survolée. Sur téléphone, le bandeau n°1 prend la place du podium au-dessus de la console, qui devient un panneau du bas (voir « Mobile (24 octobre) »).

Cette maquette date d'avant le 20 octobre 2026 : le nuage de points au centre a depuis laissé place au canvas des produits.

| Élément | Ce qu'il montre | Animation |
| --- | --- | --- |
| Compteur (`LiveCounter`) | Produits restants « 0 025 sur 25 », aperçu orange au survol (« → 6 si choisi ») | Les chiffres défilent (0,9 s) |
| Rail (`AnswerRail`) | Les réponses données, en puces reliées ; un clic rouvre l'étape | La nouvelle puce glisse en place |
| Canvas (`Scene`) | Les produits de la catégorie en motif répété à l'infini, rang 01-03 du podium, popup de specs au survol, fiche produit au clic | Dérive en diagonale, drag avec inertie, molette ; une réponse retire les écartés et resserre les retenus, en vague depuis la console ; une liste courte se regroupe devant le canvas |
| Console (`Console`) | Hauteur de sa question, animée d'une question à l'autre, bord bas fixe ; titre, aide dans une bulle au-dessus de la console (ⓘ devient ✕), tuiles en rangées égales avec une indication de deux lignes au plus, compteur et coche, impasse « Bloqué par … » + « Changer → », « Peu importe » qui devient « Continuer » au premier choix | Se relève en 3D à l'arrivée depuis l'accueil ; titre lettre par lettre (SplitText), tuiles en cascade, rejoués seulement quand la question change ; sortie jouée avant la navigation |
| Podium (`Podium`) | Top 5 : trois cartes (silhouette, % de compatibilité, prix), puis les n°4 et 5 en lignes compactes si la hauteur le permet ; « Voir tout » ouvre le classement complet ; un clic ouvre la fiche | Les cartes changent de place (Flip) |
| Résultats (`ResultsView`) | Du header à la barre d'étapes ; total, marques et réponses sous le titre ; n°1 en carte produit (la photo ouvre la fiche ; prix et compatibilité, puis « Voir sur Amazon » et « Voir la fiche » ; 4 specs), détail du %, points forts et « à savoir », n°2 et n°3 (pastille Amazon), liste des autres (flèche Amazon par ligne) ; chaque produit ouvre sa fiche, « Modifier mes réponses » revient à l'étape quittée | Le panneau de la console s'étire jusqu'aux résultats ; specs et lignes en fondu ; compteur et réponses du haut s'effacent |
| Fiche produit (`ProductDrawer`) | Rang, ou « Écarté par … » ; prix indicatif et compatibilité alignés (KeyFigures), détail du % ; photo et 4 specs, points forts, « à savoir », fiche technique, « Voir sur Amazon » sur la ligne du prix, repris dans une barre collante une fois cette ligne passée (écrans : « Où l'acheter », offres à venir) ; précédent / suivant dans le classement ; « Modèles proches » (4 cartes) en fin de fiche ; une adresse par fiche (/fr/claviers/<slug>), rendue côté serveur | Glisse depuis la droite (sur téléphone, feuille du bas qu'on ferme en la tirant vers le bas) ; Échap, fond ou croix pour fermer ; la barre d'achat glisse du bas ; le bouton Retour du navigateur la replie aussi |
| Budget (`BudgetControl`) | Histogramme des prix de ce que les autres réponses laissent, bande de la plage, double curseur portant ses prix (fusionnés quand ils se touchent), échelle de prix ; tout en haut signifie sans plafond | Les barres montent en vague à l'entrée et passent à l'encre au fil du curseur ; les prix défilent ; le curseur saisi grossit, avec un halo |
| Silhouettes (`glyphs.tsx`) | Claviers dessinés selon format et couleur, écrans à l'échelle selon ratio, diagonale, courbure et dalle | Aucune |
| Accueil | Accroche « Arrêter de chercher. Commencer à choisir. » sur une bande inclinée par catégorie (sur téléphone, des bandes droites empilées sous le titre, dans une page qui défile) | Bandes qui défilent ; au survol, nom et compteur de la catégorie sur une plaque floutée qui penche avec la bande ; au clic, la bande s'étend en masque par-dessus les autres et zoome jusqu'au canvas |

- **Mobile** (moins de 768 px de large) : accueil en bandes droites dans une page qui défile, réponses en liste pleine largeur, pastille « 04/10 · Parcours » qui ouvre une feuille à la place de la barre d'étapes, bandeau n°1 au-dessus de la console, résultats et fiche en pleine hauteur. Détail dans « Mobile (24 octobre) ».
- **Mouvement réduit** : chaque animation teste `prefersReducedMotion()` et pose directement l'état final.
- **Onglet masqué** : le navigateur suspend les animations, donc la sortie de la console a une minuterie de secours. La navigation ne dépend jamais d'une animation.
- **Style** : tout passe par les tokens et recettes Panda ; seuls le canvas et les silhouettes ont des couleurs en dur.

## Scène : bandes et canvas

Depuis le 20 octobre 2026, l'accueil et les pages catégorie partagent une seule scène, un `<canvas>` 2D monté dans le layout `/$lang`. Comme c'est le même dessin des deux côtés, passer de l'un à l'autre n'est qu'une interpolation : rien n'est démonté, donc rien ne clignote.

- **Accueil** : une bande inclinée par catégorie (donc 2 aujourd'hui ; une catégorie ajoutée ajoute sa bande). Chaque bande est une fenêtre sur le « monde » de sa catégorie, qui dérive le long de la bande. Les bandes sont aussi de vrais liens posés par-dessus avec la même forme (`clip-path`), d'où survol, focus, clic du milieu et SEO. Au survol, la bande zoome, les autres se voilent et le nom de la catégorie apparaît sur une plaque floutée. Cette étiquette est posée à côté du lien, donc jamais coupée par sa découpe ; elle penche avec le bord gauche de sa bande et prend la largeur que la bande lui laisse, si bien qu'elle y tient quel que soit le nombre de catégories. Sur téléphone, les bandes sont droites, empilées sous le titre, et la page défile (voir « Mobile (24 octobre) »).
- **Ouverture** : au clic, la bande s'étend en masque par-dessus les autres (ombre portée pendant le mouvement) tandis que son monde zoome autour du point cliqué (1,25 s, `expo.inOut`). La page sort, la route change à mi-course, puis la console du parcours se relève en 3D quand la scène se pose. Le retour (logo, retour du navigateur) replie la bande dans son emplacement.
- **Canvas** : motif répété à l'infini (le catalogue y est posé plusieurs fois, mélangé, pour espacer les répétitions), dérive en diagonale du coin haut droit vers le bas gauche, drag avec inertie, molette. Survoler un produit arrête la dérive et ouvre une fiche (rang, compatibilité, specs) reliée au produit par un trait de rappel. Un clic (ou un tap) ouvre la fiche produit complète ; le curseur devient une main au survol d'un produit.
- **Filtres** : depuis le 22 octobre, le canvas ne montre que les produits retenus. Un produit écarté s'efface, les retenus glissent vers leur place dans un motif recomposé sans trous, le tout en vague depuis la console. Survoler une option entoure en orange les produits qu'elle garde.
- **Liste courte** : dès qu'il reste au plus 12 produits retenus et qu'ils tiennent dans l'espace libre (entre le compteur, le podium et la console, mesuré par `Finder` et transmis par `scene.setStage`), ils quittent le canvas et se regroupent en grille devant lui, chacun une seule fois, avec leur rang. Leurs copies sur le canvas s'effacent ; elles reviennent quand la liste s'allonge. La grille se centre sur l'axe de la console quand elle y tient (sinon sur tout l'espace libre) ; derrière elle, le canvas n'a plus que son papier pointillé.
- **Changement de catégorie** (header, depuis un canvas) : le canvas reste en place, les anciens produits se dissolvent et les nouveaux apparaissent en vague depuis le lien cliqué. La console ne bouge pas : seule sa question change. Chaque catégorie mémorise son parcours dans le stockage du navigateur (`choose-a-device:journey:<catégorie>`) et le reprend au retour ; « Recommencer » le remet à zéro.
- **Console** : même hauteur à toutes les étapes. Les tuiles se partagent l'espace (au-delà de deux rangées la grille défile ; une question qui tient sur une rangée, 5 tuiles au plus sur grand écran, garde des tuiles de hauteur normale), le budget remplit l'espace avec l'histogramme des prix, l'aide s'ouvre dans une bulle au-dessus de la console. La coche d'une tuile choisie déborde dans une marge intérieure de la grille : elle n'est jamais rognée.

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

## Retours du 22 octobre (soir)

Sept retours : des claviers encore en dessin (canvas, accueil, fiche), un filtre par marque, la pertinence du classement (trop de Keychron), la liste « Voir les N résultats » lente, des images floues et du texte impossible à copier, la pastille « 1 » répétée sur le canvas, les traits de rappel devenus inutiles. Fait dans le dossier local, vérifié sur une base locale (port 3001), pas encore poussé ni semé en production.

| Mesure | Avant | Après |
| --- | --- | --- |
| Claviers avec une vraie vue de dessus sur le canvas | 366 sur 523 (70 %) | 479 (92 %) ; 19 autres ont une photo détourée de biais et 22 une photo non détourable, montrées dans la fiche ; 1 sans photo |
| Part de Keychron (+ Lemokey) dans le top 10, usage « Nomade » | 10 sur 10 | 3 sur 10 (7 marques) |
| Idem, « Bureau & frappe » / « Bureau + TKL » | 8 / 8 sur 10 | 5 / 6 sur 10 |
| Idem, « Jeu compétitif » / « Jeu polyvalent » | 4 / 8 sur 10 | 3 / 7 sur 10 |
| Ouvrir les 523 résultats | 520 lignes rendues, chacune télécharge et détoure sa photo | \~25 lignes rendues, aucune tâche longue |
| Photo Corsair (Vanguard Air 99…) | vignette de 96 px agrandie | demandée à la largeur affichée |

| Retour | Ce qui a changé | Où |
| --- | --- | --- |
| Des claviers restent en dessin | Détourage : le câble USB qui dépasse est rogné ; une forme posée au-dessus ou en dessous du clavier (couvercle, repose-poignets à part, keycaps) n'est plus prise pour la moitié d'un split ; on mesure le détail (touches) sur une grille fixe. Contrôle « vue de dessus » : un clavier qui remplit presque tout son cadre passe avec son repose-poignets (proportions 0,5–1,35), une photo sans détail (dessous d'un boîtier) ou faite de 3 formes et plus est refusée. `pnpm ingest photos` juge toutes les images de chaque clavier (celles de `data/`, puis la galerie Shopify du cache) avec ce même code et met la meilleure vue de dessus en photo principale ; `photos:` dans `data/excluded.yaml` liste les sosies écartés à la revue (collage, bannière, schéma) et les claviers à laisser tels quels. Fiche, podium et résultats montrent la photo non détourée quand le détourage échoue, au lieu du dessin | `catalog/src/media/`, `ingest/src/photos.ts`, `product/ProductPicture.tsx`, `data/` |
| Affiner par marque | Pastille « Marques · Toutes » à côté du compteur : liste de A à Z avec recherche, nombre de produits par marque selon les autres réponses, cases à décocher, « Seulement », « Tout afficher », bouton × ; chaque changement s'applique tout de suite (URL remplacée, question et brouillon gardés). Survoler une marque entoure ses produits sur le canvas. « Bloqué par Marques · Changer → » ouvre la liste | `finder/BrandFilter.tsx`, `useFinder.ts`, `LiveCounter.tsx`, `catalog/src/finder/brands.ts`, `engine.ts` |
| Trop de Keychron | Audit sur les vraies données : Keychron fait 33 % du catalogue (35 % avec Lemokey) mais 80 à 100 % du top 10 de 4 usages sur 5. Causes : les fiches incomplètes des autres marques notées comme le pire cas (Bluetooth sans nombre d'appareils = 1, batterie et poids inconnus), le polling Corsair lu « 8 Hz » au lieu de 8 000, les dizaines de variantes Keychron à égalité. Correctifs : valeurs manquantes à la médiane des pairs, marques à tour de rôle à % égal, parseur `hzOf` corrigé (`8,000Hz`) et 18 valeurs Corsair. Reste « Code » (10 sur 10) : le profil donne beaucoup au confort, qui récompense les dispositions Alice, et Keychron est presque seul à en vendre en QMK | `engine.ts`, `keyboards.ts`, `ingest/src/mapping.ts`, `data/keyboards/corsair.yaml` |
| « Voir les N résultats » met des secondes | La liste n'était pas virtualisée. Désormais seules les lignes à l'écran (+8 de chaque côté) sont rendues, toutes de 56 px, placées depuis la mise en page (`offsetTop`, pas l'écran : le panneau s'ouvre incliné en 3D) | `finder/ResultsView.tsx` |
| Images floues, texte non copiable | Les URL Cloudinary de Corsair (`w_96`) sont demandées à la largeur affichée, au vol et en 2 000 px dans `data/`. La fiche produit et le meilleur résultat se sélectionnent (`user-select: text`) ; les cartes et lignes cliquables restent des boutons | `product/photo.ts`, `ProductDrawer.tsx`, `ResultsView.tsx` |
| La pastille « 1 » suit le produit partout | Un produit seul n'a plus de rang sur le canvas | `scene/renderer.ts` |
| Traits de rappel et points numérotés | Supprimés : `ProductHero` (la photo, puis ses 4 specs clés en grille) remplace `AnnotatedHero` dans la fiche et les résultats | `product/ProductHero.tsx` |

- Vérifié dans le navigateur sur la base locale (`web-local-db`, port 3001, `NETLIFY_DEV=1`) : sur ce serveur sans Image CDN, les photos Razer sont bloquées par le CORS (en production elles passent par `/.netlify/images`).
- Les photos principales choisies et le polling Corsair sont dans `data/` : il faut un seed pour que le site les voie. La réécriture des URL Corsair, elle, marche dès le déploiement.
- Restent en dessin sur le canvas : 22 claviers sans photo détourable (SteelSeries et Vortex photographiés en scène ou sur fond noir, Varmilo Sword 2 108…) et 19 sans vue de dessus (Womier, Wobkey Rainy 75, Chilkey Foxy 65…). Leur fiche montre la photo.

## Retours du 23 octobre

Six retours sur l'interface, faits et vérifiés le 23 octobre dans Chrome headless (captures en haute définition, mesures) sur la base locale. Ils sont dans `97439b1` « adding amazon links », poussé et déployé avec le lien Amazon d'une autre session.

| Mesure | Avant | Après |
| --- | --- | --- |
| Hauteur de la console, question à une rangée (1440 × 900) | ≈ 305 px, explication comprise | 250 px |
| Centre de « Glisse pour explorer » pendant son entrée depuis l'accueil | Décalé d'une demi-largeur (≈ 157 px) à droite, puis saut au centre | 720 px sur les 166 images de l'entrée : centre exact |
| Titre et tuiles rejoués par un changement de marque | À chaque changement | Aucun (2 changements mesurés) |

| Retour | Ce qui a changé | Où |
| --- | --- | --- |
| « Seulement » chevauche le nombre et ne se clique plus quand on survole le nombre | « Seulement » a sa colonne entre le nom et le nombre, qui reste visible. Avant, le nombre masqué (opacité 0) restait par-dessus le bouton et prenait le clic. Toujours affiché sur écran tactile | `finder/BrandFilter.tsx` |
| « Glisse pour explorer » arrive décalé à droite puis se recentre | L'animation `fadeUp` écrasait le `translateX(-50%)` qui centrait le texte ; il est centré par ses marges (`insetInline: 0`, `mx: auto`, `w: fit-content`) | `finder/Finder.tsx` |
| Changer de marque rejoue l'apparition du texte de la console | L'entrée (titre lettre par lettre, tuiles en cascade) suit la question et sa réponse validée, plus toutes les réponses : une marque ne change que les compteurs. Les indispensables qu'une marque fait apparaître entrent seuls | `finder/Console.tsx` |
| Enlever l'explication sous le titre, détailler les tuiles sans surcharger | L'explication reste derrière le bouton ⓘ, toujours affiché, et en `aria-describedby` pour les lecteurs d'écran. Indications des tuiles réécrites en FR et EN : deux lignes au plus (`lineClamp: 2`), une seule à côté d'un dessin ou d'une pastille | `finder/Console.tsx`, recette `optionTile`, `catalog/src/finder/keyboards.ts`, `monitors.ts` |
| Fiche produit : aligner la compatibilité sur le nom ou le prix | `KeyFigures` : « Prix indicatif » et « Compatibilité » en paire, libellés sur une ligne, valeurs sur la suivante (mono 2xl, petit anneau `MatchRing`) | `product/KeyFigures.tsx`, `product/Match.tsx`, `finder/ProductDrawer.tsx` |
| N° 1 de « Tes meilleurs choix » : bouton, prix et compatibilité mal agencés | Carte produit en deux colonnes : la photo sur papier pointillé ouvre la fiche ; à côté, rang, nom, `KeyFigures` avec « Voir la fiche → » sur la ligne des valeurs, `KeySpecs` en 2 × 2. Plus basse, elle laisse voir les n° 2 et 3 plus tôt. Sur téléphone, l'en-tête passe sur deux lignes au lieu de couper « Modifier mes réponses » | `finder/ResultsView.tsx`, `product/ProductHero.tsx` |

- Vérifié : typecheck des 4 paquets, 44 tests, build, Biome et Prettier sur les fichiers touchés ; captures à 1440, 1024 et 390 px de large.
- Les animations ont été mesurées en temps réel dans Chrome headless, pas encore regardées à l'œil.

## Retours du 23 octobre (2)

Cinq retours sur l'interface, faits et vérifiés le 23 octobre dans Chrome headless sur la base locale (`web-local-db-3`, port 3003). Poussés sur origin (06057fa).

| Mesure | Avant | Après |
| --- | --- | --- |
| Console sur « Quel type de touches ? » après Usage, Taille et Disposition (1280 × 720) | ≈ 360 px, une rangée vide | 250 px, une rangée |
| Panneau des résultats, 1280 × 720 | 430 px | 566 px |
| Panneau des résultats, 390 × 844 | ≈ 523 px | 702 px |

| Retour | Ce qui a changé | Où |
| --- | --- | --- |
| Le lien Amazon n'est qu'en bas de la fiche | `AmazonLink` (bouton, pastille ou flèche ; claviers seulement) : « Voir sur Amazon ↗ » sur la ligne du prix de la fiche, repris dans une barre collante une fois cette ligne passée ; la section « Où l'acheter » ne reste que pour les écrans. Résultats : bouton sur le n° 1 avec « Voir la fiche », pastille sur les n° 2 et 3, flèche au bout de chaque ligne, sans ouvrir la fiche | `product/AmazonLink.tsx`, `finder/ProductDrawer.tsx`, `finder/ResultsView.tsx`, `product/KeyFigures.tsx` |
| Les résultats sont trop petits sur un écran moyen | Plein cadre : compteur, marques et réponses s'effacent vers le haut (inertes) et le panneau monte jusque sous le header. Sous le titre, une rangée reprend le total, le filtre Marques et les puces des réponses ; sur téléphone, « Modifier » et ⟲ tiennent sur la ligne du titre. Ce bloc et le podium s'effacent par un cadre intérieur : des résultats ouverts par un lien ne les montrent plus pendant l'entrée | `finder/Finder.tsx`, `finder/ResultsView.tsx` |
| Console trop haute pour une rangée de tuiles | Bug : la tuile « Peu importe », sans `key`, passait d'une question à l'autre avec l'`opacity: 0` de la sortie. Les tuiles sont recréées à chaque question et leur entrée va explicitement à `opacity: 1`. « Peu importe » quitte la grille : bouton du pied en pointillés, qui devient « Continuer » au premier choix. Grille équilibrée (6 tuiles en 2 × 3, jamais une tuile seule), sans barre de défilement pendant l'entrée | `finder/Console.tsx`, recette `button` (ton `dashed`) |
| L'aide ⓘ défile et « Compris » alourdit | Bulle `popover` au-dessus de la console, à la taille de son texte, pointe sur le ⓘ devenu ✕ ; Échap, un clic ailleurs, une tuile ou une autre question la referment. Les termes sont balisés `**Terme** :` dans les textes d'aide (Touches, Ressenti, Hauteur, Connexion, Couleur ; Dalle pour les écrans) et rendus en liste à deux colonnes | `finder/HelpBubble.tsx`, `styles.css`, `catalog/src/finder/` |
| Le module de prix manque de vie | Les barres montent en vague, une bande marque la plage, les prix suivent les curseurs en défilant (fusionnés quand ils se touchent), une échelle court sous le rail ; le curseur saisi grossit avec un halo et le rail s'épaissit | `finder/BudgetControl.tsx`, `finder/Console.tsx` |

- Sous 1 024 px, la bulle « Pas d'ordre imposé » de la barre d'étapes couvrait le pied de la console : le premier contact avec la console la referme.
- Vérifié : typecheck des 4 paquets, 44 tests, build, Biome et Prettier sur les fichiers touchés ; parcours mesurés et captures en Chrome headless à 1280 × 720, 1440 × 900 et 390 × 844, en français et en anglais, écrans compris, et en mouvement réduit.

## Écrans : vrais modèles (23 octobre)

Le catalogue d'écrans compte 264 vrais modèles de 8 marques, les 50 plus pertinents de chacune dans l'ordre de la marque, importés par `pnpm ingest <marque>` depuis les pages et API officielles ; la démo est retirée. Les photos restent sur les CDN des marques et passent par Netlify Image CDN. Poussés et déployés (ad9f146), migration 0003 et seed passés sur Neon le 23 octobre : en ligne.

| Marque | Écrans | Source | Prix | Pertinence |
| --- | --- | --- | --- | --- |
| Samsung | 30 | samsung.com/fr : sitemap, JSON-LD, fiche pdd32 | Boutique Samsung | Tous ceux en vente |
| LG | 42 | lg.com/fr : sitemap, données Next.js | Boutique LG | Tous ceux de 2023 et après, en vente |
| Dell (+ Alienware) | 50 | dell.com/fr-fr : pages de liste, tableau .spec\_\_item | Boutique Dell | Ordre de la liste Dell |
| MSI | 50 | fr-store.msi.com (msi.com bloque les robots) | Boutique MSI | Meilleures ventes, puis avis, puis nouveautés |
| AOC (+ AGON) | 50 | aoc.com/fr : ItemList, données Next.js | Médiane des revendeurs affichés par AOC | Listes jeu et bureau alternées |
| ASUS (+ ROG) | 18 sur 50 | odinapi.asus.com (liste, fiches), rog.asus.com | ASUS eStore pour les ROG, sinon prix conseillé cité par la presse ; 32 attendent | Ordre « Recommandé » d'ASUS |
| BenQ (+ MOBIUZ, ZOWIE) | 17 sur 50 | benq.eu/fr-fr : pages spec.html, page d'achat | Prix standard caché de la page, sinon prix conseillé cité par la presse ; 33 attendent | Gammes en alternance |
| Philips (+ Evnia) | 7 sur 50 | philips.fr : données Next.js, API summary | Prix conseillé cité par la presse ; 43 attendent | Ordre « pertinence » de la liste |

Acer et Gigabyte bloquent les robots (connexion coupée, Akamai 403) : rien n'est contourné. L'agent utilisateur est honnête, robots.txt respecté, 2 à 4 s entre deux requêtes par hôte (`packages/ingest/src/http.ts`).

### Prix

La boutique officielle quand la marque vend en direct, sinon la médiane des revendeurs que la page officielle affiche, sinon le prix conseillé d'un communiqué officiel dans `data/msrp.yaml` (`slug: { eur, source }`). Sans aucun des trois, le modèle attend (« sans prix » dans la fiche de relecture) et revient au passage suivant. Les liens revendeurs d'AOC portent ses propres codes d'affiliation : seul le prix est gardé.

- **Prix conseillés (choix du 23 octobre)** : ceux que cite la presse tech (Prad, ComputerBase, Hardwareluxx, PC Games Hardware, Notebookcheck, Guru3D, TFTCentral, Cowcotland) ou un communiqué, l'URL gardée dans `data/msrp.yaml`, seulement s'ils datent de 2023 ou après. 29 trouvés sur 133 : ASUS 8, BenQ 14, Philips 7. Les Numériques, 01net et Tweakers refusent les robots de recherche : non utilisés.
- **104 écrans attendent toujours** : ASUS ne publie aucun prix en euros pour ses TUF Gaming, VY, VB et la plupart des VA, Philips pas davantage pour une bonne partie de sa gamme B ; la presse ne cite que des prix de rue. Onze prix de lancement d'avant 2023 sont écartés (BenQ PD2700Q, PD2500Q, GW2480, XL2411K, EX2710S, SW271C, XL2566K ; Philips 242B1TC, 222B1TC, 27M1N3200VA, 27M1N3200ZA).
- **BenQ** : le prix des 3 premiers modèles importés est un champ caché de la page (`disableMagentoECStandardPrice`, quand la boutique BenQ ne vend pas le modèle) ; à couper si on n'en veut pas.
- `pnpm ingest prices` relit aussi les écrans et saute les slugs de `data/msrp.yaml`. Un import s'arrête à 10 modèles : `--next 50` pour toute la liste.

### Parcours recalé

- **Ordre** : usage, taille, budget, netteté, dalle, fluidité, courbure, indispensables (budget en 3e, choix validé).
- **Netteté** lue sur la hauteur de l'image : 1080p sous 1300 px, 1440p de 1300 à 1999, 4K de 2000 à 2799, 5K au-delà. Un 1920 × 1200 ou un 2560 × 1080 est un 1080p.
- **Taille** : « Ultra-large 38"+ » et « Grand format 37"+ » (16:9 dès 36" : 37" et 42,5" au catalogue).
- **Fluidité** : « 480 Hz et plus » (8 écrans). **Indispensables** : « Fixation VESA », masquée tant que tous l'ont ; « Pied réglable » lit `heightAdjustable` (LG ne chiffre pas la course).
- **Budget** : 0 à 1 600 € par pas de 25 €, barres de 50 € (médiane 380 €, 90 % sous 1 100 €).
- Une option qu'aucun écran du catalogue n'a est masquée (`Console.tsx`) : la TN, tant que les ZOWIE attendent leur prix.

### Classement et audit

Les critères dont la valeur peut manquer comptent alors la médiane de leurs pairs (`known`, `peers`) : réactivité par type de dalle, couleurs (DCI-P3) par dalle, console (HDMI) par définition. L'OLED vaut 1 en réactivité, le VA plafonne à 0,55, l'IPS Black (2000:1 et plus) monte à 0,5 en contraste, la netteté suit une courbe qui s'essouffle vers 185 PPI. Chaque critère a son libellé de faiblesse (`weakLabel`, claviers compris) ; `burnIn` (OLED 0,3) pèse 1 au bureau et n'est jamais un point fort (`caveat`). Après l'audit, le contraste passe de 1 à 0,5 en Création.

| Usage | Trois premiers (base locale) | Lecture |
| --- | --- | --- |
| FPS compétitif | ROG Swift OLED PG27AQWP, LG 27GX790B, AOC AG276QKD2 | OLED de 500 Hz et plus ; en 24", Alienware AW2524HF (500 Hz) |
| Jeu immersif | MSI MPG 341CQR, LG 39GX900A, MSI MPG 491CQPX | OLED ultra-larges |
| Console | AOC AG326UZD2, MSI MAG 321UP, MSI MPG 322UR | 4K QD-OLED en HDMI 2.1 |
| Création | AOC AG276UZD, MSI MAG 272UP, Samsung Odyssey OLED G8 | 4K calibrés à large gamut, puis 5K IPS (ROG XG27JCG, ViewFinity S9) |
| Bureau & code | ViewFinity S8 5K, LG 32U990A (6K), Dell U2725QE | Haute densité, pied complet, USB-C ; OLED marqué « À savoir » |
| Polyvalent | AOC AG276UZD, MSI MAG 272UP, Samsung Odyssey OLED G8 | 4K OLED |

Aucune marque ne dépasse 4 écrans dans un top 10. Script d'audit et chiffres : scratchpad de la session du 23 octobre (`audit.ts`).

### Photos et données

- `isolate` mesure la symétrie gauche-droite ; `squareOn` exige pour un écran une symétrie d'au moins 0,88 et deux morceaux au plus. 253 écrans sur 263 sont vus de face sur le canvas ; 7 seulement détourables (PG27AQWP livré avec un bras, AW2725DF sans vue de face chez Dell, LG 32U889SA sur pied haut, ProArt PA27USD et PA32USD vus de trois quarts, ZOWIE XL2546X+ et XL2586X+ avec leurs volets), 3 sans photo (Dell S2426HS, SE3426DW, ZOWIE XQ2566X).
- Une vue de dos passe le contrôle de symétrie : relire la planche contact après chaque import. `data/excluded.yaml` écarte ainsi les dos de l'AW2725DF et des deux ProArt, fige le SE2426H sur sa vue de face non détourable et écarte le LG 27U421A (sa page porte la fiche d'un 23,8"). Le sélecteur remplace une photo principale exclue.
- `atWidth` (`packages/catalog/src/media/cdn.ts`) redimensionne Scene7 (Samsung, Dell, Philips, BenQ), Sanity (AOC), ASUS et Shopify (MSI) ; leurs hôtes sont dans `netlify.toml`.
- ASUS ROG : la galerie est lue sur `/gallery/` (la page produit montre d'autres produits). BenQ : les photos d'un modèle « + » portent le nom du modèle de base, et la liste d'atouts de la page d'achat sert de texte (elle dit « QD-OLED » là où la fiche dit « OLED »).
- Philips : une plage de balayage (« 30-150 Hz (V) ») ne compte plus comme fréquence quand la résolution maximale donne la sienne ; le statut « NEW » compte comme en vente.
- Noms : Dell sans « Base » ni lettre doublée (« Pro P2726H ») ; LG avec sa gamme, lue dans « Nom du produit » ou la rubrique de l'URL (« UltraGear OLED 27GX790A », « Smart Monitor 27U731SA »). Une fiche sans taille la déduit des PPP (BenQ SW272QN).

### Base, production et suite

Migration `0003` (`height_adjustable`, `true_black_600`) et seed appliqués en local : 264 écrans, 25 écrans et 5 marques fictives supprimés, sous le garde-fou du seed. En production, rien n'est fait.

- [x] Source des prix d'ASUS, BenQ et Philips : prix conseillé cité par la presse tech (29 prix, 104 écrans attendent encore ; les prix d'avant 2023 restent écartés, choix confirmé)
- [x] ASIN Amazon des écrans : 233 sur 264, par la même méthode que les claviers
- [x] Commit (ad9f146) et fusion dans main en local
- [x] Production : push, migration 0003 et seed faits le 23 octobre (264 écrans, 233 ASIN en ligne)
- [ ] Acer et Gigabyte si une source ouverte apparaît

## Souris : troisième catégorie (23 octobre)

Le site gagne une troisième catégorie, les souris (`/fr/souris`, `/en/mice`) : 149 vrais modèles de 8 marques, lus sur les fiches officielles par `pnpm ingest <marque>-mice`, et un parcours de 11 questions (10 depuis le 24 octobre au soir) sur le modèle de l'accueil de shapefinder (« quelle coque va à ta main ? »). Commits sur feat/souris : e6a01d9 (catégorie, moteur, parcours, socle de l'import) et 3760b9e (les 149 souris), fusionnés dans main (184fc39) et mis en ligne le 23 octobre au soir : migration 0004 sur Neon, push, seed des 149 souris.

Le plan validé est dans `~/.claude/plans/j-aimerai-que-tu-explores-moonlit-wilkinson.md` (lots 0 et A à I). Choix de l'utilisateur : une quinzaine de marques et 300 souris au plus, jeu et bureau ; trackballs dans la question de forme (« au pouce » ou « aux doigts ») ; mesures des fiches officielles seulement, ni EloShapes ni autre base tierce ; trois prises (paume, griffe, bout des doigts) ; couleur facultative.

| Marque | Souris | Source | Prix | Écartées ou en attente |
| --- | --- | --- | --- | --- |
| Logitech (+ Logitech G) | 33 | logitechg.com et logitech.com (fr-fr) : pages catégorie, état sérialisé de chaque page | Boutique Logitech | G502 X LIGHTSPEED (pas de poids), M750 L (la page mesure la M750) |
| Pulsar | 30, le plafond | eu.pulsar.gg (Shopify) : flux JSON, accordéons des pages | Boutique européenne | Collaborations, éditions signées, coloris de tournoi |
| Razer | 27 | razer.com/fr-fr : sitemap produits, état ng-state (`mice-mice-specifications`) | Boutique Razer | Boomslang 20th Anniversary (collector) ; packs et éditions spéciales hors des variantes |
| SteelSeries | 23 | steelseries.com/fr-fr : sitemap, données Next.js (« Design\|\|\|Longueur\|\|\|… ») | Boutique SteelSeries | CS2 Dragon Lore, coloris Fortnite |
| ASUS ROG | 11 sur 26 | API odinapi.asus.com, pages `/spec/` de rog.asus.com | eStore ASUS | 11 sans prix (absentes de l'eStore), 4 sans poids ni mesures complètes ; éditions EVA, Gundam, Phantom Blade |
| HyperX | 10 | hyperx.com (Shopify) : la fiche est dans la description du flux | Prix US × 1,2 | 4 en rupture aux États-Unis |
| Turtle Beach | 9 | turtlebeach.com (Shopify) : accordéons des pages | Prix US × 1,2 | Gamme ROCCAT en rupture ; Burst II Pro (pas de mesures) |
| MSI | 6 | fr-store.msi.com (Shopify) | Boutique MSI | Versa 300 W et Forge GM340 W (pas de mesures) |

Le catalogue compte 63 symétriques, 80 ergonomiques, 4 verticales et 2 trackballs ; 135 pour droitiers, 9 ambidextres, 5 pour gauchers ; 127 de jeu, 22 de bureau. Une variante est une couleur : une autre taille, forme, fréquence ou version filaire est un produit à part.

### Parcours souris, 10 étapes

L'usage d'abord (profil de classement seulement), puis la main et la forme, qui décident des coques possibles ; puis l'ajustement (la prise règle le classement ; la taille, le poids et les boutons latéraux filtrent) ; connexion, budget et indispensables pour finir (`packages/catalog/src/finder/mice.ts`). Le 24 octobre, la question « taille de main » est partie (`fac57c1` : elle se confondait avec la taille de la souris, ses repères sont dans les tuiles de taille) et la question « boutons sur le côté » est arrivée (`bdb8eb9`).

| Clé | Question | Options | Comportement |
| --- | --- | --- | --- |
| `use` | À quoi va-t-elle servir ? | Jeu compétitif, Jeu polyvalent, Bureau & productivité, Nomade | Profil seulement, obligatoire |
| `hand` | Avec quelle main ? | Main droite, Main gauche | Obligatoire ; gauche = ambidextres + souris pour gauchers |
| `shape` | Quelle forme ? | Symétrique, Ergonomique, Verticale, Trackball au pouce, Trackball aux doigts | Plusieurs choix, obligatoire |
| `grip` | Comment la tiens-tu ? | Paume, Griffe, Bout des doigts ; « Je ne sais pas » | Plusieurs choix, classement seul ; deux voisines = l'entre-deux ; si la forme garde des coques symétriques ou ergonomiques |
| `size` | Quelle taille de souris ? | Petite (main de moins de 17 cm), Moyenne (17 à 19 cm), Grande (19 à 21 cm), Très grande (plus de 21 cm) | Filtre ; chaque tuile dit les mains qu'elle va |
| `weight` | Quel poids ? | Plume (moins de 40 g), Ultra-légère, Légère, Moyenne, Lourde (plus de 90 g) | Plusieurs choix, 3 g de tolérance |
| `sideButtons` | Combien de boutons sur le côté ? | Aucun, 2 (avant et arrière), 3 à 5 (G502, Basilisk, MX Master), 6 et plus (pavé MMO) | Plusieurs choix ; boutons du flanc du pouce, un seul côté pour une ambidextre, 0 pour un trackball ; posée si la forme garde autre chose que des trackballs ; 7, 108, 29 et 5 souris |
| `connection` | Comment la connecter ? | Sans fil 2,4 GHz, Bluetooth, 2,4 GHz + Bluetooth, Filaire uniquement | Un choix |
| `budget` | Quel budget ? | 0 à 200 € par 5 €, sans limite tout en haut | Plage |
| `musts` | Des indispensables ? | 8 000 Hz, Multi-appareils, Clics silencieux, Molette rapide, Défilement horizontal, Recharge sans fil, Batterie rechargeable, Switchs optiques, RGB | ET ; un indispensable qui ne départage rien est masqué |

Sur les 149 souris, une tuile reste vide et masquée : « Trackball aux doigts » (pas de Kensington).

### Prise, taille et classement

Le modèle de prise est le nôtre (`packages/catalog/src/finder/mouse-fit.ts`) : ni le code ni les constantes de shapefinder. Ses constantes sont de départ, à recaler au lot G sur les recommandations que publient les marques.

- **Taille d'une souris** : `sizeIndex` = longueur + la moitié de la largeur au-delà de 75 mm (une coque large comme la MX Master compte plus grand). Classes : petite sous 119 mm, moyenne de 119 à 126, grande de 126 à 130, très grande au-delà.
- **Repères de main** (24 octobre) : chaque tuile de taille dit les mains qu'elle va (moins de 17 cm, 17 à 19, 19 à 21, plus de 21), d'après l'ancien modèle de longueur visée ; l'aide conseille la taille au-dessus en prise paume, celle en dessous du bout des doigts.
- **Adéquation à la prise** (`gripFit`) : hauteur et largeur rapportées à la longueur, autour de cibles par prise, et le corps de la coque (ergonomique pour la paume, symétrique du bout des doigts) ; coques symétriques et ergonomiques seulement.
- **Retiré le 24 octobre** (`fac57c1`) : la question « taille de main », l'adéquation à la main (`handFit`), la longueur visée et le conseil de taille (`recommend`, `recommended()`), dont le badge n'avait jamais été affiché. La plage de main publiée par une marque reste dans la fiche (« Conseillée pour »).
- **Autres critères** : légèreté, capteur (fréquence), sans fil, autonomie, multi-appareils, défilement, silence, confort, compacité, boutons, chacun avec son libellé de faiblesse.

| Profil | Poids des critères |
| --- | --- |
| Jeu compétitif | prise 1, légèreté 2,5, capteur 2, sans fil 1 |
| Jeu polyvalent | prise 1, capteur 1, légèreté 1, sans fil 1, autonomie 1, boutons 1 |
| Bureau & productivité | prise 0,5, confort 2, multi-appareils 2, défilement 2, silence 1,5, autonomie 1,5 |
| Nomade | compacité 3, multi-appareils 2, autonomie 2, sans fil 2, légèreté 1 |

Le moteur, commun aux trois catégories, sait lire les réponses : `Criterion.score(item, answers)`, `active?`, `weakLabel` en fonction, `anyLabel` (« Je ne sais pas »), `rankingAnswers()`, `isInformed` vrai dès une réponse « classement seulement » (la prise), `FinderDefinition.category`. Claviers et écrans classent comme avant.

| Profil testé sur les 149 souris (24 octobre) | Trois premiers |
| --- | --- |
| Jeu compétitif, symétrique, griffe | Harpe II Ace, PRO X SUPERLIGHT 2c, Viper V4 Pro |
| Jeu, ergonomique, paume | DeathAdder V4 Pro, Rival Pro Mini, Feinmann F01 |
| Jeu, bout des doigts, petite taille | Sensei Pro Mini, PRO X SUPERLIGHT 2c, X2H CrazyLight Mini |
| Bureau, ergonomique, grande taille | MX Master 3S Édition Bluetooth, Basilisk V4 Pro, Basilisk V4 HyperSpeed |
| Bureau, verticale | Lift, Pro Click V2 Vertical, MX Vertical |
| Main gauche, ergonomique | X3 LHD CrazyLight Mini, X3 LHD CrazyLight Medium, Naga Left Handed Edition |
| MMO (pavé latéral) | Naga V2 HyperSpeed, Aerox 9 Wireless, Rival 5 |

### Import des souris

Une source par marque : `pnpm ingest logitechg-mice` (puis `logitech-mice`, `razer-mice`, `steelseries-mice`, `rog-mice`, `msi-mice`, `pulsar-mice`, `hyperx-mice`, `turtlebeach-mice`), `--dry-run` d'abord, `--next 30`. Chaque adaptateur (`packages/ingest/src/sources/mice/`) lit une page en `OfficialMouse` (paires libellé/valeur, texte, variantes, photos) ; `mapMouse` (`official.ts`) et `mouseSpecsOf` (`mouse-specs.ts`, 11 tests sur de vraies fiches) font le reste ; `import-mice.ts` écrit `data/mice/<marque>.yaml` et une fiche de relecture. Au plus 30 souris par marque, dans l'ordre de la marque.

- **Mesures** : libellés propres, sinon un champ « L × l × H » lu dans l'ordre qu'il nomme, sinon triées (la longueur est la plus grande) avec une note. Poids hors câble, pile comprise pour une souris à piles ; « ± 1 g » et « ±44g » lus ; livres et onces converties (HyperX : les grammes exacts du texte quand ils concordent).
- **Fréquence dans la boîte** : un dongle 8K, un dock ou un over-polling « vendu séparément » ou « en option » ne compte pas ; la DeathAdder V3 Pro est vendue en 1000 Hz et en 8000 Hz, deux produits.
- **Autonomie** : la valeur à 1 000 Hz, éclairage éteint, sur la liaison 2,4 GHz plutôt qu'en Bluetooth ; à défaut celle que le texte lie à la batterie ; jours et mois comptés à 8 h par jour.
- **Liaison et alimentation** : 2,4 GHz sur un nom de radio (LIGHTSPEED, HyperSpeed, Quantum, UWB…) ou un récepteur dans la boîte ; un récepteur « compatible » ou « non inclus », ou une « Édition Bluetooth », ne compte pas. Piles quand les lignes de batterie le disent ; une souris sans fil qui marche en filaire ou vient avec un câble USB-C est rechargeable.
- **Main** : « ambidextre » avec des boutons d'un seul côté reste pour droitiers (note) ; une coque symétrique sans boutons latéraux, ou avec les siens sur le dessus, est ambidextre. Une page de gamme donne la plage de main de chaque taille (M650, M650 L).
- **Drapeaux** (clics silencieux, molette rapide, inclinable ou latérale…) sur preuve positive seulement ; « Virtuel » vaut non.

| Marque en attente | Ce qui manque | Piste |
| --- | --- | --- |
| Zowie (environ 25) | Dimensions en image seulement (la ligne « Dimensions » est vide, en français comme en anglais) ; prix chargés dans le navigateur | Recopier les schémas de mesure officiels ; prix conseillés de presse |
| Keychron et Lemokey (environ 18) | Dimensions en image seulement | Schémas officiels ; prix de keychron.fr par SKU |
| Corsair (environ 20) | Pas de dimensions dans les pages françaises ni américaines | Un document officiel (manuel), sinon attendre |
| Kensington (8 trackballs) | Pas de prix | Prix conseillés de presse ; les dimensions ne sont pas exigées d'un trackball |
| Glorious, Endgame Gear, Lamzu | Pas essayées (Shopify limitait l'agent le 23 au matin, levé le soir) | Nouvel essai, 4 s entre deux pages |
| Cooler Master | Catalogue rendu dans le navigateur | À étudier |
| VAXEE | Refus (403) | Laissée de côté |

### Base, production et suite des souris

- **Catégories à l'abri (lot 0)** : une catégorie dont le snapshot échoue ou est vide est masquée (`shown` rendu par le loader de `$lang`, en-têtes no-store en cas d'échec, `/$category` en 404). Un déploiement avant la migration ou avant le seed ne casse donc rien.
- **Migration `0004_mouse_specs`** : la valeur `mouse` de l'énumération `category`, sept énumérations et la table `mouse_specs`. Appliquée en local, puis sur Neon le 23 octobre au soir, avant le push.
- **Seed** : garde-fou par catégorie (refus si une catégorie perd plus de max(10, la moitié) de ses produits ; `SEED_PRUNE=force` pour passer outre), `SEED_DATA_DIR` pour un autre dossier. Seeder la production depuis un dossier sans `data/mice` serait refusé : c'est voulu.
- **Vérifié en local** : deux seeds sans écart ; snapshot identique au YAML pour 523 claviers, 264 écrans et 149 souris ; le serveur de main tournant sur la même base répondait 200. La base de démo `choose_a_device_mice` (29 souris fictives) reste pour le travail sur le site.

* [x] Lots 0, A, B et socle de l'import (e6a01d9)
* [x] Lot D : 149 souris de 8 marques (3760b9e)
* [x] Fusion dans main (184fc39), migration 0004 sur Neon, push, seed de la production : en ligne le 23 octobre au soir
* [ ] Lot E : photos (`pnpm ingest photos mice`, barrière vue de dessus), prix et curation
* [ ] Lot F : le site pour les souris (tuiles qui montrent le meilleur modèle depuis bad913f, à vérifier ; badges « Conseillé » ; figure de mesure de la main ; emplacements portrait ; titre au féminin « trouve la tienne »)
* [ ] Lot G : calage du modèle et audit des personas (`packages/catalog/scripts/audit-mice.ts`)
* [ ] Marques en attente (tableau ci-dessus) et ASIN Amazon des souris

## Retours du 23 octobre (soir)

Deux commits de la session canvas, poussés sur origin le 23 octobre au soir : bd1fcfb « Canvas : photos relayées, arrivée filtrée, preloader en panneaux, popup revue » et bad913f « Finder : une seule navigation, appareils dans les tuiles, popup corrigée ». Résumé d'après leurs messages de commit.

- **Photos d'écrans relayées** : le CDN d'images de Netlify recopie l'en-tête de cache des marques ; Samsung, Dell, LG, ASUS (« private »), BenQ et Philips (« max-age=0 ») ne laissaient rien garder. La route `/api/photo/<clé>` les relaie, marquées immuables (`hosts.ts`, même liste que `remote_images`). Sur le canvas : photos du centre d'abord, préchargement dans le sens du mouvement, 6 découpes et 4 préchargements, octets gardés par le worker.
- **Arrivée filtrée** : changer de catégorie, ou entrer depuis l'accueil, applique les réponses enregistrées dès le clic (`journeyTargets`) ; avec une short list, les finalistes restent sur le panneau qui s'ouvre puis glissent vers la grille.
- **Preloader en panneaux** : les panneaux de l'accueil en CSS, un appareil par catégorie qui se remplit à son rythme, puis levée panneau par panneau ; sur un canvas, l'appareil de la catégorie seul. Une souris y est déjà dessinée.
- **Popup du canvas** : 4 specs clés en grille, ouverture depuis le trait, glissement d'un produit au voisin, carte opaque, boule orange placée par translate ; plus de popup sur un produit visible à moins de 70 %.
- **Une seule navigation** : la barre de parcours montre chaque réponse ; les puces de réponses et la bulle d'astuce sont retirées ; le podium n'affiche que les 3 premiers. Les claviers perdent la question de couleur (9 questions, les anciens liens `look=` sont ignorés).
- **Tuiles des questions** : chaque option montre le meilleur modèle qu'elle garde selon les autres réponses (un différent par tuile, photographié d'abord), à l'échelle pour la taille des claviers et le format des écrans ; `OptionVisual` est retiré. Nouvelle accroche : « Le bon appareil, en quelques questions ».

## Mobile (24 octobre)

Le site est repensé pour les téléphones (moins de 768 px de large, en portrait comme en paysage) ; le bureau et la tablette ne changent pas. Fait dans la branche feat/mobile (5 commits, de `b2d2cc0` à `44699c9`), fusionnée avec `main` (`19ed09a`), puis poussée et déployée le 24 octobre, sans migration ni seed. Le plan et l'audit de départ (20 constats mesurés sur le site en ligne) sont dans `~/.claude/plans/j-aimerai-que-tu-explores-binary-pine.md`.

| Avant | Après | Fichiers |
| --- | --- | --- |
| Accueil : trois bandes verticales d'environ 120 px sous le titre ; plaques qui se chevauchent à 320 px ; page figée | Le titre a son espace, puis une bande droite par catégorie, empilées ; la page défile, prête pour d'autres catégories. Plaque toujours visible en bas à gauche (compteur, nom, accroche, « Explorer → ») ; le retour depuis une catégorie revient à la position quittée | `routes/$lang/index.tsx`, `scene/geometry.ts`, `scene/renderer.ts`, `scene/controller.ts`, `styles.css` |
| Preloader : libellés coupés dans les bandes étroites | Les mêmes lignes que l'accueil, le dessin à droite et le compteur à gauche | `scene/Preloader.tsx`, `styles.css` |
| Header : FR/EN au centre sous 640 px ; rien ne tient compte de l'encoche ni de l'indicateur d'accueil | FR/EN toujours à droite ; header, dock, feuilles et barre d'achat dans les zones sûres (`env(safe-area-inset-*)`) | `components/SiteHeader.tsx`, `finder/Finder.tsx`, `finder/ProductDrawer.tsx` |
| Console : titre coincé à droite de ← ↻ 04/10, jusqu'à quatre lignes à 320 px | Deux rangées : ← ↻, la pastille « 04/10 · Parcours » remplie selon la progression, ⓘ ; puis le titre sur toute la largeur, avec « Une seule réponse », « Plusieurs réponses possibles » ou, au budget, « Glisse l'un ou l'autre curseur » | `finder/Console.tsx` |
| Réponses : grille de deux colonnes, explications et photos masquées, longues listes coupées net, pied qui déborde sous 360 px | Liste pleine largeur : nom, explication entière, photo d'exemple, nombre de modèles ; fondu en bas tant qu'il reste à défiler ; le pied passe à la ligne | `finder/Console.tsx`, recette `optionTile` (`panda.config.ts`) |
| Barre d'étapes : étapes tronquées, cibles de 28 px | Masquée : la pastille ouvre la feuille Parcours, chaque étape avec sa réponse ou la raison d'un saut, puis « Résultats » | `finder/JourneySheet.tsx`, `finder/Sheet.tsx` |
| Podium : rangée défilante, 2e carte coupée, « Voir tout » hors écran | Bandeau n°1 au-dessus de la console (photo, marque, prix, nom, % de compatibilité) une fois le classement informé ; masqué sous 700 px de haut | `finder/TopPick.tsx`, `finder/Finder.tsx` |
| Tactile : survol collé après un tap ; cibles sous 44 px | Le survol ne vaut que pour une souris (`(hover: hover)`) ; boutons icônes, flèche Amazon et FR/EN à 40 px au doigt, lignes de marques à 44 px, curseurs du budget à 28 px | `panda.config.ts`, `finder/BudgetControl.tsx`, `product/AmazonLink.tsx` |
| Marques : liste ancrée en haut à gauche, clavier qui surgit à l'ouverture | Feuille du bas, sans focus automatique au doigt ; recherche en 16 px, sans zoom d'iOS | `finder/BrandFilter.tsx` |
| Canvas : environ 70 px visibles sur iPhone SE ; indice toujours affiché | Barre d'étapes et podium retirés, la place revient au canvas ; au doigt, l'indice disparaît au premier geste, retenu dans le stockage du navigateur (`choose-a-device:canvas-hint-seen`) | `finder/Finder.tsx`, `scene/Scene.tsx` |
| Résultats : noms tronqués (« PRO X SUP… »), lignes de 56 px sans spec | Lignes de 88 px : vignette avec le rang, nom entier sur deux lignes, « prix · % » ; panneau du header au bas de l'écran ; « Modifier » ouvre la feuille Parcours par-dessus les résultats ; n°2 et 3 : prix et Amazon sous le nom | `finder/ResultsView.tsx` |
| Fiche : ni poignée ni glisser ; rang affiché deux fois ; photo après le détail du % | Poignée, fermeture en la tirant vers le bas ; rang une seule fois ; photo juste après le titre, puis chiffres et Amazon | `finder/ProductDrawer.tsx`, `product/KeyFigures.tsx` |
| Paysage : console sous le pli (`min-height: 560px`), canvas qui bloque le défilement | Accueil en lignes sous 480 px de haut ; compteur, bandeau et indice masqués ; console plafonnée à la hauteur de l'écran | `finder/Finder.tsx`, `finder/Console.tsx` |

Comment ça marche :

- **Seuils** : téléphone = moins de 768 px de large (`isCompact`) ; l'accueil passe aussi en lignes sous 480 px de haut (`bandsInRows`). Conditions Panda : `_coarse` (doigt), `_short` (moins de 30rem de haut), `_slats` (l'inverse de `bandsInRows` : bureau et tablette).
- **Accueil qui défile** : le défilement reste natif (inertie, rebond). À chaque image, le renderer lit `window.scrollY`, dessine les bandes décalées d'autant et déplace le calque fixe des liens dans la même image (`scene.followHome`) : plaques et dessin ne se décalent jamais, même pendant un lancer. À l'ouverture, le défilement passe dans la caméra (`foldHover`) ; il est rendu au retour (`unfoldScroll`) et l'accueil revient où on l'a quitté (`resetScroll: false`, `scene.homeScroll()`).
- **Canvas en `100lvh`** : la barre de Safari qui se replie ne redimensionne plus le canvas (`resize` sans effet quand la taille ne change pas ; hauteur de dessin distincte de la mise en page).
- **Rendu serveur** : les variables CSS `--rows-*` reprennent `rowsFrame` (`geometry.ts`) pour le premier rendu et le preloader.
- **Feuilles** : `finder/Sheet.tsx` (portail, fond, Échap, focus, poignée ; tirée de 80 px ou à 0,5 px/ms, elle se ferme : `useSheetDrag`) sert au Parcours et aux Marques ; la fiche produit reprend `useSheetDrag` et `foldAway`.
- **Liste virtualisée** : hauteur de ligne fixe par taille d'écran (`ROW` : 56 px, 88 px sur téléphone), lue par `matchMedia`.

## SEO : fiches produit, nom et domaine (24 octobre)

Depuis le 24 octobre, chaque produit a sa fiche indexable en français et en anglais, soit 1 880 pages dans le sitemap, et le site s'appelle shapepick, sur [shapepick.com](https://shapepick.com). Commits : `0b69127` (socle SEO), `1e4d0bf` (fiches), `709e57e` (nom), `287a219` (redirection limitée aux pages) ; plan dans `~/.claude/plans/effervescent-seeking-backus.md`. L'utilisateur a pris chaque option recommandée : Retour ferme la fiche, titre « nom + type d'appareil », grille 2 × 2, voisins par ressemblance + prix, nom en minuscules.

| Sujet | Ce qui est en place |
| --- | --- |
| Adresses | `/fr/claviers/<slug>` ↔ `/en/keyboards/<slug>` (même slug), de même pour les écrans et les souris. Une seule route, `routes/$lang/$category.{-$product}.tsx` : le paramètre optionnel garde le finder monté. Slug inconnu ou d'une autre catégorie : 404 |
| Fiche | `ProductDrawer` rendu dans la page (plus de portail), donc dans le HTML servi. h1 = le produit, ligne « Clavier 60 % magnétique » sous son nom, vraie photo dans un `noscript` |
| Historique | Ouvrir ajoute une entrée marquée (`state.sheet`) ; flèches et modèles proches la remplacent ; Retour et × replient la fiche. Arrivé directement sur une fiche, × remplace par la catégorie. Le lien FR/EN garde la fiche |
| Liens | Podium, n°1 mobile et résultats sont de vrais liens (`ProductLink`), réponses gardées ; le canvas ouvre la fiche par la même navigation |
| Modèles proches | 4 cartes en grille 2 × 2 en fin de fiche. `similar()` (`packages/catalog/src/finder/similar.ts`) : ressemblance pondérée (Jaccard) sur les questions qui décrivent l'appareil (`likeness` de chaque questionnaire), moins 0,25 × \|ln(rapport des prix)\|, 2 par marque au plus, jamais une souris pour l'autre main ; 13 tests |
| Head | Titre « Wooting 60HE V2, clavier 60 % magnétique · shapepick », description avec le prix indicatif, canonical sans réponses, og:image = la photo en JPEG par le CDN d'images. JSON-LD `Product` sans `offers` (prix publics approximatifs), avec `isSimilarTo`, et `BreadcrumbList` |
| Sitemap | 8 pages + 936 produits × 2 langues = 1 880 URL, avec hreflang et x-default ; lastmod = celui de la catégorie, car le seed redate chaque produit à chaque passage |
| Nom | `SITE.name` = shapepick (`apps/web/src/site.ts`) ; l'ancien nom reste en `alternateName` du JSON-LD WebSite. Les clés du stockage navigateur `choose-a-device:*` sont gardées (les renommer effacerait les parcours enregistrés) |
| Domaine | shapepick.com, acheté via Netlify le 24 octobre (DNS chez Netlify), domaine principal ; www redirige vers la racine. L'ancienne adresse renvoie une 301 page pour page vers shapepick.com ; `/api/` et `/_serverFn/` répondent sur place |
| Search Console | Propriété de domaine shapepick.com, TXT `google-site-verification` publié dans le DNS Netlify (à garder) ; `sitemap.xml` à soumettre |

La 301 vit dans `apps/web/src/server.ts`, le point d'entrée serveur : chez Netlify, la fonction qui sert tout le site passe avant les redirections de `netlify.toml`. Elle ne s'active qu'au build où l'adresse du site (`SITE.url`, la variable `URL` de Netlify) est le nouveau domaine : après le rattachement de shapepick.com, il a fallu relancer un déploiement pour que canonical, sitemap et redirection basculent.

## Audit et lot 1 (24 octobre)

Le lot 1 de l'audit du 24 octobre est en ligne depuis `959f780` (migration `0005` passée sur Neon avant le push), complété par `fac57c1`, puis le soir par les switchs (`539fdaf`), les boutons latéraux (`bdb8eb9`) et les collections (`7af8928`) : voir « Soir du 24 octobre ». L'audit a porté sur l'algorithme, le SEO et les performances : site en ligne mesuré avec `curl` et Chrome headless (mobile à CPU ×4 et 4G lente), vrai moteur lancé sur les vraies données. Plan dans `~/.claude/plans/j-aimerai-que-tu-explores-fuzzy-breeze.md` ; l'utilisateur a pris chaque option recommandée.

| Constat | Mesure | Suite |
| --- | --- | --- |
| A1 Filtre « Ressenti » | 229 claviers à switchs sur 498 écartés quoi qu'on coche : switch non renseigné | Fait : switchs complétés depuis le web, 13 claviers sans switch (`539fdaf`) |
| A2 Inconnu compté comme « non » | Firmware « propriétaire » par défaut pour 294 claviers, montage absent pour 242 : profil Code = 10 Keychron en tête | Lot 2 : champs à trois états, listes VIA et QMK |
| A3 Ex æquo | 7 profils sur 15 départagés par l'ordre alphabétique (AOC devant ASUS ProArt, tous deux à 84 %) | Corrigé : prix, puis année, puis lien Amazon direct |
| A4 % tassé | A priori à 0,5 partout : fit entre 12,5 et 87,5 % | A priori retiré tant qu'il est constant |
| A5 Pénalités binaires | Écrans Bureau 27" : top 10 = 100 % USB-C, contre 37 % du catalogue | À recalibrer |
| A6 Cohérence | « Autonomie courte » sur un clavier filaire ; 3 claviers avec batterie sans liaison sans fil | Fait : critère corrigé, liaisons des 3 claviers corrigées (`539fdaf`) |
| S1 Fiches orphelines | Aucune page indexable ne lie les 1 872 fiches : seul le sitemap les fait découvrir | Fait : catalogue A–Z lié depuis le finder, 92 collections par langue (`7af8928`) |
| S2 Contenu | Peu de texte propre aux fiches ; aucune page par caractéristique (« clavier 75 % sans fil ») | En partie : collections et bloc « Classements » sur chaque fiche (`7af8928`) ; phrases comparatives sur les fiches à venir |
| S4 Détails | Slash final en 307 ; ni mentions légales ni page confidentialité | Corrigé |
| P1 Préchargeur | LCP mobile ≈ 4,5 s alors que la page est dessinée à 1,2 s | Retiré des fiches atteintes directement |
| P2 Poids des pages | Chaque page embarque les 3 catalogues : 1,15 à 1,31 Mo de HTML, 85 % de données | Lot 4 |
| P3 Cache | Assets versionnés servis en `max-age=0` | Corrigé : un an, `immutable` |
| P4 Accueil | CLS 0,46 en bureau : les liens des bandes changeaient de boîte au réveil | Corrigé : 0,001 |
| P5 Réponse à froid | 3,7 s (fonction en Ohio, base à Francfort qui se met en veille) | Lot 4 |

| Sujet | En ligne | Fichiers |
| --- | --- | --- |
| Classement | Ex æquo au moins cher, puis au plus récent, puis à l'ASIN ; a priori hors du fit tant qu'il est identique pour tous ; filaire neutre sur l'autonomie | `engine.ts`, `finder/settle.ts`, `keyboards.ts` |
| Clics Amazon | Beacon vers `/api/out` au clic et au clic molette, écrit dans `outbound_clicks` : produit, catégorie, emplacement (`sheet`, `sheet-bar`, `best-match`, `runner-up`, `results-row`), type de lien, langue, page, pays (`Netlify.context.geo`), appareil. Robots et autres origines ignorés, GET en 405 | `features/product/clicks.ts`, `AmazonLink.tsx`, `routes/api/out.ts`, `server/clicks.server.ts` |
| Umami Cloud | Retiré le 24 octobre au soir (`4e47f6a`), à la demande de l'utilisateur : script, ID, événement `amazon`, interrupteur « Compter mes visites » et section « Mesure d'audience » des mentions légales. Restent Search Console, la console Partenaires et le journal des clics | `site.ts`, `routes/__root.tsx`, `features/product/clicks.ts`, `features/legal/` |
| Cache et adresses | `/assets/*` gardés un an ; slash final en 308, en un seul saut avec l'ancienne adresse | `netlify.toml`, `server.ts` |
| Préchargeur | Absent d'une fiche atteinte directement (pas de `data-loading`) ; accueil et catégories le gardent | `__root.tsx`, `Preloader.tsx` |
| Accueil | Liens des bandes sur une boîte fixe découpée par `clip-path`, étiquette placée par `translate` | `routes/$lang/index.tsx` |
| Pages légales | `/fr/mentions-legales` et `/en/legal` (mauvaise langue en 301), lien dans le header | `features/legal/`, `routes/$lang_.mentions-legales.tsx`, `routes/$lang_.legal.tsx` |
| Image de partage | `default-fr-v2.png` et `default-en-v2.png`, avec de vraies photos ; descriptions des pages raccourcies | `public/og/`, `og/`, `seo.ts`, `messages.ts` |
| Base locale | Client sur `globalThis`, connexions inactives fermées après 20 s | `packages/db/src/client.ts` |
| Souris (`fac57c1`) | Question « taille de main » retirée, repères de main dans les tuiles de taille | `mice.ts`, `mouse-fit.ts` |

Mesuré en ligne après le déploiement : CLS de l'accueil à 0,001 en 1440 × 900 et 1280 × 800. Sur mobile, le texte d'une fiche apparaît à 2,2 s contre 4,6 s, mais le LCP reste la photo, vers 5 s, à cause du détourage côté client. L'accueil reste vers 5 s, préchargeur gardé. Une ligne de test est en base (page `/test-mise-en-ligne`). Pour lire les clics dans la console Neon :

```sql
select product_slug, placement, count(*) as clics
from outbound_clicks
where page <> '/test-mise-en-ligne'
group by 1, 2
order by clics desc;
```

## Soir du 24 octobre : mis en ligne et reste à faire

Les trois chantiers ouverts pendant l'audit sont fusionnés dans `main` et mis en ligne le 24 octobre au soir, dans cet ordre : migration `0006` sur Neon, seed de production, push. Le seed passe avant le push parce que la question des boutons latéraux lit un champ neuf : déployée sur une base sans ce champ, elle écarterait toutes les souris. Le Store ID Amazon Partenaires et le retrait d'Umami ont suivi le même soir.

| Travail | Commit | Chiffres |
| --- | --- | --- |
| Switchs complétés depuis le web : fiches avec leur source dans `data/switches.yaml`, alias dans `data/switch-aliases.yaml`, variantes reconstruites par `pnpm ingest switches` depuis les pages en cache, 11 Keychron de la série B passés en ciseaux, liaisons sans fil de 3 claviers corrigées | `539fdaf` | 227 switchs ; 13 claviers sans switch au lieu de 229. Filtre « Ressenti » : linéaire 212 → 429, tactile 146 → 233, clicky 48 → 117, silencieux 26 → 59 |
| Question souris « boutons sur le côté », après le poids : champ `sideButtons` rempli pour les 149 souris avec sa source (flanc du pouce, un seul côté pour une ambidextre, 0 pour un trackball), migration `0006` ; les indispensables « 8 boutons et + » et « Pavé MMO » disparaissent | `bdb8eb9` | Aucun : 7 souris ; 2 : 108 ; 3 à 5 : 29 ; 6 et plus : 5 |
| Catalogue A–Z par catégorie (`/fr/claviers/catalogue`, `/en/keyboards/catalogue`…), lié depuis le finder ; collections tirées des réponses du questionnaire (`/fr/claviers/catalogue/75-pourcent`…), classées par le moteur, avec ItemList et BreadcrumbList ; bloc « Classements » sur chaque fiche | `7af8928` | 92 collections par langue, 6 produits au moins chacune ; sitemap de 2 070 adresses contre 1 880 ; chaque fiche à deux clics d'une catégorie |
| Amazon Partenaires : Store ID niji0a-21 dans `AMAZON_PARTNER_TAG`, donc le tag sur tous les liens amazon.fr, `rel="sponsored"`, la mention Partenaire sur la fiche et en pied des résultats ; mentions légales en texte d'affiliation, qui précise que les commissions n'entrent pas dans le classement | `a2d631a` | 27 liens taggés sur 27 dans les résultats, 2 sur 2 dans une fiche |
| Umami retiré, à la demande de l'utilisateur : script, ID, événement de clic, interrupteur « Compter mes visites » et section « Mesure d'audience » des mentions légales, qui gardent 7 sections | `4e47f6a` | Plus aucune mention d'Umami dans les pages |
| Photos remplacées depuis le web : une vraie vue de dessus ou de face pour 41 produits que le canvas montrait en dessin, puis 7 d'après des liens de l'utilisateur (voir « Photos remplacées depuis le web ») | `cd006c0` | Canvas : 864 → 912 produits en vraie vue sur 936 ; 24 restent en dessin |
| Contrôle photo assoupli : paire split vue de dessus, écran à caches ou sur pied haut ; Keychron Q11 en split (voir « Photos remplacées depuis le web ») | `df86d23` | Canvas : 912 → 916 sur 936 ; 58 photos de plus sur 4 354 découpes rejouées, aucune de moins |
| Le LG Swing revient au dessin : sa photo, 2,3 fois plus haute que son dessin, recouvrait ses voisins dans la sélection courte (choix de l'utilisateur) | `74e0bf7` | Canvas : 916 → 915 sur 936 |
| Proposée, pas lancée : photo de la fiche dès le premier rendu (`ProductPicture.tsx`, `photo.ts`, `ProductDrawer.tsx`) | — | LCP visé sous 2,5 s, contre ≈ 5 s |

À faire par l'utilisateur :

- [x] Search Console : propriété validée et sitemap envoyé (2 070 adresses), faits le 24 octobre au soir. « Demander l'indexation » seulement pour quelques pages clés (une dizaine par jour au plus), puis suivre les rapports Sitemaps et Pages ; attendre 3 à 4 semaines avant d'ajouter d'autres pages SEO.
- [ ] Obtenir quelques liens vers le site (forums et subreddits de claviers, annuaires d'outils) : un site neuf sans lien entrant est exploré lentement.
- [ ] Amazon Partenaires : compte ouvert le 24 octobre, Store ID en ligne ; il faut 3 ventes dans les 180 jours, sinon le compte est fermé. Plus tard, un identifiant de suivi par emplacement (fiche, résultats, podium), créé dans la console Partenaires.
- [ ] En option, Bing Webmaster Tools : importer la propriété Search Console (Bing alimente aussi DuckDuckGo et Ecosia).

## Photos remplacées depuis le web (24 octobre, soir)

Le canvas montre une vraie vue pour 915 produits sur 936, contre 864 : 48 produits ont reçu une photo trouvée sur le web et relue à l'œil (`cd006c0`, puis `5d1ffe0` d'après des liens envoyés par l'utilisateur), et le contrôle assoupli (`df86d23`) laisse passer 3 bonnes photos qu'il refusait. Les 21 autres gardent leur dessin : aucune vraie vue de dessus ou de face n'est publiée, ou le contrôle refuse la seule qui existe.

| Catégorie | Avant | Après |
| --- | --- | --- |
| Claviers | 480 / 523 | 504 / 523 |
| Écrans | 253 / 264 | 262 / 264 |
| Souris | 131 / 149 | 149 / 149 |

- **Sources**, dans cet ordre : les photos déjà dans `data/` (6 souris) ; toutes les images des pages officielles en cache (SteelSeries, ASUS, Dell, BenQ, Logitech, HyperX) ; les galeries `.json` de boutiques Shopify (Divinikey, Computer Lounge, Datablitz, mechanicalkeyboards, Chilkey). Jamais Amazon. Newegg, Best Buy, Micro Center, Overclockers et PCCaseGear refusent les robots. Aucun nouvel hôte d'images.
- **Méthode** : chaque candidate passe le détourage et `squareOn` du site, puis une relecture sur planche contact. La photo retenue devient la principale, avec sa page source en commentaire (`# photo : …`). Les 41 photos passent aussi le vrai pipeline du navigateur (relais, worker, contrôle) sur une base locale jetable, et `pnpm ingest photos --dry-run` les garde.
- **Code** : `atWidth` (`packages/catalog/src/media/cdn.ts`) n'ajoute le suffixe de taille d'ASUS qu'à ses images `/gain/`. Les images des pages ROG (`/files/media/…`) répondaient 404 avec.
- **Données** : la Pulsar X3 CrazyLight Medium passe de « symétrique » à « ergonomique » (page officielle : « Ergonomic right hand shape »), comme les autres X3. Sa vue de dessus passe alors le contrôle.
- **Encore en dessin** : Womier (10), Vortex M0110, M0110 6.25 et Model M 65, KBParadise V80, Chilkey Foxy 65, Ducky One Mini, Wobkey Zen 65, Varmilo Minilo75 (vues de biais, en scène ou sur fond noir partout) ; SteelSeries Apex 9 TKL (seule l'édition FaZe rouge est vue de dessus) ; Dell SE2426H (vue de face cadrée au ras de l'écran ; l'autre fichier trouvé garde son fond blanc au détourage) ; LG 32U889SA (sur son pied à roulettes, sa photo dépasse sa place sur le canvas).
- **Contrôle assoupli** (`df86d23`, en ligne depuis le 24 octobre à 18:21 UTC, parti avec le push d'une autre session) : une paire split ou Alice vue de dessus passe dès 0,65 de remplissage si elle reste symétrique (0,85) et proche des proportions de son dessin (0,7 à 1,5) ; un écran plus large que son dessin (caches des ZOWIE) passe s'il est presque parfaitement symétrique, sans remplir sa boîte comme une bannière. Rejoué sur 4 354 découpes : 56 photos de plus, toutes de bonnes vues, aucune de moins ; l'ingest à blanc ne change aucune photo principale. Le Keychron Q11 passe en `split` (« 75% split », keychron.com), donc dans la tuile « Ergonomique » ; seed de production le 24 octobre à 18:42 UTC (9 min 48 s), il y est en photo en ligne. Le LG 32U889SA garde son dessin (`74e0bf7`, choix de l'utilisateur, poussé le 24 octobre au soir avec le podium `0589107`) : sa photo, 2,3 fois plus haute que son dessin, recouvrait les pieds de ses voisins dans la sélection courte, puis la rapetissait toute entière.
- **Mise en ligne** : `cd006c0` poussé avec le handoff (`bc5c560..97c32d1`), build en ligne une minute après, correctif d'`atWidth` dans le code servi ; seed de production ensuite (8 min 49 s). En ligne, l'API sert les 40 photos, le CDN d'images les livre toutes et la X3 CrazyLight Medium est « ergonomique ».

Deuxième lot, d'après des liens envoyés par l'utilisateur (`5d1ffe0`, poussé puis semé le 24 octobre au soir) : Vortex PC66 66 et 68 touches, SteelSeries Apex 9 Mini, Dell AW2725DF, ROG Keris Wireless AimPoint, ASUS ProArt PA27USD et PA32USD (vue de face de leur page officielle). Trois hôtes de revendeurs sont autorisés dans `netlify.toml` et `hosts.ts` (Mercular, MakeWebEasy, Euro RTV AGD) ; Mercular, sans en-tête de cache, passe par le relais. En ligne, l'API sert les 7 photos et le CDN d'images les livre. Écartés : Ducky One 3 Mini (autre clavier, lien mort), Apex 9 TKL (lien mort), KBParadise V80 (403), Dell SE2426H (le détourage garde le fond blanc), LG 32U889SA (pied haut).

## Retours du 24 octobre (soir) : interface, mentions légales et catalogue

Huit retours de l'utilisateur, tous en ligne le 24 octobre au soir et vérifiés sur shapepick.com. L'interface et les mentions légales sont parties en cinq commits (`6fd52ff` à `646fb65`), puis 47 produits de quatre marques (fusion `a777214`, hôte Akko `124c2e2`, seed de production). Plan : `~/.claude/plans/j-aimerai-que-tu-explores-cryptic-phoenix.md`.

| Retour | Ce qui a changé | Commit |
| --- | --- | --- |
| Bande du haut trop présente (MacBook Pro 16") | hauteur `clamp(8.5rem, 17dvh, 15rem)` dès `md` (170 px au lieu de 240 sur 1 000 px de haut), dégradé adouci, halo de papier derrière le compteur ; `topVeil()` (scene/geometry.ts) règle la zone où les produits réagissent | `5d8a696` |
| Ligne visible sous le flou du parcours | `FrostedEdge` : 6 calques de flou de 0,5 à 16 px sur des bandes qui se recouvrent, teinte papier adoucie, hors de l'entrée animée de la colonne | `5d8a696` |
| Ligne du compteur rechargée à chaque catégorie | les puces Marques et Catalogue A–Z ne bougent plus ; seuls les mots du libellé changent, sa case garde la largeur du plus long | `5d8a696` |
| Entrée de la popup bizarre | « Fondu porté », choisi sur maquette animée : fondu et glissement de 8 px en 220 ms, sans balayage ni rebond ; sortie en 140 ms, `POPUP_OUT_MS` 180 | `6fd52ff` |
| Images des cartes de step en retard | photos de la question suivante détourées à l'avance (réponses actuelles, survol, clic), attendues par le préchargeur sur la première question, gardées d'une visite à l'autre (Cache Storage `shapepick-cutouts-v1`) | `493b01b` |
| Mentions légales trop « IA » | FR et EN au « nous » et au « vous », phrases courtes, sans accroche | `0862f16` |
| Mention Amazon à alléger | imposée mot pour mot par l'accord Partenaires (art. 5) : gardée, seule sous le prix de la fiche | `0862f16` |
| Identité de l'éditeur | nom, adresse et téléphone de l'utilisateur (LCEN, art. 1-1, I), numéro en lien `tel:` | `646fb65` |

| Marque | Ajoutés | ASIN | Vue de dessus sur le canvas |
| --- | --- | --- | --- |
| ZOWIE (souris, nouvelle marque) | 11 : EC1/2/3-DW, FK1/FK2-DW, ZA12/13-DW, S2-DW, U2, U2-DW, EC3-CW | 9 | 11 |
| Corsair (souris) | 14 : SABRE v3 et v2 PRO, M75, NIGHTSABRE, DARKSTAR, SCIMITAR ELITE, NIGHTSWORD v2, HARPOON v2 | 10 | 10 |
| ASUS ROG (claviers) | 14 : Azoth, Falchion, Strix Scope II, Strix Morph 96, Falcata ; 12 switchs NX, RX et HFX | 11 | 13 |
| Akko (claviers, nouvelle marque) | 8 : 5075, 5087, 5098 et 5108 V5, en HE et TMR ; 5 switchs | 0 | 8 |
| NuPhy, Glorious | 0 : 429 dès la première requête, non contourné | — | — |

Les modèles écartés n'ont pas de dimensions officielles (Corsair M65, KATAR, IRONCLAW), de prix officiel en euros (ZOWIE filaires, plusieurs ROG) ou de fiche en texte (TAC75 HE et d'autres Akko). Les ASIN ROG aux préfixes anciens sont justes : ASUS réutilise ses anciennes fiches Amazon. Adaptateurs : `sources/mice/zowie.ts`, `sources/mice/corsair.ts`, `sources/rog.ts` et `sources/akko.ts`.

Le catalogue s'est fait dans une session à part, sur sa branche `claude/stoic-yalow-e442fa`, fusionnée ensuite dans `main`. Seed de production en 10 min, à partir des données commitées (`SEED_DATA_DIR`) : 40 marques, 244 switchs, 545 claviers, 264 écrans, 174 souris. Sitemap : 2 070 → 2 164 URL.

## Retours du 24 octobre (nuit) : bande du haut, givre, moteur et audit

Cinq retours, traités le 24 octobre au soir : la jonction et l'entrée de la bande du haut, le givre du Parcours trop lourd avec la liste des marques dessous, « Continuer » qui pose encore une question quand il ne reste qu'un résultat, et un audit du moteur souris et écrans. Le passage catalogue ↔ canvas sans rechargement est reporté (choix de l'utilisateur). Commits `82a4962`, `429c0d2`, `114b043` et `49a8926` sur `main` : les deux premiers sont partis avec le push d'une autre session (`73cf716`), les autres ont été poussés le 24 octobre à 20:08 UTC (`73cf716..24d7ce6`), en ligne 50 s plus tard. Plan : `~/.claude/plans/j-aimerai-que-tu-explores-mighty-quokka.md`.

| Sujet | Changement | Fichiers |
| --- | --- | --- |
| Bande du haut | Une seule courbe lisse (smootherstep, 17 arrêts, 0,96 en haut), plus haute : `clamp(10rem, 24dvh, 16rem)`. Les rangées de points sortent sur cinq rangées au lieu de deux. Entrée en fondu seul dès le montage, sur ce qui reste de l'ouverture (`useArrivalSpan`) : plus de bord qui monte. Elle part avec la page vers l'accueil et reste en place d'une catégorie à l'autre. | `Finder.tsx`, `navigation.ts`, `geometry.ts` (`topVeil`), `renderer.ts` (`PICK.veil` 0,5) |
| Givre du Parcours | Variante « B · Givre léger », choisie sur une maquette animée : 3 couches (1, 2,5 et 5 px) au lieu de 6 (jusqu'à 16 px), voile papier 0,66 au lieu de 0,92, partie pleine 62 %, plus étroit. Un halo papier léger entoure les mots de la colonne : à 0,55, un libellé gris sur une souris sombre tombait à 2,4:1 de contraste. | `FrostedEdge.tsx`, `JourneyRail.tsx` |
| Liste des marques | Le halo du compteur isole son bloc : le z-index 30 de la liste n'y comptait plus et le givre la floutait. Le bloc compteur passe en z-index 2 dès md. | `Finder.tsx` |
| Moteur | Une question qui ne peut rien changer saute : avec un seul produit (ou aucun), même une question qui ne fait que classer ; la prise quand son critère ne pèse pas (Nomade) ou note pareil tout ce qui reste (verticales, trackballs), via le champ `feeds` des étapes. Égalité pour le tour des marques : même % affiché et même % de fit. Ex æquo exacts départagés par une empreinte de l'id, plus par le nom. Champ `exempt` : la taille et le poids laissent passer les trackballs quand la forme répondue en garde. | `engine.ts`, `types.ts`, `mice.ts`, 112 tests |
| Catalogue | Ses liens vers le finder et vers les fiches reprennent le parcours mémorisé (ajouté après hydratation, HTML servi inchangé). Un finder ouvert sans réponse n'écrase plus ce parcours. | `CataloguePage.tsx`, `CatalogueIndex.tsx`, `CollectionView.tsx`, `finder/journey.ts`, `search.ts`, `Finder.tsx` |

### Audit du moteur (souris, écrans)

Aucun produit n'est inatteignable : chacun a au moins une suite de réponses réalistes qui le garde. Audit délégué à un agent, sur le vrai moteur et les vraies données (174 souris, 264 écrans, 545 claviers) ; scripts relançables dans le scratchpad de la session (`audit/run.sh before|after`).

| Meilleur rang atteignable | Souris (174) | Écrans (264) |
| --- | --- | --- |
| n°1 | 143 | 200 |
| 2e ou 3e | 26 | 56 |
| 4e à 12e | 5 : variantes dominées (ZOWIE FK2-DW, S2-DW, U2 ; Pulsar X3 CrazyLight Medium, X2H v3 ES Medium) | 8 : écrans de bureau d'entrée de gamme dans des usages de jeu |
| n°1 avec le filtre sur sa marque | 161 | 238 |

Efficience : une réponse coûte au plus 1,3 ms (souris), 2,5 ms (écrans) et 6,4 ms (claviers) au 95e centile sur 200 états en Node. Le pire, 7,1 ms, est la question d'usage des claviers : un classement complet par tuile pour ses photos. Rien au-delà de 8 ms ; sur un téléphone moyen, cette étape monterait vers 20 à 35 ms.

Bugs corrigés, avant → après : la prise posée avec une souris ou moins, 15 cas → 0 ; en Nomade, 434 visites simulées sur 2 000 → 0 (la prise est posée 1 487 fois au lieu de 1 934) ; le tour des marques qui inversait des fits différents d'au moins 1 point, 15 listes sur 188 → 0, diversité des marques du top 5 inchangée (3,22 contre 3,23) ; 10 égalités exactes multi-marques dans un top 5, dont 8 rangées par ordre alphabétique (un n°1), départagées désormais sans le nom ; les 2 trackballs qu'une réponse de taille écartait restent quand la forme les garde. Les tops bougent à peine : même n°1 pour les 108 personas souris et 70 sur 72 côté écrans ; n°1 possibles 143 → 142 souris et 200 → 197 écrans, des AOC perdant leur avantage alphabétique sur des ex æquo exacts.

Propositions, à valider :

| Proposition | Type | Constat |
| --- | --- | --- |
| Remplir le prior (note éditoriale, popularité) | Données | 0,5 pour les 983 produits : il ne joue jamais. Tops serrés (médiane de 3 à 6 produits à 3 points du n°1). C'est ce qui départagerait la Superlight 2 (n°14) ou la Viper V3 Pro (n°8) des Corsair Sabre, 4 sur 5 en compétitif taille moyenne |
| Donner un usage aux collections SEO | Recalibrage | 84 collections sur 92 classées au profil par défaut : USB-C, KVM, pivot, HDR et OLED n'ont aucun modèle sur 5 en commun avec leur usage naturel ; claviers : Keychron et Lemokey prennent 7 places sur 10 en médiane |
| Claviers de bureau sans `build` | Recalibrage | 7 Epomaker dans le top 10, MX Keys S n°84 ; sans ce critère, MX Keys S n°15 et Wave Keys n°4 |
| Multi-appareils des souris | Données | `hosts` absent pour 133 souris sans fil sur 140 ; renseigné, la MX Master 3S passe de 90 à 98 % |
| Montrer les plus proches sur une page de résultats vide | Interface | 139 états souris et 79 d'écrans tombent à 0 par le budget ; tous ont des produits proches, que le podium montre déjà |
| Écrans Création | Recalibrage, données | `color` vaut 1 pour 90 écrans sur 164 : des OLED de jeu passent devant les BenQ SW (n°17) ; sans contraste et avec une couleur moins plafonnée, la SW272U remonte n°8. Il manque l'Adobe RGB |
| Boutons en Jeu polyvalent | Recalibrage | Sous 0,35 pour 110 souris sur 174 mais jamais cité : une pénalité cachée de 13 à 26 % du fit face à une souris MMO |
| Clavier nomade | Recalibrage, données | Autonomie lue en mAh : la MX Keys Mini est n°203 ; un score « basse consommation » la met n°13 |
| Fiches des écrans | Données | 15 temps de réponse absents hors OLED (BenQ XL2586X+ n°6 en FPS 24 pouces), 100 couvertures P3, 54 versions HDMI, 58 pieds notés 0,1 ou moins |
| Prise : peser plus, ou caler le modèle (lot G) | Recalibrage | Même n°1 quelle que soit la prise dans 19 personas sur 24 ; top 3 inchangé dans 35 % des visites |
| Bandes de taille des souris | Recalibrage, données | Bande « grande » large de 4 mm ; G502 X, Basilisk V3 Pro et MX Master 4 en « très grande », M650 L en « petite » |
| Fiches des souris | Données | 22 souris de bureau sans fréquence (capteur à 0,5), 4 sans fil sans `power`, 6 Corsair sans `buttons`, année connue pour 6 sur 174 |
| Exemples des tuiles d'usage | Efficience | 4 ms au 95e centile chez les claviers : à mettre en cache |
| Modèles proches | Code | `similar.ts` départage encore par ordre alphabétique |

Catalogue sans rechargement, cartographié mais reporté : passer les routes catalogue sous le layout `/$lang` (adresses inchangées), une scène en mode « document » (canvas en pause sous une feuille), un header qui suit la vue, le préchargeur exempté ; ces pages porteraient alors les 3 catalogues (≈ 1,2 Mo de HTML) jusqu'au lot « poids des pages ».

Vérifié en Chrome headless (CDP) sur un serveur local : jonction header / canvas avant et après à 1440×900 ; opacité de la bande image par image (accueil → souris : 0 → 1 sans translation ; souris → accueil : 1 → 0 en 0,3 s ; souris → claviers : reste à 1) ; liste des marques nette au-dessus du givre à 1440×900 et 1280×720 ; libellés lisibles sur des formes sombres glissées dessous ; Logitech + main gauche + « Ergonomique » → Continuer → résultats ; liens du catalogue avec le parcours, HTML servi sans ; aucune erreur console ; 390×844 inchangé hors l'entrée. Rejoué sur shapepick.com après le push : mêmes résultats, collection « petites mains » sans trackball, aucune erreur console.

## Suites de l'audit (25 octobre)

Quatre changements du moteur et du Finder sont en ligne depuis le 25 octobre à 11:04 UTC (`f8fd527`, 54 s après le push). Les notes de la presse sont écartées et le point 4 de l'audit (données manquantes) reste à faire. Pas de migration ni de seed : rien dans `data/`.

| Commit | Changement | Effet |
| --- | --- | --- |
| `fa104b8` | Page de résultats vide : les 3 produits les plus proches (`nearMisses`) sous « Aucun modèle… », cartes en pointillés, « Écarté par · X », sans rang ni %. Carte partagée `RunnerUp`. | Souris : des produits proches existaient dans 147 états sur 147 à budget trop bas, sans être montrés. |
| `2c05565` | Profil clavier « Bureau & frappe » sans `build`. | MX Keys S n°127 → n°18, Wave Keys n°64 → n°5, ERGO K860 n°129 → n°20 ; en AZERTY 100 %, Logitech passe de 3 à 5 dans le top 10. |
| `2a1b723` | Couleur des écrans en points de P3 au-dessus de 70 %, sur 40 : calibration d'usine 8, 10 bits 4 ; 1 = 98 % de P3 avec les deux. « Création » sans contraste, marquage OLED 0,5. | En 27" : SW272U n°17 → n°6, PD2770U n°18 → n°7, OLED de jeu n°1-5 → n°9-11 ; couleur à 1 pour 63 écrans sur 164 renseignés (90 avant). |
| `0d1fd8b` | Prior centré sur 0,5, 2 points au plus dans un sens ou dans l'autre (`PRIOR_REACH`) ; `priorTellsApart` supprimé. | Aucun : toutes les notes valent 0,5. |
| `f8fd527` | Fusion d'`origin/main` (photos, ROG, police, prix Royal Kludge). Conflit dans `ResultsView.tsx` : l'espacement -0,01em du titre de carte reporté dans `RunnerUp`. | — |

Vérifié : tests catalog 115/115 (5 nouveaux), ingest 46/46, typecheck web, Biome sur les fichiers touchés, build. En ligne : la page vide souris ≤ 5 € montre « Juste derrière » ; l'ordre Création 27" est celui de la simulation (XG27JCG, S90PC, 274URDFW, S80PB, U2725QE, SW272U…).

### Audit relancé sur le catalogue agrandi

Même moteur que le 24 au soir, avec 467 souris (+293) et 685 claviers (+140). La réplique rapide donne les rangs du vrai `rank()` (934/934 souris, 528/528 écrans, 600/600 tirages).

| Mesure | 24 octobre (174 souris, 545 claviers) | 25 octobre (467, 685) |
| --- | --- | --- |
| Souris jamais sur le podium | 5 | 78, dont 49 nouvelles et 58 avec un quasi-doublon |
| Souris à 3 points ou moins du n°1 (médiane / max) | 3 / 16 | 5 / 75 |
| Claviers à 3 points ou moins du n°1 (médiane) | 6 | 7 |
| Superlight 2, compétitif symétrique moyenne griffe | n°6 | n°38 |
| Validation d'une réponse, souris (p95) | 1,4 ms | 3,6 ms |

Ce qui bat les 78 souris : multi-appareils (30), capteur (27), légèreté (10). En compétitif, G-Wolves prend 5 places du top 10. Rapport et listes complètes : `audit-suite-rapport.md` et `audit-suite-trous.txt` dans le dossier de notes partagé (`~/Library/Application Support/Claude/side-session-notes/local_8b9d2ee1-87d6-49fb-88c3-05b9ac9dfd4e`) ; scripts dans le scratchpad de la session (`audit/run.sh`, `scripts/gaps.mts`).

### Trous de données (point 4)

Traités le 25 octobre après-midi sur la branche `claude/audit-donnees-fee473`, pas encore en ligne : voir « Données manquantes (point 4, 25 octobre) ». Les chiffres ci-dessous sont ceux d'avant.

- `power` absent sur 29 souris sans fil (25 nouvelles) : « Batterie rechargeable » les écarte, même à piles (M185, M510, Kensington…), et leur autonomie se lit à 70 h.
- `hosts` absent sur 326 souris sans fil hors Logitech : 2 par défaut pour 147 (2,4 GHz + Bluetooth), 1 pour 203 (2,4 GHz) et pour 2 (Bluetooth seul, écartées par « Multi-appareils »).
- `pollingHz` absent sur 37 des 55 souris de bureau : la médiane des renseignées (125 Hz) leur donne 0,1 en capteur au lieu de 0,5.
- ASUS ProArt MD300 : 1 bouton latéral, aucune option de « Boutons » ne la garde.
- 14 claviers mécaniques sans switch (Ajazz 6, Womier 6, Chilkey Foxy 65, RK R87 Pro) : « Ressenti » les écarte.
- Écrans : 15 temps de réponse (dont BenQ XL2546X+, XL2566X+, XL2586X+), 58 écrans sans aucun champ de pied (MSI 19, AOC 18, LG 15), 100 couvertures P3, 54 versions HDMI.

### Notes de la presse, écartées

Lues : 17 guides de Tom's Hardware, PC Gamer et Clubic, mis à jour entre décembre 2025 et octobre 2026. 64 fiches citées (31 souris, 19 claviers, 14 écrans) : 0,75 pour une rédaction, 1 pour deux. Effet simulé : top 5 changé pour 21 personas souris sur 108 et 10 écrans sur 72. Écartées par l'utilisateur : 22 des 31 souris sont des Logitech ou des Razer, aucune petite marque, aucun clavier de bureau. Le correctif reste réapplicable : `audit-suite-presse.patch` dans le dossier de notes partagé (`git apply`). RTINGS réserve ses choix aux abonnés ; Les Numériques, Frandroid, 01net, Numerama, JVTech, IGN, PCMag, The Verge et le NYT bloquent l'agent.

### À savoir

- L'outil de l'app qui synchronise un worktree avec `main` a échoué deux fois au fetch de GitLab : fusion faite à la main.
- Base locale à part `choose_audit_suite` (Postgres du port 54329, catalogue du 25 octobre) : `dropdb -h localhost -p 54329 -U choose choose_audit_suite` quand elle ne sert plus.

## Catalogue agrandi et photos (25 octobre)

Le catalogue compte depuis le 25 octobre 685 claviers (61 marques), 264 écrans (8) et 467 souris (41) : 293 souris et 140 claviers ajoutés sans fiche officielle relue, puis leurs photos officielles. Tout est en ligne et semé en production ; ces travaux viennent d'autres sessions que celle qui écrit ce paragraphe, d'après leurs commits.

| Commit | Changement | Production |
| --- | --- | --- |
| `b5ccc51` | Ingest : `pnpm ingest <source> --only slug,…` n'importe que les modèles nommés ; boutique Royal Kludge lue par le lecteur Shopify générique | — |
| `91515e5` | 293 souris (41 marques en tout) et 140 claviers sans fiche officielle relue, dans `<marque>-complements.yaml` à côté d'un fichier officiel, sinon un fichier par nouvelle marque ; 9 claviers Royal Kludge lus sur la boutique officielle ; 4 switchs génériques (Linéaire, Tactile, Clicky, Linéaire silencieux) | seed de 09:13 à 09:27 UTC |
| `8edeb5b` | 46 collections SEO sur 92 classées pour l'usage qu'elles promettent (USB-C et KVM : bureau ; 144 à 480 Hz : FPS ; OLED et HDR : jeu immersif), titre « Classement · <usage> » | seed à 10:04 UTC, avec `4470886` |
| `4470886` | Nombre d'appareils des souris Logitech de bureau lu sur leurs fiches (MX Master 4, 3S Bluetooth, Lift… : 3) | idem |
| `106f971` | Photos officielles des modèles ajoutés : souris 239 sur 293 (115 avant), claviers 73 sur 131 (19 avant) ; 5 hôtes d'images ajoutés (`hosts.ts`, `netlify.toml`) ; les 5 souris ROG copiées gardent « ROG » | seed depuis `d778928`, validé vers 10:47 UTC |
| `3e39c77` | Royal Kludge : la boutique donne ses prix en euros TTC, lus tels quels au lieu d'être convertis comme des dollars (R65 : 85 → 70 €) | seed lancé à 10:58 UTC ; R65 à 70 € en ligne |

Les fiches ajoutées n'ont pas de sources : elles se remplacent par un import officiel (`pnpm ingest <marque> --only …`, après avoir retiré la copie). Restent dessinées : VAXEE (défi Cloudflare), NuPhy (429), les modèles que leur marque ne montre plus et les petites marques sans boutique officielle. Leurs données manquantes (clics silencieux, molette, RGB, boutons) sont le point 4 de l'audit.

## Favicon, police, ROG et image de partage (25 octobre)

Nouveau favicon, police Hubot Sans, titre de l'accueil remonté et noms ROG : en ligne depuis le 25 octobre (`894359f` à `f20ab78`, puis `3bf7934` pour l'image de partage), vérifiés sur shapepick.com. Pas de migration ; les noms ROG sont arrivés par le seed de `d778928` (voir la section précédente).

| Commit | Changement |
| --- | --- |
| `894359f` | « ROG » dans le nom des 14 claviers et 11 souris ASUS ROG officiels (« ASUS ROG Azoth », pas « ASUS Azoth »), comme les écrans « ROG Strix… » et les souris « TUF Gaming… » ; `sources/rog.ts` et `sources/mice/asus.ts` gardent le préfixe ; adresses inchangées. Avant, chercher « rog » ne trouvait rien |
| `92a0306` | La recherche du filtre des marques trouve aussi une marque par ses modèles (début d'un mot, accents ignorés) : « rog » ou « azoth » montrent ASUS et les modèles trouvés à côté ; champ « Marque ou modèle » (`BrandFilter.tsx`, `modelsByBrand` dans `useFinder.ts`) |
| `952e777` | Favicon « S câblé » : écran, clavier et souris forment le s, les câbles orange en pistes à 45°, tuile encre aux coins coupés, curseur orange à l'écran ; `favicon.svg?v=2`, `favicon.ico` (16, 32, 48) et `apple-touch-icon.png` (180) |
| `f20ab78` | Police Hubot Sans au lieu d'Inter Tight (Geist Mono ne change pas) ; interlettrage desserré là où il était serré (titre de l'accueil -0,035 → -0,015 em) ; taille des noms de catégories estimée à 0,66 em par lettre (0,58 avant) ; titre de l'accueil remonté sur grand écran (`pb` 14dvh → 22dvh) |
| `3bf7934` | Image de partage v3 : titre en Hubot Sans, 57 px pour ne pas toucher l'écran ; `default-{fr,en}-v3.png`, v2 supprimées, paquet Inter Tight retiré |

Choix de l'utilisateur, sur maquettes à taille réelle : le favicon parmi quatre pistes (S câblé, écran « s », médiator, trio), puis sa version anguleuse (« moins rounded, plus cyberpunk ») ; la police parmi Hubot Sans, Hubot Sans étroite, Chakra Petch et Saira. Le zéro de Hubot Sans est barré d'un trait horizontal, sans variante.

Vérifié en ligne : favicon, `.ico` et icône iOS servis ; feuille de style en Hubot Sans seule ; API 14/14 claviers ASUS et 16/16 souris ROG nommés « ROG … », fiche « ASUS ROG Azoth, clavier 75 % mécanique » ; filtre des marques « rog » → ASUS (014) ; pages FR et EN sur `default-*-v3.png`, servies à l'octet près, v2 en 404.

## Données manquantes (point 4, 25 octobre)

Le point 4 de l'audit : ce qui manque dans les fiches, cherché à la source. 5 commits sur la branche `claude/audit-donnees-fee473` (sur `11f2fdb`), ni poussés ni seedés : une valeur ne se voit en ligne qu'après le seed de production. Chaque valeur a sa source en commentaire au-dessus de `specs:` (ou de `variants:` pour un switch), au format de `4470886`.

| Commit | Lot | Valeurs |
| --- | --- | --- |
| `8c9a92c` | Souris : alimentation (24 sur 29), appareils (16), autonomie (33), boutons (17) | 94 |
| `18fbf64` | Claviers : polling filaire (33), appareils Bluetooth (37), batteries (12), poids (5) | 87 |
| `ce4e036` | Claviers : switch de Womier WK75, L65, MT75, X98 (générique linéaire) et RK R87 PRO | 9 variantes |
| `9e589ba` | Écrans : temps de réponse Samsung (6), pieds MSI PRO MAX et LG 24MS550 (6), DCI-P3 (5), HDMI (25) | 52 |
| `411b3c0` | Souris : autonomie (15), boutons (10), polling (2) de 24 souris de plus | 27 |

Sources : le cache de l'ingest d'abord, puis les fiches des marques, avec l'agent de l'ingest, 3 à 4 s entre deux requêtes et robots.txt. Refus non contournés : ir.corsair.com, www.elecom.co.jp et dl.razerzone.com (403), mysupport.razer.com (robots.txt).

### Effet (même moteur, données avant → après)

| Mesure | Avant | Après |
| --- | --- | --- |
| Souris sans fil sans `power` | 29 | 5 |
| Souris Bluetooth hors Logitech sans `hosts` | 143 | 127 |
| Claviers mécaniques sans switch | 14 | 9 |
| Claviers magnétiques sans polling | 31 | 18 |
| Écrans sans temps de réponse (hors OLED) | 15 | 9 |
| Écrans sans version HDMI | 54 | 29 |
| Personas souris dont le n°1 change | — | 16 sur 108 |
| Personas écrans dont le n°1 change | — | 3 sur 72 |

Souris : Keychron G5 n°1 en jeu symétrique moyenne (Sabre v3 Pro PureVector avant), Rapoo VT3S Gen-2 en jeu ergo moyenne, Darmoshark M5 en nomade petite (Keychron M4 : 67 h). Écrans : Samsung G5 G50F n°1 en FPS 32" (1 ms GtG), MSI PRO MAX 271QPHW en bureau 27" ≤ 300 €. Claviers : n°1 inchangés. Les 52 écrans sans champ de pied restants ont un pied fixe, d'après leur fiche.

### Pas à la source, ou à décider

- Restent vides : 5 `power` (Kensington Orbit Fusion et Orbit Wireless Mobile, Razer Basilisk X HyperSpeed et Naga V2 HyperSpeed, ROG Harpe Ace Extreme) ; `pollingHz` des 37 souris de bureau (Logitech donne un intervalle, 7,5 ms, sur support.logi.com) ; 6 switchs Ajazz (nommés, ressenti jamais écrit), Womier VK75 et SK75, Chilkey Foxy 65 ; 9 temps de réponse (MPRT seul, ZOWIE rien) ; 95 DCI-P3 (sRGB ou NTSC seulement) ; 29 HDMI (AOC « 2.1 TMDS », LG « Oui » sans version).
- À décider : la question « Boutons » ne garde pas l'ASUS ProArt MD300 (1 bouton) : « 2 » pourrait devenir « 1 ou 2 ». Le Royal Kludge R87 PRO mêle le filaire et le sans-fil. Pro Click Mini en `gaming`, Chakram X à 1 000 Hz (8 000 en filaire), ERGO M575S à 2 appareils par défaut : non corrigés.
- Rapport, listes et tableaux complets : `audit-donnees-rapport.md`, `audit-donnees-trous-avant.md`, `audit-donnees-trous-apres.md` dans le dossier de notes partagé (`~/Library/Application Support/Claude/side-session-notes/local_35da7c6d-efa0-43e8-9ba0-b5af248ac412`).

## SEO et i18n

Le site est prêt à se classer depuis le 24 octobre : 2 164 pages indexables (accueils, catégories, catalogues A–Z, 92 collections par langue et une fiche par produit, en français et en anglais) sur shapepick.com, avec `robots.txt`, `sitemap.xml`, données structurées et cartes de partage (socle `0b69127`, fiches `1e4d0bf`, voir « SEO : fiches produit, nom et domaine »). L'audit du 23 octobre, ci-dessous, décrit l'état d'avant ; celui du 24 octobre est dans « Audit et lot 1 (24 octobre) ».

Chaque page est rendue côté serveur avec son titre, sa description, une URL canonique et les liens `hreflang` FR/EN. Les chemins sont traduits ; les clés des paramètres restent en anglais dans les deux langues.

| URL | Rôle |
| --- | --- |
| `/` | Redirection 302 vers `/fr` ou `/en` selon `Accept-Language` |
| `/fr`, `/en` | Accueil |
| `/fr/claviers`, `/en/keyboards`, `/fr/ecrans`, `/en/monitors` | Parcours (de même /fr/souris, /en/mice) ; titre du type « Quel clavier choisir ? 523 modèles comparés en 9 questions · shapepick » |
| `/fr/claviers/<slug>`, `/en/keyboards/<slug>` (de même écrans et souris) | Fiche produit ouverte par-dessus le parcours ; titre du type « Wooting 60HE V2, clavier 60 % magnétique · shapepick » ; 404 pour un slug inconnu ou d'une autre catégorie |
| `/fr/claviers/catalogue`, `/en/keyboards/catalogue` (de même écrans et souris) | Catalogue A–Z : tous les modèles par marque, lié depuis le finder (« Catalogue A–Z ») ; chaque fiche est à deux clics d'une catégorie (24 octobre au soir) |
| `/fr/claviers/catalogue/<collection>`, `/en/keyboards/catalogue/<collection>` | Collection tirée des réponses du questionnaire (« Claviers 75 % sans fil », « Souris pour gaucher »…), classée par le moteur, avec ItemList et BreadcrumbList ; 92 par langue, 6 produits au moins chacune |
| `/api/catalog/keyboard`, `/api/catalog/monitor` | Snapshot JSON avec ETag, cache 60 s puis 600 s en stale-while-revalidate |
| `/sitemap.xml`, `/robots.txt` | 2 164 URL avec hreflang et x-default, lastmod de la catégorie ; robots.txt autorise tout sauf /api/ et donne l'adresse du sitemap |
| Toute autre langue ou catégorie | 404 |
| `choose-a-device.netlify.app/*` | 301 vers la même adresse sur shapepick.com (pages seulement : /api/ et /_serverFn/ répondent sur place) |
| `/fr/mentions-legales`, `/en/legal` | Mentions légales et confidentialité (24 octobre) ; la mauvaise langue redirige en 301 |
| `/api/out` | POST : un clic sur un lien Amazon, écrit dans outbound_clicks ; GET en 405 (24 octobre) |

- **Paramètres** : chaînes simples, virgules non encodées (`?size=full,f96&layout=azerty`). `at=<étape>` rouvre une étape, `at=done` affiche les résultats ; il s'accompagne de from=<étape>, l'étape d'où ils ont été ouverts, où « Modifier mes réponses » revient.
- **Canonique** : une URL de parcours avec réponses pointe vers la page de catégorie, une fiche avec réponses vers sa propre adresse sans réponses, pour ne pas indexer chaque combinaison.
- **Changement de langue** : garde la catégorie, la fiche ouverte et les réponses (`/fr/claviers?…` ↔ `/en/keyboards?…`).
- **Textes** : interface dans `apps/web/src/i18n/messages.ts` ; questions, options et critères dans `packages/catalog`, toujours sous la forme `{ fr, en }`.

### Audit du 23 octobre

Mesuré sur le site en ligne (`curl`, Chrome headless en mobile émulé) et sur la build de production lancée en local.

| Point | Constat |
| --- | --- |
| En place | Rendu serveur, URL traduites, `lang`, un titre par page, canonical vers la catégorie pour les URL à réponses, 404 sur une URL inconnue, cache CDN Netlify |
| Erreur d'hydratation | Sur `*.netlify.app`, Netlify ajoute un saut de ligne et un commentaire (« This site is hosted on Netlify… ») après la meta charset. React échouait à hydrater (erreur #418) et refaisait chaque page dans le navigateur. Corrigé dans le dossier local : un script de `routes/__root.tsx` retire ces nœuds avant l'hydratation (vérifié sur la build de production en local, pas encore poussé) |
| `robots.txt`, `sitemap.xml` | 404 tous les deux |
| `hreflang`, canonical | Relatifs (`/fr`, `/en/keyboards`) : Google ignore un `hreflang` sans URL complète. Pas de `x-default` |
| Partage (Open Graph, Twitter) | Seul `og:title`, sur les pages catégorie : ni image, ni description, ni URL |
| Meta description | La même sur l'accueil et les deux catégories |
| Données structurées | Aucune |
| Contenu indexable | 6 pages (accueil et 2 catégories, en FR et EN), de 500 à 1 100 caractères de texte. Les produits sont sur le canvas ou dans le tiroir : aucune URL produit, aucune `<img>` |
| Vitesse | LCP 3,4 s sur mobile émulé, réseau non bridé (preloader, hydratation ratée). Réponse en 0,6 s depuis le cache, jusqu'à 4 s à froid |
| Poids des pages | 740 Ko de HTML (≈ 70 Ko en Brotli), dont 715 Ko de catalogue en JSON dans chaque page |
| Domaine | Sous-domaine `choose-a-device.netlify.app` |

### À faire, par priorité

**Priorité 1** : les bases techniques, avant de chercher du trafic.

- [x] Pousser le correctif d'hydratation, puis vérifier en ligne qu'aucune erreur #418 n'apparaît dans la console.
- [x] `robots.txt` (tout autoriser sauf `/api/`, lien vers le sitemap) et `sitemap.xml` (accueils et catégories FR/EN, puis les fiches produit), servis par des routes serveur.
- [x] `hreflang` et canonical en URL absolues, plus un `hreflang="x-default"`.
- [x] Open Graph et Twitter sur chaque page (titre, description, URL, image, `og:locale`) et une meta description propre à chaque page.

**Priorité 2** : le contenu qui peut se classer.

- [x] Phase 5 : une fiche produit indexable par produit (`/fr/claviers/<slug>`, `/en/keyboards/<slug>`) avec la photo en `<img alt>`, les specs, un JSON-LD `Product` et des liens `<a href>` depuis le podium, les résultats et la fiche (proposée comme session séparée le 23 octobre).
- [x] Pages collections, faites le 24 octobre au soir (`7af8928`) : catalogue A–Z par catégorie, lié depuis le finder, et 92 collections par langue tirées des options du questionnaire (« Claviers 75 % sans fil », « Souris pour gaucher »…), avec `ItemList` et `BreadcrumbList` ; bloc « Classements » sur les fiches.
- [ ] JSON-LD `ItemList` sur les catégories (`WebSite` sur l'accueil et `BreadcrumbList` sont faits depuis le 24 octobre ; les collections ont le leur depuis le soir).
- [ ] LCP mobile sous 2,5 s (préchargeur retiré des fiches le 24 octobre ; reste la photo de la fiche, vers 5 s) : preloader plus court quand tout est en cache, premier écran sans attendre le catalogue entier.

**Priorité 3** : à prévoir avant le lancement.

- [x] Un domaine propre (shapepick.com), Google Search Console (propriété de domaine validée) et envoi du sitemap : faits le 24 octobre.
- [ ] Ne plus envoyer tout le catalogue dans chaque page : top produits rendu côté serveur, catalogue chargé ensuite.

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
| `pnpm test` | 89 tests du moteur, des parcours et des modèles proches (Vitest) ; pnpm --filter @choose/ingest test en lance 46 (mappers écrans et souris, switchs, variantes) |
| `pnpm typecheck` | `tsc` sur `catalog`, `db` et `web` |
| `pnpm lint`, `pnpm format` | Biome : vérification, puis correction automatique |
| `pnpm pg:local` (ou `stop`, `status`) | Postgres local : port 54329, données dans `.pgdata` |
| `pnpm db:generate`, `db:migrate`, `db:seed`, `db:studio` | Migrations Drizzle, seed YAML, interface de la base |
| `pnpm ingest photos [--dry-run]` | Choisit la photo principale de chaque clavier (vue de dessus) et de chaque écran (vue de face), keyboards, monitors ou mice pour une seule catégorie, et écrit `data/` |
| pnpm ingest \<marque> \[--dry-run\] | Écrans (samsung, lg, dell, msi, aoc, asus, philips, benq) : les 50 plus pertinents de la marque dans data/monitors/\<marque>.yaml, avec la fiche de relecture et les ignorés |
| pnpm ingest \<marque>-mice \[--dry-run\] \[--next 30\] | Souris (logitechg-mice, logitech-mice, razer-mice, steelseries-mice, rog-mice, msi-mice, pulsar-mice, hyperx-mice, turtlebeach-mice) : jusqu'à 30 par marque dans data/mice/\<marque>.yaml, avec la fiche de relecture et les ignorés |
| `pnpm ingest switches [--dry-run] [--accept slug,…]` | Reconstruit depuis les pages en cache les variantes de claviers fusionnées faute de switch, sans toucher couleurs ni dispositions, et écrit data/keyboards/ ; un clavier signalé dans la note de relecture passe avec --accept après vérification (24 octobre) |

- Si `apps/web/styled-system/` manque (dossier généré, non versionné) : `pnpm --filter @choose/web exec panda codegen`.
- Dans l'app Claude, le serveur de prévisualisation « web » est décrit dans `.claude/launch.json` ; « web-local-db » tourne sur le port 3001 avec le Postgres local.
- Semer la base locale alors que le `.env` vise Neon : passer `DATABASE_URL` **et** `DATABASE_URL_UNPOOLED` (le seed et drizzle-kit lisent l'URL directe en premier) ; les variables passées à la commande l'emportent sur le `.env`.

## Mise en ligne : Netlify + Neon

Le site tourne depuis le 20 octobre 2026 sur Netlify, et depuis le 24 octobre sur son domaine, [shapepick.com](https://shapepick.com) (choose-a-device.netlify.app redirige vers lui) : Netlify construit `main` du dépôt GitLab à chaque push, et la base est un Postgres 18 sur Neon (AWS eu-central-1, Francfort), migré et rempli avec les données de démo.

| Élément | Réglage |
| --- | --- |
| Hébergement | Netlify : pages, server functions et API dans une seule Netlify Function (`@netlify/vite-plugin-tanstack-start`), fichiers statiques dans `apps/web/dist/client` |
| Base | Neon, projet `super-night-02529536`, branche `production`, organisation `org-purple-wave-32907016` |
| Lien local | `.neon` (ignoré par git) et `neon.ts` (politique de branches : une nouvelle branche expire après 7 jours) |
| Variables | `DATABASE_URL` (pooler, lue par le site, aussi définie sur Netlify), `DATABASE_URL_UNPOOLED` (directe, migrations et seed) |
| Driver du site | `@neondatabase/serverless` en HTTP quand l'hôte finit par `.neon.tech`, `postgres` en TCP sinon (`packages/db/src/client.ts`) |
| Seed et migrations | TCP direct (`connectDirect`, drizzle-kit sur `DATABASE_URL_UNPOOLED`) : le seed tient en une transaction, ce que le driver HTTP ne sait pas faire |
| Domaine | shapepick.com, acheté via Netlify le 24 octobre (registrar Name.com, DNS chez Netlify), domaine principal du site ; www redirige vers la racine ; certificat Let's Encrypt posé par Netlify |
| Adresse du site | `SITE.url` = `SITE_URL`, sinon la variable `URL` de Netlify (le domaine principal), figée au build : un changement de domaine demande un redéploiement |
| Ancienne adresse | choose-a-device.netlify.app : 301 page pour page vers shapepick.com, faite dans `apps/web/src/server.ts` (Netlify passe la fonction avant les redirections de netlify.toml) ; /api/ et /_serverFn/ répondent sur place |

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
- Search Console : propriété de domaine shapepick.com, validée par un TXT `google-site-verification` dans le DNS Netlify, à ne jamais supprimer ; `sitemap.xml` à soumettre depuis le rapport Sitemaps.

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
| Écrans réels, base locale (23 octobre) | Chrome headless à 1440, 1024 et 390 px, FR et EN : 235 écrans (264 depuis l'ajout des prix ASUS, BenQ, Philips), photos de face sur le canvas, podium, résultats, fiche (luminosité, couleurs, pied), liens Amazon par référence, impasses « Bloqué par Budget », tuile TN masquée |
| Souris, base locale (23 octobre) | 149 souris de 8 marques : seed relancé sans écart, snapshot identique au YAML (523 claviers, 264 écrans, 149 souris) ; parcours essayé sur 7 profils (tableau dans « Souris ») ; 72 tests du moteur dont 19 souris, 26 de l'import ; lecture des claviers inchangée (exports seulement, mêmes 30 claviers Razer). Le site avec des souris n'a été vu que sur la base de démo (29 souris fictives) : catégorie vide ou en échec masquée, /fr/ecrans en 404 quand les écrans manquent, podium et fiche. |
| Souris en production (23 octobre au soir) | Migration 0004 sur Neon (5 migrations, valeur mouse ajoutée) ; build de 184fc39 en ligne en une minute, /fr/souris en 404 tant que la catégorie était vide ; seed : 523 claviers, 264 écrans, 149 souris, aucun produit supprimé ; snapshot de Neon identique au YAML (523, 264, 149) ; /fr/souris et /en/mice en 200 après la revalidation du CDN ; la page en ligne montre « 149 souris correspondent » et la question 1 sur 11, sans erreur dans la console. |
| Mobile (24 octobre) | Chrome headless piloté en CDP, tactile émulé, à 320 × 568, 360 × 780, 375 × 667, 390 × 844, 430 × 932, 667 × 375 et 844 × 390, en anglais à 320 px et en mouvement réduit : le script d'audit ne trouve aucun élément hors de l'écran ou de son conteneur, ni texte coupé. Défilement de l'accueil synchronisé (calque à −156 px pour 156 px défilés), retour depuis une catégorie à la même position, feuilles fermées en les tirant vers le bas, feuille Parcours par-dessus les résultats, les 12 noms Logitech les plus longs entiers sur deux lignes à 320 px. Bureau et tablette (768, 1024 et 1440 px) identiques à la production. Après le push de 19ed09a, même série sur le site en ligne (320, 375 et 390 px, paysage, anglais, mouvement réduit, bureau) : audit vide partout, aucune erreur relevée dans la console. |
| Fiches produit, serveur local (24 octobre) | curl : head, JSON-LD Product (sans offers) et BreadcrumbList, fiche dans le HTML (h1, fiche technique, 4 modèles proches), 404 pour un slug inconnu ou d'une autre catégorie ; sitemap de 1 880 URL validé par xmllint. Chrome headless (CDP) 34/34 : ouverture depuis le podium, le canvas, les résultats et le n°1 mobile, flèches, modèles proches, Retour et Avant, ×, arrivée directe, langue, sans remontage du finder ni erreur d'hydratation. 85 tests du moteur et 26 de l'import, typecheck, Biome et build au vert. |
| Fiches et shapepick.com en production (24 octobre) | Après 1e4d0bf : head, JSON-LD, og:image servie à sa taille, photo du noscript, 404 et sitemap contrôlés en ligne, navigateur 30/30. Après le passage du domaine (25 contrôles sur 25) : canonical, hreflang, og:url, JSON-LD et sitemap sur shapepick.com, og:image et photos relayées (Dell, Samsung, Logitech) servies, ancienne adresse en 301 page pour page, API sur place ; navigateur 30/30 sur shapepick.com, 68 photos d'écrans chargées sur le canvas, aucune requête photo en échec. |
| Lot 1 de l'audit, local (24 octobre) | 84 tests du moteur, typecheck, Biome et build au vert. Route /api/out : 204, 400, 403 pour une autre origine, 405 en GET, robots ignorés ; lignes écrites en base locale pour les 5 emplacements. Slash final en 308, fiche atteinte directement sans préchargeur, script Umami rendu avec ses attributs (ID factice ; Umami retiré le soir même), CLS de l'accueil à 0,001 sur la build de production servie en local. |
| Lot 1 et fac57c1 en production (24 octobre) | Assets en max-age=31536000, immutable ; slash final en 308 et ancienne adresse en 301 en un saut ; pages légales en 200, mauvaise langue en 301 ; image v2 servie ; fiche sans préchargeur ; GET /api/out en 405 et un clic de test écrit dans Neon, pays FR. CLS de l'accueil 0,001. Parcours souris en 9 questions, repères de main dans les tuiles, ancien lien avec handsize en 200. |
| Fusion du soir, local (24 octobre) | Typecheck des 4 paquets, 89 tests du moteur, 46 de l'import, Biome et build au vert sur main ; seed local ; pages relues sur le serveur construit (question des boutons latéraux, comptes du ressenti, catalogues, collections, sitemap). |
| Soir du 24 octobre, en production | Migration 0006, puis seed (38 marques, 227 switchs, 523 claviers, 264 écrans, 149 souris ; 149 avec boutons latéraux), puis push 411f8cd, en ligne une minute plus tard. API : 13 claviers mécaniques ou optiques sans switch ; ressenti linéaire 429, tactile 233 (Topre compris), clicky 117, silencieux 59 ; boutons latéraux 7, 108, 29 et 5 souris. Pages : « Combien de boutons sur le côté ? » affichée (sautée quand les souris restantes ont toutes le même nombre), titre « 149 modèles comparés en 10 questions », catalogues A–Z, collection 75 % (104 modèles), bloc « Classements » des fiches, sitemap de 2 070 adresses, pages principales en 200 ; aucune erreur console. |
| Store ID Amazon en production (24 octobre au soir) | Push a2d631a, en ligne une minute plus tard : 27 liens amazon.fr taggés niji0a-21 sur 27 dans les résultats claviers, écrans et souris (FR et EN), 2 sur 2 dans une fiche, tous en rel="sponsored nofollow noopener" ; mention Partenaire sur la fiche et en pied des résultats ; texte d'affiliation et phrase sur le classement dans /fr/mentions-legales et /en/legal ; aucune erreur console. |
| Retrait d'Umami en production (24 octobre au soir) | Push 4e47f6a (lent côté GitLab, 2 minutes), en ligne seulement 12 minutes plus tard, contre une minute d'habitude, sans incident chez Netlify et avec un build local au vert. Ensuite : /fr/mentions-legales et /en/legal en 7 sections, sans mention d'Umami ni de mesure d'audience, descriptions à jour ; liens Amazon toujours taggés (27 dans les résultats, 2 dans une fiche) ; aucune erreur console. |
| Photos remplacées en production (24 octobre au soir) | Push 97c32d1, build en ligne une minute après, correctif d'atWidth dans le code servi ; seed de production en 8 min 49 s. Ensuite : l'API (sans cache) sert les 40 nouvelles photos, le CDN d'images les livre toutes telles que le canvas les demande, la X3 CrazyLight Medium est « ergonomique » |
| Deuxième lot de photos en production (24 octobre au soir) | Push d5e4bbc, build en ligne 43 s après, nouveaux hôtes dans le code servi ; le CDN d'images livre les photos de Mercular (par le relais), MakeWebEasy et Euro RTV AGD ; seed de production en 8 min 57 s. Ensuite : l'API (sans cache) sert les 7 photos, le CDN les livre, et le canvas des souris ASUS n'a plus aucun dessin |
| Retours et catalogue en production (24 octobre au soir) | Interface : push de 6fd52ff à 646fb65 (avec df86d23 d'une autre session), en ligne 45 s après. Chrome headless en 1728 × 1000 : bande de 170 px avec halo, 7 calques de flou, popup en fondu (sortie jusqu'à 0), puces fixes des claviers aux souris, photos des étapes dès l'affichage pour 5 questions sur 6, deuxième visite en 0,67 s ; mentions légales FR et EN sans « tu ». Catalogue : push 124c2e2, CDN d'images ouvert à Akko, seed en 10 min ; API 174 souris et 545 claviers, sitemap de 2 164 URL, fiches ZOWIE, Corsair, ROG et Akko avec 5 photos et un lien Amazon tagué ; aucune erreur console. |

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
* **Mesurer sous une animation 3D** : à l'ouverture des résultats, le panneau est encore incliné et réduit ; `getBoundingClientRect` y donne des positions faussées. Placer ce qui dépend de la mise en page avec `offsetTop` (la liste virtualisée le fait).
* **Mesures de photo et résolution** : le « détail » d'une photo (part de ses points sur une arête) se lit sur une grille d'environ 400 points, sinon une même photo en 3 840 px (Logitech en direct) passe pour « sans détail » alors qu'elle en a en 800 px (via l'Image CDN).
* **Revue des photos choisies** : `pnpm ingest photos` peut prendre une bannière, un schéma ou un collage pour une vue de dessus ; après chaque passage, regarder les photos principales changées (planche contact) et compléter `photos:` dans `data/excluded.yaml`.
* **Pousser `main` déploie aussitôt** : une migration qui ajoute une colonne lue par le snapshot doit passer avant le push. Le 23 octobre, ad9f146 poussé avant la migration 0003 a mis tout le site en erreur 500 (colonne `height_adjustable` absente) jusqu'à `pnpm db:migrate`.
* **Lire une fiche de souris** : Logitech bureau appelle « Hauteur » la longueur et « Épaisseur » la hauteur ; une page de gamme peut mesurer une autre taille (celle de la M750 L mesure la M750) ; un récepteur « compatible » ou « non inclus » n'est pas une liaison 2,4 GHz ; SteelSeries recopie parfois la fiche d'un modèle voisin (Sensei Pro et Rival Pro : la forme vient du paramètre mouse-shape de l'URL) ; les pages ROG citent la presse, aucun poids n'est lu dans leur texte.
* **Mesures en image** : Zowie et Keychron ne publient les dimensions de leurs souris qu'en image ; sans mesures, une souris attend (« sans dimensions » dans la fiche de relecture).
* **Shopify et le 429** : une rafale de sondages a fait limiter l'agent sur toutes les boutiques Shopify le 23 octobre au matin (levé le soir). 4 s entre deux pages pour turtlebeach.com, keychron.com et eu.pulsar.gg (http.ts), cache d'abord.
* **Seed sans data/mice** : un seed lancé d'un dossier qui n'a pas encore les souris voudrait les supprimer toutes ; le garde-fou par catégorie refuse, ne jamais le forcer. Toujours seeder la production depuis le main à jour.

- **Panda, ordre des media queries** : `md` et une condition maison (`_short`, `_coarse`…) n'ont pas d'ordre garanti dans le CSS généré ; quand deux règles se contredisent, écrire une requête combinée explicite (`@media (min-width: 48rem) and (min-height: 30.01rem)`). Pas de clé calculée dans `css()` non plus : l'extraction statique ne la voit pas.
- **Survol au doigt** : `_hover` et `_groupHover` ne s'appliquent que sous `(hover: hover)` (conditions redéfinies dans `panda.config.ts`) ; les aperçus au survol (tuiles, marques, bandes de l'accueil) ne réagissent qu'à `pointerType === 'mouse'`.
- **Accueil qui défile** : ne jamais placer les bandes depuis un écouteur `scroll` ; le renderer lit `window.scrollY` dans sa boucle et déplace le calque des liens dans la même image, sinon plaques et dessin se décalent pendant un lancer.
- **Redirections chez Netlify** : la fonction qui sert tout le site (`path: "/*"`) passe avant les règles de `netlify.toml`, qui ne s'appliquent donc jamais aux pages ; une redirection de pages se fait dans `apps/web/src/server.ts`.
- **Paramètres d'une route TanStack** : un lien ou un `navigate` reprend les paramètres en cours ; pour aller à la catégorie sans la fiche ouverte, passer `product: undefined`.
- **Adresse figée au build** : `SITE.url` vient de `URL` au moment du build ; après un changement de domaine, relancer un déploiement, sinon canonical et sitemap gardent l'ancienne adresse.

- **Base locale saturée** : chaque rechargement du module de base dans un serveur de dev ouvrait un pool postgres.js de 10 sans fermer l'ancien, jusqu'à « too many clients already » (100 connexions). Corrigé le 24 octobre dans `packages/db/src/client.ts` (client sur `globalThis`, `idle_timeout` de 20 s) ; un serveur lancé avant garde ses anciens pools : le redémarrer.
- **Dossier partagé entre sessions** : plusieurs sessions modifient le même dossier. Ne commiter que les chemins de son travail (`git add -- <chemins>`), jamais `git add -A`, et vérifier qu'une colonne neuve n'entre pas dans un commit sans sa migration.
- **Chrome headless et `/api/out`** : son user agent contient « HeadlessChrome », que la route traite comme un robot (204 sans écrire) ; tester avec un user agent normal.
- **Mesurer juste après un déploiement** : le cache du CDN est vide, un premier LCP mobile de l'accueil est sorti à 8,8 s au lieu de 5 ; mesurer deux fois.
- **Seed avant push quand une question lit un champ neuf** : la question des boutons latéraux lit `sideButtons` ; poussée avant le seed, elle aurait écarté toutes les souris en production. Ordre suivi le 24 octobre au soir : migration, seed, push.
- **Seed de production coupé** : le seed est une seule transaction d'environ 9 000 requêtes en série (8 minutes depuis la France, 33 ms par requête). Le 24 octobre au soir, un premier essai a perdu sa connexion vers 15 minutes (erreur de connexion de postgres.js) : rien n'a été écrit, le second essai a réussi. Relancer simplement, en gardant le journal entier plutôt qu'un `tail`.

* **Le contrôle « vue de dessus » se trompe** : il laisse passer des dessous de souris et de claviers, des dos d'écrans, des infographies, des étiquettes énergie, des vignettes vidéo et un TKL photographié pour un clavier pleine taille. Relire chaque photo candidate sur une planche contact ; les noms de fichiers trompent aussi (`apex_pro_tkl_black_img_buy_02` montre une Apex Pro pleine taille).
* **Images ASUS** : seules les images `/gain/` prennent un suffixe de taille (`/w800`) ; une image `/files/media/` suffixée répond 404.

- **Flou et « backdrop root »** : un `backdrop-filter` ne voit plus le canvas dès qu'un ancêtre a une opacité sous 1, un masque, un filtre ou un clip-path. Animer l'opacité des calques de `FrostedEdge` eux-mêmes, jamais celle de leur boîte : l'ancien voile du parcours perdait son flou pendant `slideInLeft`.
- **Push depuis un dossier partagé** : plusieurs sessions commitent sur le même `main`. Lister `git log origin/main..main` juste avant de pousser et dire quels commits partent ; le push du 24 octobre au soir a emporté `df86d23`, commité deux secondes plus tôt par une autre session.
- **Mention Amazon** : « En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises. » est imposée mot pour mot par l'accord Partenaires (art. 5) : ne pas la raccourcir.

- **Deux seeds de production en même temps** : le dernier à valider gagne pour chaque ligne. Avant un seed, chercher une transaction `postgres.js` ouverte dans `pg_stat_activity`, prévenir les autres sessions et semer depuis des données qui contiennent tout ce qui est poussé. Le 25 octobre, deux seeds sont partis à une minute d'écart ; le second a été arrêté avant d'écrire.
- **Seed depuis un worktree** : il n'a pas de `.env`. `pnpm exec tsx --env-file=…` échoue (« .env: not found », rien d'écrit) ; charger celui du dossier principal (`set -a; . <dossier>/.env; set +a`) puis `pnpm --filter @choose/db seed`.

## Limites connues et dette technique

La principale limite tient aux données : avec 25 produits fictifs par catégorie, le motif du canvas se répète vite et plusieurs étapes se sautent. Le reste est une dette assumée pour cette première version.

- **Données** : les écrans sont 264 modèles de 8 marques : Acer et Gigabyte bloquent les robots, 104 écrans d'ASUS, BenQ et Philips n'ont aucun prix conseillé publié (voir « Écrans : vrais modèles ») ; 21 produits gardent leur dessin sur le canvas faute de vraie vue publiée (voir « Photos remplacées depuis le web » ; leur fiche montre la photo). Les photos Razer font 500 px : un peu justes dans la fiche sur écran Retina.
- **Classement** : popularité et note éditoriale valent 0,5 partout, donc l'a priori ne départage rien (il sort du fit depuis le 24 octobre, jusqu'à une vraie popularité) ; le firmware « propriétaire » est la valeur par défaut de l'ingest quand une page ne cite ni QMK ni VIA, ce qui avantage Keychron sur « Code ». Les fiches d'écrans ne donnent ni couverture Adobe RGB ni uniformité : en « Création », un écran de jeu calibré à large gamut vaut un écran pro.
- **Liste courte sur téléphone** : l'espace libre au-dessus de la console était trop petit pour regrouper les produits retenus, qui restaient serrés sur le canvas. Depuis le 24 octobre, la barre d'étapes a quitté le dock et le bandeau n°1 remplace la rangée du podium ; le regroupement et l'indice « Glisse pour explorer » (masqué quand la place manque) n'ont pas été revérifiés sur téléphone.
- **Canvas 2D** : à l'aise avec des centaines de produits depuis les dessins partagés (45 Mo en DPR 2) et le budget des photos (64 Mo au plus) ; WebGL n'est plus nécessaire à cette échelle.
- **Catalogue entier dans le HTML** : le loader envoie tout le snapshot au premier rendu, soit 1,15 à 1,31 Mo de HTML par page (110 à 117 Ko en Brotli) avec les trois catalogues, mesuré le 24 octobre ; l'API en fait 909 Ko, dont 235 Ko de switchs recopiés dans chaque variante. Format compact à prévoir (switchs et marques en dictionnaire).
- **Poids du bundle** : un morceau partagé d'environ 120 Ko contient probablement Zod et le catalogue. Une entrée « moteur seul » sans Zod côté client l'allégerait, à mesurer.
- **Pas de prix boutiques** : la table `offers` est vide : les claviers et les écrans n'ont que le lien Amazon (prix indicatif, pas celui du jour) ; un écran sans ASIN mène à une recherche par sa référence.
- **Accessibilité** : tuiles et canvas non audités (le canvas est masqué aux lecteurs d'écran ; les bandes sont de vrais liens focalisables), pas de test au clavier seul.
- **Podium rendu deux fois** : colonne sur grand écran, rangée entre 768 et 1 023 px de large, plus le bandeau n°1 sur téléphone ; deux des trois sont masqués en CSS.
- **Le seed supprime** ce que data/ ne liste plus, avec un garde-fou (SEED\_PRUNE=force au-delà de max(30, la moitié du catalogue), et par catégorie au-delà de max(10, la moitié de la catégorie)).
- **Ni tests d'interface ni CI.**
- **Prévu mais pas encore utilisé** : ScrollTrigger, three et React Three Fiber.
- **Souris** : 149 modèles de 8 marques ; Zowie, Keychron, Corsair et Kensington attendent (voir « Souris : troisième catégorie »). La forme n'est connue que par longueur, largeur, hauteur et poids (ni bosse ni courbure) et les constantes du modèle de prise ne sont pas calées. Photos principales relues le 24 octobre au soir (149 vues de dessus sur 149), pas encore d'ASIN ; les prix HyperX et Turtle Beach sont estimés depuis les prix US (× 1,2). Pulsar touche le plafond de 30 et compte plusieurs générations d'une même coque (X2H, X2H v3, X2H CrazyLight).

* **« À savoir » mal formulé** : la rubrique reprend le nom des critères où le produit est faible, ce qui donne des lignes qui se lisent comme des qualités (« Taille idéale pour l'e-sport »). Il faut un libellé négatif par critère.

- **Mobile vu seulement en émulation** : Chrome headless avec tactile émulé ; zones sûres, barre de Safari qui se replie, inertie du défilement de l'accueil et feuilles tirées au doigt jamais vus sur un vrai iPhone.
- **Troncatures sur bureau et tablette** (déjà en production, laissées telles quelles le 24 octobre) : noms longs dans la colonne du podium (« Pulsefire Haste 3 Pr… » à 1440 et 1024 px), nom et « Symétrique » coupés dans les lignes de résultats à 768 px.
- **Fiches sans offre** : le JSON-LD `Product` n'a pas d'`offers` (prix publics approximatifs) ; pas d'extrait enrichi chez Google, et la Search Console signalera « offers, review ou aggregateRating manquant ».
- **Photo des fiches au premier rendu** : le HTML servi montre le dessin, la photo découpée n'arrive qu'au client (LCP mobile vers 5 s le 24 octobre, contre 2,2 s pour le texte de la fiche) ; la vraie photo est dans le JSON-LD, l'og:image et un `noscript`. 453 des 933 photos n'ont pas leur taille en base : leur og:image n'a pas de width/height.

- **Inconnu compté comme « non »** (audit A2) : les champs à valeur par défaut (firmware, montage, Mac, insonorisation) pénalisent les fiches peu remplies et les excluent des indispensables.
- **Pénalités binaires** (audit A5) : une option absente (USB-C, pied réglable, multi-appareils) tombe au plancher de 0,05 et divise le fit par deux environ ; le bonus « calibré usine » disparaît quand la couleur sature déjà à 1.
- **Switchs** (24 octobre) : 13 claviers restent sans switch faute de nom publié (6 Ajazz, le Chilkey Foxy 65, 6 Womier) et sortent dès qu'on répond à « Ressenti ». 7 fiches de switchs viennent de sources non officielles (Keychron Apex Red, Brown et Banana, Gateron Sylva, Outemu Red, Durock Blue Lotus, HMX Silent Sakura), regroupées et sourcées dans `data/switches.yaml`.
- **Pas d'outil d'audience** (depuis le 24 octobre au soir) : ni visiteurs ni pages vues. Search Console montre le trafic venu de Google, la console Partenaires les clics et ventes Amazon, `outbound_clicks` les clics par produit et emplacement, Netlify Observability les requêtes brutes des dernières 24 h.

* **NuPhy et Glorious** (24 octobre au soir) : leurs sites renvoient 429 dès la première requête, rien n'est importé. À réessayer plus tard, sans contourner.
* **Akko sans ASIN** : la génération V5 n'est pas vendue sur amazon.fr, ses fiches mènent à une recherche.
* **Hors canvas** : 4 Corsair (SABRE v3 PRO et sa version MG, SABRE v2 PRO MG, SCIMITAR ELITE WIRELESS, vus de biais) et le ROG Falcata gardent leur dessin.
* **Tuiles en dessin** : une carte de step dont le produit n'a pas de photo détourable garde son dessin, même préchargée.

## Prochaines étapes

Le premier commit est fait. La suite logique est la phase 5 (pages SEO) et les vraies données ; la phase 4 (nuage WebGL) devient facultative : la scène pourra passer en WebGL si le catalogue grossit.

- [x] **Premier commit** sur `main` : fait (`e4ca02a`).
- [ ] **Scène WebGL (si besoin)** : même rendu que `features/scene/renderer.ts` en shaders, si le catalogue dépasse quelques centaines de produits.
- [ ] **Phase 5, pages SEO** : fiches produit, `sitemap.xml`, `robots.txt`, JSON-LD et images OG faits le 24 octobre (voir « SEO : fiches produit, nom et domaine ») ; catalogue A–Z et collections faits le 24 octobre au soir (voir « Soir du 24 octobre ») ; restent les guides et le poids des pages, chacune portant encore les trois catalogues (1,24 Mo de HTML).
- [ ] **Vraies données** : claviers faits (523, photos détourées, voir « Vraies données et photos ») et écrans de 8 marques (264, voir « Écrans : vrais modèles ») et souris de 8 marques (149, voir « Souris : troisième catégorie ») ; restent 104 écrans sans prix publié, les prix boutiques (`offers`).
- [ ] **Offres et affiliation** : affiliation Amazon en ligne depuis le 24 octobre au soir (Store ID, liens `rel="sponsored"`, mention Partenaire) et clics journalisés (voir « Audit et lot 1 ») ; reste à charger `offers` dans le snapshot et à afficher les offres sur la ligne du prix et dans la barre d'achat de la fiche produit.
- [ ] **Performance** : entrée moteur sans Zod côté client ; top produits rendu côté serveur, catalogue chargé ensuite.
- [ ] **Idées en attente** : spécimen 3D procédural (accueil, tuiles), sons et courbes de force des switchs, démo de fréquence et loupe PPI dans les tuiles, vue éclatée, thème sombre, back-office (interface interne ou Directus).

* [x] **Commiter et pousser** les retours du 21 octobre sur `main` (Netlify déploie `main`).
* [ ] **Reformuler « À savoir »** avec un libellé négatif par critère (`keyboards.ts`, `monitors.ts`).
* [ ] **Région des fonctions Netlify** sur eu-central-1, près de la base Neon, si l'offre le permet.
* [ ] **Branche Neon de développement** (`npx neon@latest checkout dev --create`) pour que `pnpm dev` et le seed ne touchent plus `production`.
* [ ] **Pousser les cinq correctifs** faits après `f54dc9b` (`scene/sprites.tsx` surtout, plus `renderer.ts`, `routes/$lang.tsx`, `routes/__root.tsx`, `catalog/src/media/drawing.ts`).
* [ ] **Voir en mouvement** la recomposition du canvas et le preloader, panneau du navigateur affiché, et régler si besoin.
* [x] **`pnpm ingest photos`** : fait le 22 octobre au soir (479 vues de dessus, vignettes Corsair en 2 000 px).
* [ ] **Semer la production** avec les nouvelles données (photos principales, polling Corsair), avec l'accord de l'utilisateur, puis commiter et pousser les retours du 22 octobre au soir.
* [ ] **Popularité** : une source (avis, ventes) pour que l'a priori départage vraiment les égalités.
* [ ] **Firmware** : croiser avec la liste des claviers pris en charge par VIA pour ne plus noter « propriétaire » par défaut.
* [ ] **Profil « Code »** : décider si le bonus de confort des dispositions Alice doit peser autant.
* [ ] **Netlify** : suivre les crédits de l'Image CDN ; corriger « Données de démonstration » sur l'accueil.
* [ ] **Souris** : lots E (photos principales, prix, curation), F (le site), G (calage du modèle et audit des personas), marques en attente et ASIN Amazon (voir « Souris : troisième catégorie »).

- [ ] **Vérifier sur un vrai iPhone** : zones sûres, barre de Safari qui se replie, inertie de l'accueil, feuilles tirées vers le bas.
- [ ] **Troncatures bureau et tablette** : colonne du podium et lignes de résultats à 768 px (voir « Limites »).
- [ ] **Décrire ici** les cinq tours de la session canvas de la nuit du 23 au 24 octobre (`1e87ffa` à `c15905f`).
- [x] **Search Console** : propriété validée et sitemap envoyé par l'utilisateur le 24 octobre au soir.
- [ ] **SEO, phase 3** : guides tirés des questionnaires (collections faites le 24 octobre au soir) ; ne plus envoyer les trois catalogues dans chaque page.

- [x] **Umami** : abandonné le 24 octobre au soir et retiré du site (`4e47f6a`) ; la mesure passe par Search Console, la console Partenaires et le journal des clics.
- [x] **Mettre en ligne les sessions en cours** : fait le 24 octobre au soir avec l'accord de l'utilisateur (migration 0006, seed, push ; voir « Soir du 24 octobre »).
- [ ] **Lot 2 de l'audit** : inconnus dans le moteur (champs à trois états, `known` sur construction, confort, programmable, silence), firmware complété par les listes VIA et QMK.
- [ ] **Lot 4 de l'audit** : catalogue compact par catégorie, snapshot précalculé (Netlify Blobs écrit par le seed), région des fonctions.
- [ ] **Recalibrer** les pénalités binaires (A5) et les critères qui saturent.
- [ ] **Photo de la fiche dès le premier rendu**, pour un LCP mobile sous 2,5 s (session proposée).
- [ ] **Phrases comparatives sur les fiches** (reste de S2) : « le moins cher des 75 % sans fil », écart avec les modèles proches, tirés des données.
- [ ] **13 claviers sans switch** : relancer la recherche quand Ajazz, Chilkey et Womier publient leurs switchs, ou les laisser passer « Ressenti » comme « non précisé » (lot 2).

* [ ] **Contrôle « vue de dessus » et « de face »** : laisser passer les 4 bonnes photos qu'il refuse (Keychron Q11, BenQ XL2546X+ et XL2586X+, LG 32U889SA) sans rouvrir la porte aux vues de biais.
* [ ] **21 produits en dessin** : relancer la recherche quand Womier, Vortex ou les autres publient une vue de dessus ou de face (voir « Photos remplacées depuis le web »).

- [ ] **NuPhy et Glorious** : relancer leurs lots dans la session catalogue quand les 429 seront levés (Air75 V3, Air60 V2, Halo, Gem80 ; Model O 3 et D 3).
- [ ] **ASIN Akko** : les ajouter quand la génération V5 arrivera sur amazon.fr.

* [ ] Point 4 de l'audit : compléter à la source `power`, `hosts` et `pollingHz` des souris, les switchs des 14 claviers, les temps de réponse des BenQ XL et les pieds des 58 écrans (voir « Suites de l'audit (25 octobre) »).
* [ ] Question « Boutons » des souris : une option pour 1 bouton latéral, ou « 1 ou 2 » (ASUS ProArt MD300).
* [ ] Prior : trouver une popularité ou des notes moins biaisées que la presse ; le moteur les prend déjà, 2 points au plus.
