import type { CatalogItem, KeyboardSpecs, MonitorSpecs } from "@choose/catalog";
import {
  keyboardBlocks,
  keyboardCase,
  keyboardKeys,
  monitorBox,
} from "@choose/catalog/media";
import type { SVGProps } from "react";

// Product silhouettes drawn from the specs, standing in for photos until real imagery exists.
// A 75% board is drawn with a 75% layout, a 32:9 monitor at 32:9 and to scale against a 24".

type ColorFamily = "black" | "white" | "color" | "transparent";

// ==== Keyboards ================================================================================

// The geometry (keys, case, frame) lives in @choose/catalog/media, shared with the canvas.

const keyboardPalette: Record<
  ColorFamily,
  {
    case: string;
    stroke: string;
    key: string;
    keyStroke: string;
    accent: string;
  }
> = {
  black: {
    case: "#1C1C1B",
    stroke: "#1C1C1B",
    key: "#2E2D2B",
    keyStroke: "#3A3936",
    accent: "#FF5A1F",
  },
  white: {
    case: "#E6E2DA",
    stroke: "#C9C5BB",
    key: "#FBFAF7",
    keyStroke: "#D5D1C8",
    accent: "#141414",
  },
  color: {
    case: "#CDBFE6",
    stroke: "#B6A6D6",
    key: "#F5F1FB",
    keyStroke: "#C9BCE4",
    accent: "#FF5A1F",
  },
  transparent: {
    case: "rgba(255,255,255,0.35)",
    stroke: "#A8A399",
    key: "rgba(255,255,255,0.7)",
    keyStroke: "#A8A399",
    accent: "#FF5A1F",
  },
};

// A product the answers rule out is drawn like a hidden line on a technical drawing: no fill,
// grey strokes, the outline dashed.
const GHOST = { line: "#A8A399", faint: "#C9C5BB", dash: "0.3 0.2" } as const;
const ghostPalette = {
  case: "none",
  stroke: GHOST.line,
  key: "none",
  keyStroke: GHOST.faint,
  accent: "none",
};

type KeyboardGlyphProps = {
  formFactor: KeyboardSpecs["formFactor"];
  colorFamily?: ColorFamily;
  lowProfile?: boolean;
  knob?: boolean;
  screen?: boolean;
  /** Fixed scale against a full-size board instead of filling the box. */
  absolute?: boolean;
  /** Outline only, for products the answers rule out. */
  ghost?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "children">;

export function KeyboardGlyph({
  formFactor,
  colorFamily = "black",
  lowProfile = false,
  knob = false,
  screen = false,
  absolute = false,
  ghost = false,
  ...svg
}: KeyboardGlyphProps) {
  const blocks = keyboardBlocks(formFactor);
  const pal = ghost ? ghostPalette : keyboardPalette[colorFamily];
  const { keys, height } = keyboardKeys(formFactor);
  const { pad, halves, caseW, caseH } = keyboardCase(formFactor, lowProfile);
  const tilt = formFactor === "alice" ? 9 : formFactor === "split" ? 4 : 0;
  const view = absolute
    ? { w: 23.5, h: 7.4 }
    : { w: caseW, h: caseH + (halves ? 1.6 : 0) };
  const ox = absolute ? (view.w - caseW) / 2 : 0;
  const oy = absolute ? (view.h - caseH) / 2 : halves ? 0.8 : 0;
  const strokeDash = ghost
    ? GHOST.dash
    : colorFamily === "transparent"
      ? "0.25 0.18"
      : undefined;
  const caseStroke = ghost ? 0.07 : 0.05;

  const renderKeys = (subset: typeof keys) =>
    subset.map((k) => (
      <rect
        key={`${k.x}-${k.y}`}
        x={pad + k.x + 0.06}
        y={pad + k.y + 0.06}
        width={k.w - 0.12}
        height={0.88}
        rx={lowProfile ? 0.08 : 0.14}
        fill={k.accent ? pal.accent : pal.key}
        stroke={k.accent && !ghost ? "none" : pal.keyStroke}
        strokeWidth={ghost ? 0.05 : 0.04}
      />
    ));

  const body = halves ? (
    [blocks[0], blocks[1]].map((block, half) => {
      if (!block) return null;
      const next = blocks[half + 1];
      const subset = keys.filter(
        (k) => k.x >= block.x && (!next || k.x < next.x),
      );
      const w = Math.max(...subset.map((k) => k.x + k.w)) - block.x;
      const cx = pad + block.x + w / 2;
      return (
        <g
          key={block.x}
          transform={`rotate(${half === 0 ? tilt : -tilt} ${cx} ${pad + height / 2})`}
        >
          <rect
            x={block.x}
            y={0}
            width={w + pad * 2}
            height={caseH}
            rx={0.6}
            fill={pal.case}
            stroke={pal.stroke}
            strokeWidth={caseStroke}
            strokeDasharray={strokeDash}
          />
          {renderKeys(subset)}
        </g>
      );
    })
  ) : (
    <>
      <rect
        width={caseW}
        height={caseH}
        rx={0.6}
        fill={pal.case}
        stroke={pal.stroke}
        strokeWidth={caseStroke}
        strokeDasharray={strokeDash}
      />
      {renderKeys(keys)}
      {knob && (
        <circle
          cx={caseW - pad - 0.5}
          cy={pad + 0.5}
          r={0.42}
          fill={pal.accent}
          stroke={ghost ? pal.keyStroke : "none"}
          strokeWidth={0.05}
        />
      )}
      {screen && (
        <rect
          x={caseW - pad - 3.2}
          y={pad + 0.12}
          width={1.6}
          height={0.76}
          rx={0.1}
          fill={ghost ? "none" : "#0A0A0A"}
          stroke={ghost ? pal.keyStroke : pal.accent}
          strokeWidth={0.05}
        />
      )}
    </>
  );

  return (
    <svg viewBox={`0 0 ${view.w} ${view.h}`} role="img" aria-hidden {...svg}>
      <g transform={`translate(${ox} ${oy})`}>{body}</g>
    </svg>
  );
}

// ==== Monitors =================================================================================

const screenFill: Record<MonitorSpecs["panel"], [string, string]> = {
  woled: ["#050505", "#141414"],
  qdoled: ["#040404", "#161616"],
  ips: ["#23272D", "#33383F"],
  va: ["#191B1F", "#2A2D33"],
  tn: ["#2C2F33", "#3C4046"],
  miniled_ips: ["#0D1016", "#3A4250"],
  miniled_va: ["#0B0D12", "#343B48"],
};

type MonitorGlyphProps = {
  aspect: MonitorSpecs["aspect"];
  diagonalIn: number;
  panel?: MonitorSpecs["panel"];
  curvatureR?: number;
  colorFamily?: ColorFamily;
  /** Fixed scale (a 49" super-ultrawide fills the width) instead of filling the box. */
  absolute?: boolean;
  /** Outline only, for products the answers rule out. */
  ghost?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "children">;

export function MonitorGlyph({
  aspect,
  diagonalIn,
  panel = "ips",
  curvatureR,
  colorFamily = "black",
  absolute = false,
  ghost = false,
  ...svg
}: MonitorGlyphProps) {
  const { w, h, bezel, standH, totalW, totalH } = monitorBox(
    aspect,
    diagonalIn,
  );
  const bow = curvatureR ? Math.min(1.4, 1500 / curvatureR) * (w / 30) : 0;
  const view = absolute
    ? { w: 50, h: 26 }
    : { w: totalW + 0.4, h: totalH + 0.4 };
  const ox = (view.w - totalW) / 2;
  const oy = absolute ? view.h - totalH - 0.2 : 0.2;
  const frame = colorFamily === "white" ? "#E6E2DA" : "#1C1C1B";
  const [deep, sheen] = screenFill[panel];
  const id = `scr-${aspect.replace(":", "")}-${Math.round(diagonalIn * 10)}-${panel}`;
  const solid = (fill: string) =>
    ghost ? { fill: "none", stroke: GHOST.line, strokeWidth: 0.1 } : { fill };

  const edge = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    depth: number,
    sweep: 1 | -1,
  ) => `M${x0},${y0} Q${(x0 + x1) / 2},${y0 + depth * sweep} ${x1},${y1}`;
  const outline = (inset: number, depth: number) => {
    const x0 = inset;
    const y0 = inset;
    const x1 = totalW - inset;
    const y1 = inset + (h + bezel * 2 - inset * 2);
    return `${edge(x0, y0, x1, y0, depth, 1)} L${x1},${y1} ${edge(x1, y1, x0, y1, depth, 1).replace(/^M[^Q]+/, "")} Z`;
  };

  return (
    <svg viewBox={`0 0 ${view.w} ${view.h}`} role="img" aria-hidden {...svg}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={sheen} />
          <stop offset="0.55" stopColor={deep} />
        </linearGradient>
      </defs>
      <g transform={`translate(${ox} ${oy})`}>
        <rect
          x={totalW / 2 - 0.5}
          y={h + bezel * 2 - 0.2}
          width={1}
          height={standH - 0.5}
          {...solid(frame)}
        />
        <ellipse
          cx={totalW / 2}
          cy={h + bezel * 2 + standH - 0.4}
          rx={Math.min(totalW * 0.22, 6)}
          ry={0.45}
          {...solid(frame)}
        />
        <path
          d={outline(0, bow)}
          {...solid(frame)}
          strokeDasharray={ghost ? "0.6 0.4" : undefined}
        />
        <path
          d={outline(bezel, bow)}
          {...(ghost
            ? { fill: "none", stroke: GHOST.faint, strokeWidth: 0.08 }
            : { fill: `url(#${id})` })}
        />
      </g>
    </svg>
  );
}

// ==== Any product ==============================================================================

export function ProductGlyph({
  item,
  ghost = false,
  ...svg
}: { item: CatalogItem; ghost?: boolean } & Omit<
  SVGProps<SVGSVGElement>,
  "children"
>) {
  const colorFamily = item.variants[0]?.colorFamily;
  if (item.category === "keyboard") {
    const { formFactor, lowProfile, knob, screen } = item.specs;
    return (
      <KeyboardGlyph
        formFactor={formFactor}
        colorFamily={colorFamily}
        lowProfile={lowProfile}
        knob={knob}
        screen={screen}
        ghost={ghost}
        {...svg}
      />
    );
  }
  const { aspect, diagonalIn, panel, curvatureR } = item.specs;
  return (
    <MonitorGlyph
      aspect={aspect}
      diagonalIn={diagonalIn}
      panel={panel}
      curvatureR={curvatureR}
      colorFamily={colorFamily}
      ghost={ghost}
      {...svg}
    />
  );
}

/**
 * What sets a product's drawing apart: products drawn alike (same format, colour and details)
 * share one bitmap on the canvas.
 */
export function glyphKey(item: CatalogItem): string {
  const colorFamily = item.variants[0]?.colorFamily ?? "black";
  if (item.category === "keyboard") {
    const { formFactor, lowProfile, knob, screen } = item.specs;
    return `k:${formFactor}:${colorFamily}:${lowProfile ? 1 : 0}:${knob ? 1 : 0}:${screen ? 1 : 0}`;
  }
  const { aspect, diagonalIn, panel, curvatureR } = item.specs;
  return `m:${aspect}:${diagonalIn}:${panel}:${curvatureR ?? 0}:${colorFamily}`;
}
