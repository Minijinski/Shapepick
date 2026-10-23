import type { CatalogItem, Locale } from "@choose/catalog";

// The handful of specs a card, a list row or an annotated hero prints, worded per locale.

export type SpecLine = { label: string; value: string };

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
  if (item.category === "keyboard") {
    const s = item.specs;
    const feels = [
      ...new Set(item.variants.map((v) => v.switch?.feel).filter(Boolean)),
    ] as string[];
    const feelName: Record<string, [string, string]> = {
      linear: ["linéaire", "linear"],
      tactile: ["tactile", "tactile"],
      clicky: ["clicky", "clicky"],
    };
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
