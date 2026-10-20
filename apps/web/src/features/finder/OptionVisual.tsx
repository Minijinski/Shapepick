import type { Category } from "@choose/catalog";
import { css } from "styled-system/css";
import { KeyboardGlyph, MonitorGlyph } from "../product/glyphs";

// Small worked examples on the tiles where a picture says more than a word: the board drawn at
// its size, the monitor drawn to scale, the colour as a swatch.

const glyph = css({ w: "100%", h: "auto", maxH: { base: "7", md: "8" } });

const keyboardSizes = {
  full: "full",
  f96: "f96",
  tkl: "tkl",
  f75: "f75",
  f65: "f65",
  f60: "f60",
  f40: "f40",
  ergo: "alice",
} as const;

const monitorFormats = {
  s24: { aspect: "16:9", diagonalIn: 24 },
  s27: { aspect: "16:9", diagonalIn: 27 },
  s32: { aspect: "16:9", diagonalIn: 32 },
  uw34: { aspect: "21:9", diagonalIn: 34, curvatureR: 1800 },
  uw38: { aspect: "21:9", diagonalIn: 38, curvatureR: 2300 },
  suw: { aspect: "32:9", diagonalIn: 49, curvatureR: 1800 },
  big: { aspect: "16:9", diagonalIn: 42 },
} as const;

const swatches: Record<string, string> = {
  black: "#1C1C1B",
  white: "#FBFAF7",
  color: "linear-gradient(135deg, #CDBFE6, #FF5A1F)",
  transparent:
    "repeating-linear-gradient(45deg, #ECEAE4 0 4px, #FBFAF7 4px 8px)",
};

const panels: Record<string, string> = {
  ips: "linear-gradient(135deg, #33383F, #23272D)",
  va: "linear-gradient(135deg, #2A2D33, #191B1F)",
  oled: "linear-gradient(135deg, #161616, #000)",
  miniled: "radial-gradient(circle at 30% 30%, #8C99B0, #0B0D12 60%)",
  tn: "linear-gradient(135deg, #4A4F56, #2C2F33)",
};

export function OptionVisual({
  category,
  stepKey,
  optionId,
}: {
  category: Category;
  stepKey: string;
  optionId: string;
}) {
  if (
    category === "keyboard" &&
    stepKey === "size" &&
    optionId in keyboardSizes
  ) {
    const formFactor = keyboardSizes[optionId as keyof typeof keyboardSizes];
    return (
      <KeyboardGlyph
        formFactor={formFactor}
        colorFamily="white"
        absolute
        className={glyph}
      />
    );
  }
  if (
    category === "monitor" &&
    stepKey === "format" &&
    optionId in monitorFormats
  ) {
    const spec = monitorFormats[optionId as keyof typeof monitorFormats];
    return (
      <MonitorGlyph absolute {...spec} className={css({ h: "8", w: "auto" })} />
    );
  }
  const fill =
    (category === "keyboard" && stepKey === "look" && swatches[optionId]) ||
    (stepKey === "panel" && panels[optionId]);
  if (fill) {
    return (
      <span
        aria-hidden
        className={css({
          display: "block",
          w: "9",
          h: stepKey === "panel" ? "6" : "9",
          borderRadius: stepKey === "panel" ? "sm" : "full",
          borderWidth: "1px",
          borderColor: "line",
        })}
        style={{ background: fill }}
      />
    );
  }
  return null;
}

export const hasVisual = (category: Category, stepKey: string) =>
  (category === "keyboard" && (stepKey === "size" || stepKey === "look")) ||
  (category === "monitor" && (stepKey === "format" || stepKey === "panel"));
