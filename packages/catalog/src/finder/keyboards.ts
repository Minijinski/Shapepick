import type { KeyboardItem } from "../domain/items";
import { text } from "../i18n";
import { ANY, type Answers, type FinderDefinition, type Option } from "./types";

// The keyboard questionnaire. Order: use (sets the ranking profile, never filters), then the big
// visible decision (size), then the layout a French buyer cannot compromise on, then the technical
// choices that need explaining, budget once the trade-offs are known, must-haves last. No colour
// question: ten questions were too many, and a colour rarely decides between boards.

type K = KeyboardItem;
const opt = (
  id: string,
  fr: string,
  en: string,
  match: (k: K) => boolean,
  hint?: [string, string],
): Option<K> => ({
  id,
  label: text(fr, en),
  hint: hint && text(...hint),
  match,
});

const switchBased = new Set(["mechanical", "magnetic", "optical"]);
const hasSwitch = (
  k: K,
  test: (s: NonNullable<K["variants"][number]["switch"]>) => boolean,
) => k.variants.some((v) => v.switch != null && test(v.switch));

// The feel question only makes sense when the visitor has kept boards that have switches.
const keepsSwitches = (answers: Answers) => {
  const tech = answers.tech;
  if (!tech || tech === ANY) return true;
  return tech.split(",").some((t) => switchBased.has(t));
};

const wireless = (k: K) => k.specs.conn24ghz || k.specs.connBt;

export const keyboardFinder: FinderDefinition<K> = {
  category: "keyboard",
  profileStep: "use",
  id: (k) => k.slug,
  price: (k) => k.priceEur,
  prior: (k) => 0.6 * k.editorialScore + 0.4 * k.popularity,
  maker: (k) => k.brand.slug,
  steps: [
    {
      key: "use",
      kind: "single",
      weightOnly: true,
      required: true,
      label: text("Usage", "Use"),
      title: text("À quoi va-t-il servir ?", "What is it for?"),
      help: text(
        "On n’écarte aucun clavier ici. Ta réponse sert juste à classer : la réactivité si tu joues, le silence si tu bosses, l’autonomie si tu bouges.",
        "Nothing gets ruled out here. Your answer only sets the ranking: speed if you game, quiet if you work, battery if you travel.",
      ),
      options: [
        // Each hint says what the ranking looks for first for this use. A hint wraps on a tile:
        // "multi‑appareils" keeps its hyphen unbreakable.
        opt("competitive", "Jeu compétitif", "Competitive gaming", () => true, [
          "Latence minimale, rapid trigger",
          "Lowest latency, rapid trigger",
        ]),
        opt("gaming", "Jeu polyvalent", "All-round gaming", () => true, [
          "Réactif, RGB, sans fil",
          "Responsive, RGB, wireless",
        ]),
        opt("office", "Bureau & frappe", "Office & typing", () => true, [
          "Silencieux, multi‑appareils",
          "Quiet, multi-device",
        ]),
        opt("code", "Code", "Coding", () => true, [
          "Programmable, confortable",
          "Programmable, comfortable",
        ]),
        opt("travel", "Nomade", "On the go", () => true, [
          "Léger, sans fil, autonome",
          "Light, wireless, long battery",
        ]),
      ],
    },
    {
      key: "size",
      kind: "multi",
      required: true,
      label: text("Taille", "Size"),
      title: text("Quelle taille ?", "How big should it be?"),
      help: text(
        "Plus c’est compact, plus ta souris a de place, mais certaines touches passent derrière des raccourcis. Tu hésites ? Coche-en plusieurs.",
        "The smaller the board, the more room for your mouse, but some keys move behind shortcuts. Not sure? Pick a few.",
      ),
      // The drawing shows the size: one short line each.
      options: [
        opt(
          "full",
          "100 %",
          "Full size",
          (k) => k.specs.formFactor === "full",
          ["Avec pavé numérique", "With numpad"],
        ),
        opt("f96", "96 %", "96%", (k) => k.specs.formFactor === "f96", [
          "Pavé num. resserré",
          "Tighter numpad",
        ]),
        opt("tkl", "TKL", "TKL", (k) => k.specs.formFactor === "tkl", [
          "Sans pavé numérique",
          "No numpad",
        ]),
        opt("f75", "75 %", "75%", (k) => k.specs.formFactor === "f75", [
          "Touches F et flèches",
          "F-keys and arrows",
        ]),
        opt("f65", "65 %", "65%", (k) => k.specs.formFactor === "f65", [
          "Flèches, sans F",
          "Arrows, no F-keys",
        ]),
        opt("f60", "60 %", "60%", (k) => k.specs.formFactor === "f60", [
          "Ni flèches ni F",
          "No arrows, no F-keys",
        ]),
        opt(
          "f40",
          "40 % et moins",
          "40% and less",
          (k) => k.specs.formFactor === "f40",
          ["Sans les chiffres", "No number row"],
        ),
        opt(
          "ergo",
          "Ergonomique",
          "Ergonomic",
          (k) =>
            k.specs.formFactor === "split" || k.specs.formFactor === "alice",
          ["Split, Alice", "Split, Alice"],
        ),
      ],
    },
    {
      key: "layout",
      kind: "multi",
      label: text("Disposition", "Layout"),
      title: text("Quelle disposition ?", "Which layout?"),
      help: text(
        "Beaucoup de claviers ne sortent qu’en QWERTY US. Tu tapes en AZERTY ? Coche-le, on ne garde que ceux vendus en touches françaises.",
        "Lots of boards only ship in US QWERTY. Need another layout? Tick it and we only keep boards sold with it.",
      ),
      options: [
        opt(
          "azerty",
          "AZERTY",
          "AZERTY (FR)",
          (k) => k.variants.some((v) => v.layout === "iso_fr"),
          ["Vendu en touches françaises", "Sold with French legends"],
        ),
        opt(
          "ansi",
          "QWERTY US",
          "US QWERTY",
          (k) => k.variants.some((v) => v.layout === "ansi_us"),
          ["Le plus répandu, Entrée plate", "Most common, flat Enter"],
        ),
        opt(
          "iso",
          "QWERTY ISO",
          "ISO QWERTY",
          (k) =>
            k.variants.some((v) =>
              ["iso_uk", "iso_de", "iso_nordic"].includes(v.layout),
            ),
          ["UK, DE, nordique · Entrée en L", "UK, DE, Nordic · L-shaped Enter"],
        ),
      ],
    },
    {
      key: "tech",
      kind: "multi",
      label: text("Touches", "Keys"),
      title: text("Quel type de touches ?", "What kind of keys?"),
      help: text(
        "**Mécanique** : un switch par touche, solide et personnalisable. **Magnétique** : déclenchement réglable et rapid trigger, le choix des joueurs de FPS. **Optique** : déclenché par la lumière, très rapide. **Membrane** : discret et pas cher. **Ciseaux** : tout plat, comme sur un portable.",
        "**Mechanical**: one switch per key, sturdy and tweakable. **Magnetic**: adjustable actuation and rapid trigger, what FPS players pick. **Optical**: triggered by light, very fast. **Membrane**: quiet and cheap. **Scissor**: flat, like a laptop.",
      ),
      options: [
        opt(
          "mechanical",
          "Mécanique",
          "Mechanical",
          (k) =>
            k.specs.technology === "mechanical" ||
            k.specs.technology === "topre",
          ["Un switch par touche, durable", "One switch per key, durable"],
        ),
        opt(
          "magnetic",
          "Magnétique",
          "Magnetic",
          (k) => k.specs.technology === "magnetic",
          [
            "Déclenchement réglable, rapid trigger",
            "Adjustable actuation, rapid trigger",
          ],
        ),
        opt(
          "optical",
          "Optique",
          "Optical",
          (k) => k.specs.technology === "optical",
          ["Faisceau lumineux, très rapide", "Light-beam actuation, very fast"],
        ),
        opt(
          "membrane",
          "Membrane",
          "Membrane",
          (k) => k.specs.technology === "membrane",
          ["Silencieux, économique", "Quiet, affordable"],
        ),
        opt(
          "scissor",
          "Ciseaux",
          "Scissor",
          (k) => k.specs.technology === "scissor",
          ["Extra-plat, comme un portable", "Very flat, laptop-like"],
        ),
      ],
    },
    {
      key: "feel",
      kind: "multi",
      applies: keepsSwitches,
      label: text("Ressenti", "Feel"),
      title: text(
        "Quel ressenti sous les doigts ?",
        "How should the keys feel?",
      ),
      help: text(
        "**Linéaire** : la touche descend d’un trait. **Tactile** : une petite bosse quand elle s’active. **Clicky** : la bosse, plus un clic qu’on entend. **Silencieux** : amorti en haut et en bas.",
        "**Linear**: the key goes straight down. **Tactile**: a small bump when it fires. **Clicky**: the bump plus a click you can hear. **Silent**: cushioned top and bottom.",
      ),
      options: [
        opt(
          "linear",
          "Linéaire",
          "Linear",
          // Hall-effect switches are linear almost without exception: a magnetic board whose switch
          // sheet could not be read still answers "linear".
          (k) =>
            hasSwitch(k, (s) => s.feel === "linear") ||
            (k.specs.technology === "magnetic" &&
              !k.variants.some((v) => v.switch != null)),
          ["Course lisse, sans bosse", "Smooth travel, no bump"],
        ),
        opt(
          "tactile",
          "Tactile",
          "Tactile",
          // Topre boards have no switch record, but their rubber dome under a spring is tactile.
          (k) =>
            k.specs.technology === "topre" ||
            hasSwitch(k, (s) => s.feel === "tactile"),
          ["Une bosse marque la frappe", "A bump marks each press"],
        ),
        opt(
          "clicky",
          "Clicky",
          "Clicky",
          (k) => hasSwitch(k, (s) => s.feel === "clicky"),
          ["Bosse et clic audible", "Bump and an audible click"],
        ),
        opt(
          "silent",
          "Silencieux",
          "Silent",
          (k) => hasSwitch(k, (s) => s.silent),
          ["Amorti en haut et en bas", "Dampened top and bottom"],
        ),
      ],
    },
    {
      key: "profile",
      kind: "single",
      label: text("Hauteur", "Height"),
      title: text("Plutôt plat ou standard ?", "Flat or standard height?"),
      help: text(
        "**Standard** : la hauteur classique, souvent avec un repose-poignets. **Extra-plat** : touches basses et poignets à plat, comme sur un portable.",
        "**Standard**: the usual height, often with a wrist rest. **Low profile**: short keys and flat wrists, like a laptop.",
      ),
      options: [
        opt("standard", "Standard", "Standard", (k) => !k.specs.lowProfile, [
          "Hauteur classique, course pleine",
          "Classic height, full travel",
        ]),
        opt("low", "Extra-plat", "Low profile", (k) => k.specs.lowProfile, [
          "Course courte, poignets à plat",
          "Short travel, wrists flat",
        ]),
      ],
    },
    {
      key: "connection",
      kind: "single",
      label: text("Connexion", "Connection"),
      title: text("Comment le connecter ?", "How should it connect?"),
      help: text(
        "**2.4 GHz** : un petit dongle USB, assez rapide pour jouer. **Bluetooth** : tu passes de l’ordi à la tablette ou au téléphone. **Filaire uniquement** : pas de batterie à recharger, souvent moins cher.",
        "**2.4 GHz**: a small USB dongle, fast enough for gaming. **Bluetooth**: hop between computer, tablet and phone. **Wired only**: no battery to charge, often cheaper.",
      ),
      options: [
        opt(
          "dongle",
          "Sans fil 2.4 GHz",
          "2.4 GHz wireless",
          (k) => k.specs.conn24ghz,
          ["Dongle USB, latence de jeu", "USB dongle, gaming latency"],
        ),
        opt("bluetooth", "Bluetooth", "Bluetooth", (k) => k.specs.connBt, [
          "Bascule ordi, tablette, téléphone",
          "Hops between computer, tablet, phone",
        ]),
        opt(
          "both",
          "2.4 GHz + Bluetooth",
          "2.4 GHz + Bluetooth",
          (k) => k.specs.conn24ghz && k.specs.connBt,
          [
            "Latence de jeu et multi‑appareils",
            "Gaming latency and multi-device",
          ],
        ),
        opt("wired", "Filaire uniquement", "Wired only", (k) => !wireless(k), [
          "Sans batterie, souvent moins cher",
          "No battery, often cheaper",
        ]),
      ],
    },
    {
      key: "budget",
      kind: "range",
      label: text("Budget", "Budget"),
      title: text("Quel budget ?", "What's your budget?"),
      help: text(
        "On prend le prix le plus bas du modèle. Les barres montrent combien de claviers il reste à chaque prix.",
        "We go by the model’s lowest price. The bars show how many boards are left at each price.",
      ),
      value: (k) => k.priceEur,
      bounds: [0, 400],
      snap: 10,
    },
    {
      key: "musts",
      kind: "musts",
      label: text("Indispensables", "Must-haves"),
      title: text("Des indispensables ?", "Any must-haves?"),
      help: text(
        "Un clavier doit tous les avoir. On ne te propose que ceux qui font encore la différence.",
        "A board needs every one you pick. We only offer the ones that still make a difference.",
      ),
      options: [
        opt(
          "hotswap",
          "Hot-swap",
          "Hot-swap",
          (k) => k.specs.hotSwap !== "none",
          [
            "Switchs remplaçables sans soudure",
            "Swap switches without soldering",
          ],
        ),
        opt(
          "rgb",
          "Rétroéclairage RGB",
          "RGB backlight",
          (k) => k.specs.backlight === "rgb",
          ["Couleurs et effets réglables", "Adjustable colours and effects"],
        ),
        opt("knob", "Molette", "Knob", (k) => k.specs.knob, [
          "Volume et médias d’un geste",
          "Volume and media in one turn",
        ]),
        opt(
          "programmable",
          "QMK / VIA",
          "QMK / VIA",
          (k) => ["qmk", "via", "vial", "zmk"].includes(k.specs.firmware),
          ["Firmware ouvert, tout se remappe", "Open firmware, remap anything"],
        ),
        opt("mac", "Compatible Mac", "Mac support", (k) => k.specs.macSupport, [
          "Touches et raccourcis Mac",
          "Mac keys and shortcuts",
        ]),
        opt(
          "rapid",
          "Rapid trigger",
          "Rapid trigger",
          (k) => k.specs.rapidTrigger,
          [
            "Réarme la touche dès qu’elle remonte",
            "Resets as soon as the key rises",
          ],
        ),
        opt(
          "pbt",
          "Keycaps PBT",
          "PBT keycaps",
          (k) => k.specs.keycapMaterial !== "abs",
          ["Ne brillent pas avec le temps", "Won’t shine with use"],
        ),
        opt(
          "wristrest",
          "Repose-poignets",
          "Wrist rest",
          (k) => k.specs.wristRestIncluded,
          ["Inclus dans la boîte", "In the box"],
        ),
        opt(
          "screen",
          "Écran intégré",
          "Built-in screen",
          (k) => k.specs.screen,
          [
            "Infos et réglages d’un coup d’œil",
            "Info and settings at a glance",
          ],
        ),
      ],
    },
  ],

  // ---- Ranking -------------------------------------------------------------------------------
  criteria: [
    {
      key: "speed",
      label: text(
        "Très réactif (magnétique ou optique)",
        "Very responsive (magnetic or optical)",
      ),
      weakLabel: text(
        "Moins réactif qu’un magnétique",
        "Less responsive than a magnetic board",
      ),
      score: (k) =>
        ({
          magnetic: 1,
          optical: 0.85,
          mechanical: 0.55,
          topre: 0.45,
          membrane: 0.2,
          scissor: 0.25,
        })[k.specs.technology],
    },
    {
      key: "rapid",
      label: text("Rapid trigger", "Rapid trigger"),
      weakLabel: text("Sans rapid trigger", "No rapid trigger"),
      score: (k) =>
        k.specs.rapidTrigger ? 1 : k.specs.adjustableActuation ? 0.5 : 0.15,
    },
    {
      key: "polling",
      label: text("Polling élevé", "High polling rate"),
      weakLabel: text("Polling modeste", "Modest polling rate"),
      known: (k) => k.specs.pollingHzWired != null,
      peers: (k) => k.specs.technology,
      score: (k) =>
        Math.min(
          1,
          Math.log2((k.specs.pollingHzWired ?? 1000) / 125) /
            Math.log2(8000 / 125),
        ),
    },
    {
      key: "compact",
      label: text(
        "Laisse de la place à la souris",
        "Leaves room for the mouse",
      ),
      weakLabel: text("Prend de la place sur le bureau", "Takes up desk space"),
      score: (k) =>
        ({
          f40: 0.9,
          f60: 1,
          f65: 1,
          f75: 0.9,
          tkl: 0.75,
          f96: 0.45,
          full: 0.3,
          split: 0.7,
          alice: 0.6,
          numpad: 1,
        })[k.specs.formFactor],
    },
    {
      key: "quiet",
      label: text("Discret", "Quiet"),
      weakLabel: text("Bruyant (switchs clicky)", "Loud (clicky switches)"),
      score: (k) => {
        if (
          k.specs.technology === "membrane" ||
          k.specs.technology === "scissor"
        )
          return 0.9;
        // The quietest version on sale counts: a board also sold with tactile or linear switches
        // is no loud board.
        const switches = k.variants.flatMap((v) =>
          v.switch ? [v.switch] : [],
        );
        if (switches.some((s) => s.silent)) return 1;
        if (switches.length && switches.every((s) => s.feel === "clicky"))
          return 0.15;
        return k.specs.soundDampening ? 0.65 : 0.5;
      },
    },
    {
      key: "multidevice",
      label: text(
        "Multi-appareils en Bluetooth",
        "Multi-device over Bluetooth",
      ),
      weakLabel: text("Un seul appareil à la fois", "One device at a time"),
      // A Bluetooth board whose sheet does not say how many devices it pairs with.
      known: (k) => !k.specs.connBt || k.specs.btDevices != null,
      peers: (k) => (k.specs.connBt ? "bluetooth" : "none"),
      score: (k) =>
        k.specs.connBt
          ? Math.min(1, 0.6 + 0.15 * ((k.specs.btDevices ?? 1) - 1))
          : 0.1,
    },
    {
      key: "wireless",
      label: text("Sans fil", "Wireless"),
      weakLabel: text("Filaire uniquement", "Wired only"),
      score: (k) =>
        k.specs.conn24ghz && k.specs.connBt
          ? 1
          : k.specs.conn24ghz || k.specs.connBt
            ? 0.75
            : 0.1,
    },
    {
      key: "fullLayout",
      label: text("Toutes les touches", "Every key on board"),
      weakLabel: text(
        "Touches en moins (pavé, F…)",
        "Missing keys (numpad, F row…)",
      ),
      score: (k) =>
        ({
          full: 1,
          f96: 0.95,
          tkl: 0.75,
          f75: 0.65,
          f65: 0.45,
          f60: 0.3,
          f40: 0.1,
          split: 0.5,
          alice: 0.55,
          numpad: 0.1,
        })[k.specs.formFactor],
    },
    {
      key: "comfort",
      label: text("Confortable sur la durée", "Comfortable for long sessions"),
      weakLabel: text(
        "Moins confortable sur la durée",
        "Less comfortable for long sessions",
      ),
      score: (k) =>
        Math.min(
          1,
          0.35 +
            (k.specs.wristRestIncluded ? 0.25 : 0) +
            (k.specs.lowProfile ? 0.15 : 0) +
            (["split", "alice"].includes(k.specs.formFactor) ? 0.35 : 0) +
            (k.specs.mount === "gasket" ? 0.1 : 0),
        ),
    },
    {
      key: "programmable",
      label: text("Entièrement programmable", "Fully programmable"),
      weakLabel: text("Peu programmable", "Limited remapping"),
      score: (k) =>
        ({ qmk: 1, via: 0.95, vial: 0.95, zmk: 0.9, proprietary: 0.35 })[
          k.specs.firmware
        ],
    },
    {
      key: "build",
      label: text("Construction premium", "Premium build"),
      weakLabel: text("Construction simple", "Basic build"),
      score: (k) =>
        Math.min(
          1,
          {
            aluminum: 0.55,
            steel: 0.5,
            wood: 0.45,
            polycarbonate: 0.35,
            plastic: 0.15,
          }[k.specs.caseMaterial] +
            (k.specs.mount === "gasket" ? 0.2 : 0) +
            (k.specs.keycapMaterial !== "abs" ? 0.15 : 0) +
            (k.specs.hotSwap !== "none" ? 0.1 : 0),
        ),
    },
    {
      key: "light",
      label: text("Léger, facile à emporter", "Light, easy to carry"),
      weakLabel: text("Lourd à emporter", "Heavy to carry"),
      known: (k) => k.specs.weightG != null,
      // A full-size board weighs more than a 60 % one: compared within its size.
      peers: (k) => k.specs.formFactor,
      score: (k) =>
        k.specs.weightG
          ? Math.min(1, Math.max(0, (1400 - k.specs.weightG) / 1000))
          : 0.4,
    },
    {
      key: "battery",
      label: text("Grande autonomie", "Long battery life"),
      weakLabel: text("Autonomie courte", "Short battery life"),
      known: (k) => !wireless(k) || k.specs.batteryMah != null,
      peers: (k) => (wireless(k) ? "wireless" : "wired"),
      score: (k) =>
        k.specs.batteryMah
          ? Math.min(1, k.specs.batteryMah / 4000)
          : wireless(k)
            ? 0.3
            : 0,
    },
    {
      key: "rgb",
      label: text("Éclairage RGB", "RGB lighting"),
      weakLabel: text("Peu ou pas d’éclairage", "Little or no lighting"),
      score: (k) =>
        ({ rgb: k.specs.southFacing ? 1 : 0.85, white: 0.45, none: 0.15 })[
          k.specs.backlight
        ],
    },
  ],
  profiles: {
    competitive: { speed: 3, rapid: 3, polling: 2, compact: 2, build: 1 },
    gaming: {
      speed: 2,
      rgb: 1.5,
      build: 1.5,
      compact: 1,
      wireless: 1,
      polling: 1,
    },
    office: { quiet: 3, multidevice: 2, fullLayout: 2, comfort: 2, build: 1 },
    code: { programmable: 3, comfort: 2, build: 2, quiet: 1 },
    travel: { light: 3, compact: 2, multidevice: 2, battery: 2, wireless: 1 },
    default: { build: 2, comfort: 1, wireless: 1, speed: 1 },
  },
};
