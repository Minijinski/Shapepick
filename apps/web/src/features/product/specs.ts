import {
  type CatalogItem,
  type Category,
  finders,
  type ItemOf,
  type Locale,
} from "@choose/catalog";

// The handful of specs a card, a list row or an annotated hero prints, worded per locale.

export type SpecLine = { label: string; value: string };

/**
 * A spec as the results, the sheet and the popup show it: its main value, then details as small
 * tags; a row of the results list keeps the value alone, with `aside` beside it when it has one.
 */
export type SpecCell = {
  label: string;
  value: string;
  details: string[];
  aside?: string;
};

const formFactorName: Record<string, [string, string]> = {
  full: ["100 %", "Full size"],
  f96: ["96 %", "96%"],
  tkl: ["TKL", "TKL"],
  f75: ["75 %", "75%"],
  f65: ["65 %", "65%"],
  f60: ["60 %", "60%"],
  f40: ["40 %", "40%"],
  split: ["Split", "Split"],
  alice: ["Alice", "Alice"],
  numpad: ["Pavé num.", "Numpad"],
};
const techName: Record<string, [string, string]> = {
  mechanical: ["Mécanique", "Mechanical"],
  magnetic: ["Magnétique", "Magnetic"],
  optical: ["Optique", "Optical"],
  membrane: ["Membrane", "Membrane"],
  scissor: ["Ciseaux", "Scissor"],
  topre: ["Topre", "Topre"],
};
const panelName: Record<string, string> = {
  ips: "IPS",
  va: "VA",
  tn: "TN",
  woled: "WOLED",
  qdoled: "QD-OLED",
  miniled_ips: "Mini-LED IPS",
  miniled_va: "Mini-LED VA",
};
const pick = (pair: [string, string] | undefined, locale: Locale) =>
  pair ? pair[locale === "fr" ? 0 : 1] : "";
const mouseShapeName: Record<string, [string, string]> = {
  symmetrical: ["Symétrique", "Symmetrical"],
  ergonomic: ["Ergonomique", "Ergonomic"],
  vertical: ["Verticale", "Vertical"],
  trackball: ["Trackball", "Trackball"],
};
const mouseHandName: Record<string, [string, string]> = {
  right: ["droitier", "right-handed"],
  left: ["gaucher", "left-handed"],
  ambidextrous: ["ambidextre", "ambidextrous"],
};
const ballName: Record<string, [string, string]> = {
  thumb: ["boule au pouce", "thumb ball"],
  finger: ["boule aux doigts", "finger ball"],
};
const feelName: Record<string, [string, string]> = {
  linear: ["linéaire", "linear"],
  tactile: ["tactile", "tactile"],
  clicky: ["clicky", "clicky"],
};
const gripName: Record<string, [string, string]> = {
  palm: ["paume", "palm"],
  claw: ["griffe", "claw"],
  fingertip: ["bout des doigts", "fingertip"],
};

/** An amount in euros, as typed: budget bounds and the like. */
export const formatAmount = (value: number, locale: Locale) =>
  new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

/** A product's price: indicative (typical regular price, rounded, refreshed weekly), never today's
 * shop price, so it always reads as an approximation. Shop offers will carry the exact prices. */
export const formatPrice = (value: number, locale: Locale) =>
  `≈\u00a0${formatAmount(value, locale)}`;

const num = (value: number, locale: Locale) =>
  new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB").format(value);

export function keySpecs(item: CatalogItem, locale: Locale): SpecLine[] {
  const fr = locale === "fr";
  if (item.category === "mouse") {
    const s = item.specs;
    const shape =
      s.shape === "trackball" && s.ballPosition
        ? pick(ballName[s.ballPosition], locale)
        : pick(mouseHandName[s.hand], locale);
    const connection = [
      s.conn24ghz && "2,4 GHz",
      s.connBt && "Bluetooth",
      !s.conn24ghz && !s.connBt && (fr ? "Filaire" : "Wired"),
    ]
      .filter(Boolean)
      .join(" + ");
    return [
      {
        label: fr ? "Forme" : "Shape",
        value: `${pick(mouseShapeName[s.shape], locale)} · ${shape}`,
      },
      {
        label: fr ? "Dimensions" : "Size",
        value:
          s.lengthMm && s.widthMm && s.heightMm
            ? `${num(s.lengthMm, locale)} × ${num(s.widthMm, locale)} × ${num(s.heightMm, locale)} mm`
            : "—",
      },
      {
        label: fr ? "Poids" : "Weight",
        value: s.weightG ? `${num(s.weightG, locale)} g` : "—",
      },
      {
        label: fr ? "Connexion" : "Connection",
        value: fr ? connection : connection.replace("2,4", "2.4"),
      },
    ];
  }
  if (item.category === "keyboard") {
    const s = item.specs;
    const feels = [
      ...new Set(item.variants.map((v) => v.switch?.feel).filter(Boolean)),
    ] as string[];
    const connection = [
      s.conn24ghz && "2.4 GHz",
      s.connBt && "Bluetooth",
      !s.conn24ghz && !s.connBt && (fr ? "Filaire" : "Wired"),
    ]
      .filter(Boolean)
      .join(" + ");
    return [
      {
        label: fr ? "Format" : "Size",
        value:
          pick(formFactorName[s.formFactor], locale) +
          (s.lowProfile ? (fr ? " · extra-plat" : " · low profile") : ""),
      },
      {
        label: fr ? "Touches" : "Keys",
        value: [
          pick(techName[s.technology], locale),
          feels.map((f) => pick(feelName[f], locale)).join("/"),
        ]
          .filter(Boolean)
          .join(" · "),
      },
      { label: fr ? "Connexion" : "Connection", value: connection },
      s.rapidTrigger
        ? {
            label: "Rapid trigger",
            value: s.minActuationMm
              ? `${num(s.minActuationMm, locale)} mm`
              : "✓",
          }
        : {
            label: fr ? "Poids" : "Weight",
            value: s.weightG ? `${num(s.weightG, locale)} g` : "—",
          },
    ];
  }
  const s = item.specs;
  return [
    {
      label: fr ? "Taille" : "Size",
      value: `${num(s.diagonalIn, locale)}" ${s.aspect}${s.curvatureR ? ` · ${s.curvatureR}R` : ""}`,
    },
    {
      label: fr ? "Définition" : "Resolution",
      value: `${s.resW}×${s.resH} · ${s.ppi} PPI`,
    },
    { label: fr ? "Dalle" : "Panel", value: panelName[s.panel] ?? s.panel },
    { label: fr ? "Fréquence" : "Refresh", value: `${s.refreshHzMax} Hz` },
  ];
}

const layoutName: Record<string, [string, string]> = {
  iso_fr: ["AZERTY", "AZERTY"],
  ansi_us: ["QWERTY US", "US QWERTY"],
  iso_uk: ["QWERTY UK", "UK QWERTY"],
  iso_de: ["QWERTZ", "QWERTZ"],
  iso_nordic: ["Nordique", "Nordic"],
  jis: ["JIS", "JIS"],
};
const hotSwapName: Record<string, [string, string]> = {
  "3pin": ["3 broches", "3-pin"],
  "5pin": ["5 broches", "5-pin"],
  magnetic: ["Magnétique", "Magnetic"],
};
const hdrName: Record<string, string> = {
  hdr400: "HDR 400",
  hdr500: "HDR 500",
  hdr600: "HDR 600",
  hdr1000: "HDR 1000",
  hdr1400: "HDR 1400",
  true_black_400: "True Black 400",
  true_black_500: "True Black 500",
  true_black_600: "True Black 600",
};
const coatingName: Record<string, [string, string]> = {
  matte: ["mat", "matte"],
  semi: ["semi-brillant", "semi-gloss"],
  glossy: ["brillant", "glossy"],
};

/** The fuller spec sheet of the canvas popup: the key specs plus what a buyer checks next. */
export function sheetSpecs(item: CatalogItem, locale: Locale): SpecLine[] {
  const fr = locale === "fr";
  const known = (lines: (SpecLine | undefined)[]) =>
    lines.filter((line): line is SpecLine => !!line?.value);
  if (item.category === "keyboard") {
    const [format, keys, connection, extra] = keySpecs(item, locale);
    const s = item.specs;
    const switches = [
      ...new Set(
        item.variants.flatMap((v) =>
          v.switch
            ? [
                // A switch known by its feel alone has no force to print.
                v.switch.actuationForceG != null
                  ? `${v.switch.name} · ${num(v.switch.actuationForceG, locale)} g`
                  : v.switch.name,
              ]
            : [],
        ),
      ),
    ];
    const layouts = [
      ...new Set(item.variants.map((v) => pick(layoutName[v.layout], locale))),
    ];
    return known([
      format,
      keys,
      switches.length
        ? { label: "Switch", value: switches.slice(0, 2).join(", ") }
        : {
            label: "Hot-swap",
            value: pick(hotSwapName[s.hotSwap], locale) || (fr ? "Non" : "No"),
          },
      connection,
      { label: fr ? "Disposition" : "Layout", value: layouts.join(", ") },
      extra,
    ]);
  }
  if (item.category === "mouse") {
    const [shape, size, weight, connection] = keySpecs(item, locale);
    const s = item.specs;
    const sensor = [
      s.sensor,
      s.dpiMax && `${num(s.dpiMax, locale)} DPI`,
      s.pollingHz && `${num(s.pollingHz, locale)} Hz`,
    ].filter(Boolean);
    const power =
      s.power === "aa" || s.power === "aaa"
        ? fr
          ? `piles ${s.power.toUpperCase()}`
          : `${s.power.toUpperCase()} batteries`
        : s.batteryHours
          ? `${num(Math.round(s.batteryHours), locale)} h`
          : "";
    const wheel = [
      s.freeSpinWheel && (fr ? "débrayable" : "free-spin"),
      s.thumbWheel && (fr ? "molette latérale" : "thumb wheel"),
      s.tiltWheel && (fr ? "inclinable" : "tilt"),
    ].filter(Boolean);
    const clicks = [
      s.silentClicks && (fr ? "silencieux" : "silent"),
      s.switchType === "optical" &&
        (fr ? "switchs optiques" : "optical switches"),
      s.switchType === "magnetic" &&
        (fr ? "switchs magnétiques" : "magnetic switches"),
    ].filter(Boolean);
    // What the maker says the shell suits: the hand lengths and the grips.
    const advice = [
      s.makerHandMinCm != null || s.makerHandMaxCm != null
        ? `${fr ? "mains" : "hands"} ${[s.makerHandMinCm, s.makerHandMaxCm]
            .map((v) => (v == null ? "…" : num(v, locale)))
            .join("–")} cm`
        : "",
      (s.makerGrips ?? []).map((g) => pick(gripName[g], locale)).join(", "),
    ].filter(Boolean);
    return known([
      shape,
      size,
      weight,
      connection,
      { label: fr ? "Capteur" : "Sensor", value: sensor.join(" · ") },
      {
        label: fr ? "Boutons" : "Buttons",
        value: s.buttons
          ? `${s.buttons}${s.mmo ? (fr ? " · pavé MMO" : " · MMO grid") : ""}`
          : "",
      },
      {
        label: fr ? "Autonomie" : "Battery",
        value: [
          power,
          s.wirelessCharging &&
            (fr ? "recharge sans fil" : "wireless charging"),
        ]
          .filter(Boolean)
          .join(" · "),
      },
      { label: fr ? "Molette" : "Wheel", value: wheel.join(" · ") },
      { label: fr ? "Clics" : "Clicks", value: clicks.join(" · ") },
      {
        label: fr ? "Appareils" : "Devices",
        value: s.hosts >= 2 ? `${s.hosts}` : "",
      },
      { label: fr ? "Conseillée pour" : "Made for", value: advice.join(" · ") },
    ]);
  }
  const [size, resolution, panel, refresh] = keySpecs(item, locale);
  const s = item.specs;
  const ports = [
    s.hdmiVersion && `HDMI ${s.hdmiVersion}`,
    s.dpVersion && `DP ${s.dpVersion}`,
    s.usbcPdW > 0 && `USB-C ${s.usbcPdW} W`,
    s.thunderbolt && "Thunderbolt",
    s.kvm && "KVM",
  ].filter(Boolean);
  // What a buyer checks next: the stand, the colours, the light.
  const stand = [
    s.heightAdjustable &&
      (s.standHeightMm
        ? `${fr ? "hauteur" : "height"} ${s.standHeightMm} mm`
        : fr
          ? "réglable en hauteur"
          : "height-adjustable"),
    s.pivot && "pivot",
    s.swivel && (fr ? "rotation" : "swivel"),
  ].filter(Boolean);
  const colours = [
    s.dciP3Pct && `DCI-P3 ${num(s.dciP3Pct, locale)} %`,
    s.bitDepth && `${s.bitDepth} bits`,
    s.factoryCalibrated && (fr ? "calibré usine" : "factory calibrated"),
  ].filter(Boolean);
  const light = [
    s.brightnessSdrNits && `${s.brightnessSdrNits} cd/m²`,
    s.brightnessHdrPeakNits &&
      `${fr ? "crête HDR" : "HDR peak"} ${s.brightnessHdrPeakNits} cd/m²`,
  ].filter(Boolean);
  return known([
    size,
    resolution,
    panel && {
      ...panel,
      value: `${panel.value} · ${pick(coatingName[s.coating], locale)}`,
    },
    refresh && {
      ...refresh,
      value: s.responseGtgMs
        ? `${refresh.value} · ${num(s.responseGtgMs, locale)} ms`
        : refresh.value,
    },
    { label: "HDR", value: hdrName[s.hdrCert] ?? "—" },
    { label: fr ? "Luminosité" : "Brightness", value: light.join(" · ") },
    { label: fr ? "Couleurs" : "Colour", value: colours.join(" · ") },
    { label: fr ? "Connectique" : "Ports", value: ports.join(" · ") || "—" },
    {
      label: fr ? "Pied" : "Stand",
      value: stand.join(" · ") || (fr ? "fixe" : "fixed"),
    },
  ]);
}

/** A monitor's HDR certification, short enough for a tag ("TB": DisplayHDR True Black). */
const hdrTag: Record<string, string> = {
  hdr400: "HDR 400",
  hdr500: "HDR 500",
  hdr600: "HDR 600",
  hdr1000: "HDR 1000",
  hdr1400: "HDR 1400",
  true_black_400: "TB 400",
  true_black_500: "TB 500",
  true_black_600: "TB 600",
};

/** The labels of a question's options an item meets, in the question's order. */
function met<C extends Category>(
  category: C,
  key: string,
  item: ItemOf<C>,
  locale: Locale,
): string[] {
  const step = finders[category].steps.find((s) => s.key === key);
  if (!step || !("options" in step)) return [];
  return step.options
    .filter((option) => option.match(item))
    .map((option) => option.label[locale]);
}

const wiredOr = (wireless: boolean, fr: boolean) =>
  wireless ? (fr ? "Sans fil" : "Wireless") : fr ? "Filaire" : "Wired";

const present = (values: (string | false | null | undefined)[]) =>
  values.filter((value): value is string => !!value);

/**
 * The four specs the rows of the results line up in columns, the same four for every product of
 * a category: each a main value, then what qualifies it as tags (21:9 and 800R beside 39").
 */
export function specCells(item: CatalogItem, locale: Locale): SpecCell[] {
  const fr = locale === "fr";
  const radio = fr ? "2,4 GHz" : "2.4 GHz";
  if (item.category === "mouse") {
    const s = item.specs;
    const fit =
      s.shape === "trackball" && s.ballPosition
        ? pick(ballName[s.ballPosition], locale)
        : pick(mouseHandName[s.hand], locale);
    // Its length, which sets its size class: the full measures are on its sheet.
    const length = s.lengthMm ? `${num(s.lengthMm, locale)} mm` : null;
    return [
      {
        label: fr ? "Forme" : "Shape",
        value: pick(mouseShapeName[s.shape], locale),
        details: present([fit]),
      },
      {
        label: fr ? "Taille" : "Size",
        // The size class the questionnaire asks about, then the measures.
        value: met("mouse", "size", item, locale)[0] ?? "—",
        details: present([length]),
      },
      {
        label: fr ? "Poids" : "Weight",
        value: s.weightG ? `${num(s.weightG, locale)} g` : "—",
        details: [],
      },
      {
        label: fr ? "Connexion" : "Connection",
        value: wiredOr(s.conn24ghz || s.connBt, fr),
        details: present([
          s.conn24ghz && radio,
          s.connBt && "BT",
          (s.pollingHz ?? 0) >= 2000 &&
            `${num((s.pollingHz ?? 0) / 1000, locale)} kHz`,
        ]),
      },
    ];
  }
  if (item.category === "keyboard") {
    const s = item.specs;
    const feels = [
      ...new Set(item.variants.map((v) => v.switch?.feel).filter(Boolean)),
    ] as string[];
    return [
      {
        label: "Format",
        value: pick(formFactorName[s.formFactor], locale),
        details: present([
          s.lowProfile && (fr ? "extra-plat" : "low profile"),
          item.variants.some((v) => v.layout === "iso_fr") && "AZERTY",
        ]),
      },
      {
        label: fr ? "Touches" : "Keys",
        value: pick(techName[s.technology], locale),
        details: feels.map((feel) => pick(feelName[feel], locale)),
      },
      {
        label: fr ? "Connexion" : "Connection",
        value: wiredOr(s.conn24ghz || s.connBt, fr),
        details: present([s.conn24ghz && radio, s.connBt && "BT"]),
      },
      {
        // The must-haves of the questionnaire it has, the first three.
        label: fr ? "Atouts" : "Highlights",
        value: "",
        details: met("keyboard", "musts", item, locale).slice(0, 3),
      },
    ];
  }
  const s = item.specs;
  return [
    {
      label: fr ? "Taille" : "Size",
      value: `${num(s.diagonalIn, locale)}"`,
      // A diagonal alone does not say whether the screen is wide: the ratio stays beside it.
      aside: s.aspect,
      details: [
        s.aspect,
        s.curvatureR ? `${s.curvatureR}R` : fr ? "plat" : "flat",
      ],
    },
    {
      label: fr ? "Définition" : "Resolution",
      value: `${s.resW}×${s.resH}`,
      details: [`${s.ppi} PPI`],
    },
    {
      label: fr ? "Dalle" : "Panel",
      value: panelName[s.panel] ?? s.panel,
      details: present([hdrTag[s.hdrCert]]),
    },
    {
      label: fr ? "Fréquence" : "Refresh",
      value: `${s.refreshHzMax} Hz`,
      details: present([
        s.responseGtgMs != null && `${num(s.responseGtgMs, locale)} ms`,
      ]),
    },
  ];
}
