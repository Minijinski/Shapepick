import type {
  CatalogItem,
  KeyboardSpecs,
  MonitorSpecs,
  MouseSpecs,
} from "@choose/catalog";
import {
  keyboardBlocks,
  keyboardCase,
  keyboardKeys,
  monitorBox,
  mouseBox,
} from "@choose/catalog/media";
import type { SVGProps } from "react";

// Product silhouettes drawn from the specs, standing in for photos until real imagery exists.
// A 75% board is drawn with a 75% layout, a 32:9 monitor at 32:9 and to scale against a 24", a
// mouse from above at its length and width.

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

// ==== Mice =====================================================================================

type MouseGlyphProps = {
  shape: MouseSpecs["shape"];
  hand?: MouseSpecs["hand"];
  lengthMm?: number;
  widthMm?: number;
  ballPosition?: MouseSpecs["ballPosition"];
  mmo?: boolean;
  colorFamily?: ColorFamily;
  /** Fixed scale (a 140 mm mouse fills the height) instead of filling the box. */
  absolute?: boolean;
  /** Outline only, for products the answers rule out. */
  ghost?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/**
 * A shell seen from above, front up, in a box of its width and length (mm): narrower at the
 * buttons, widest behind the middle. An ergonomic shell (drawn for the right hand) hollows a
 * thumb groove on the left and swells on the right; a vertical one is a narrow teardrop.
 */
function mouseOutline(
  shape: MouseSpecs["shape"],
  w: number,
  l: number,
): string {
  const c = w / 2;
  const at = (x: number, y: number) => `${c + x * w},${y * l}`;
  if (shape === "ergonomic" || shape === "trackball") {
    return [
      `M${at(0.02, 0)}`,
      `C${at(0.3, 0)} ${at(0.4, 0.06)} ${at(0.41, 0.2)}`,
      `C${at(0.42, 0.38)} ${at(0.5, 0.5)} ${at(0.49, 0.68)}`,
      `C${at(0.48, 0.9)} ${at(0.28, 1)} ${at(0.02, 1)}`,
      `C${at(-0.3, 1)} ${at(-0.5, 0.92)} ${at(-0.5, 0.74)}`,
      `C${at(-0.5, 0.62)} ${at(-0.4, 0.55)} ${at(-0.4, 0.44)}`,
      `C${at(-0.4, 0.3)} ${at(-0.44, 0.2)} ${at(-0.4, 0.1)}`,
      `C${at(-0.36, 0.02)} ${at(-0.2, 0)} ${at(0.02, 0)}`,
      "Z",
    ].join(" ");
  }
  if (shape === "vertical") {
    return [
      `M${at(0.08, 0)}`,
      `C${at(0.34, 0)} ${at(0.5, 0.18)} ${at(0.5, 0.5)}`,
      `C${at(0.5, 0.84)} ${at(0.3, 1)} ${at(0.02, 1)}`,
      `C${at(-0.3, 1)} ${at(-0.5, 0.86)} ${at(-0.5, 0.6)}`,
      `C${at(-0.5, 0.3)} ${at(-0.2, 0)} ${at(0.08, 0)}`,
      "Z",
    ].join(" ");
  }
  return [
    `M${at(0, 0)}`,
    `C${at(0.3, 0)} ${at(0.41, 0.05)} ${at(0.41, 0.18)}`,
    `C${at(0.41, 0.38)} ${at(0.5, 0.52)} ${at(0.5, 0.68)}`,
    `C${at(0.5, 0.9)} ${at(0.3, 1)} ${at(0, 1)}`,
    `C${at(-0.3, 1)} ${at(-0.5, 0.9)} ${at(-0.5, 0.68)}`,
    `C${at(-0.5, 0.52)} ${at(-0.41, 0.38)} ${at(-0.41, 0.18)}`,
    `C${at(-0.41, 0.05)} ${at(-0.3, 0)} ${at(0, 0)}`,
    "Z",
  ].join(" ");
}

export function MouseGlyph({
  shape,
  hand = "right",
  lengthMm,
  widthMm,
  ballPosition,
  mmo = false,
  colorFamily = "black",
  absolute = false,
  ghost = false,
  ...svg
}: MouseGlyphProps) {
  const { length: l, width: w } = mouseBox({ lengthMm, widthMm, ballPosition });
  const pal = ghost ? ghostPalette : keyboardPalette[colorFamily];
  const view = absolute ? { w: 96, h: 144 } : { w: w + 4, h: l + 4 };
  const ox = (view.w - w) / 2;
  const oy = (view.h - l) / 2;
  const line = ghost ? GHOST.line : pal.keyStroke;
  const stroke = ghost ? 0.9 : 0.6;
  const dash = ghost
    ? "3 2"
    : colorFamily === "transparent"
      ? "2.4 1.6"
      : undefined;
  const finger = shape === "trackball" && ballPosition === "finger";
  // Drawn for the right hand; a left-handed shell is its mirror image.
  const mirror = hand === "left" ? `translate(${w} 0) scale(-1 1)` : undefined;
  const ball = shape === "trackball" && (
    <circle
      cx={finger ? w / 2 : w * 0.28}
      cy={finger ? l * 0.46 : l * 0.4}
      r={finger ? w * 0.3 : w * 0.17}
      fill={ghost ? "none" : pal.accent}
      stroke={line}
      strokeWidth={stroke}
    />
  );
  return (
    <svg viewBox={`0 0 ${view.w} ${view.h}`} role="img" aria-hidden {...svg}>
      <g transform={`translate(${ox} ${oy})`}>
        <g transform={mirror}>
          {finger ? (
            <rect
              width={w}
              height={l}
              rx={w * 0.32}
              fill={pal.case}
              stroke={pal.stroke}
              strokeWidth={stroke}
              strokeDasharray={dash}
            />
          ) : (
            <path
              d={mouseOutline(shape, w, l)}
              fill={pal.case}
              stroke={pal.stroke}
              strokeWidth={stroke}
              strokeDasharray={dash}
            />
          )}
          {/* The split between the two buttons, and the wheel. */}
          {!finger && (
            <>
              <line
                x1={w / 2}
                y1={l * 0.02}
                x2={w / 2}
                y2={l * 0.36}
                stroke={line}
                strokeWidth={stroke}
              />
              <rect
                x={w / 2 - Math.max(2.2, w * 0.045)}
                y={l * 0.11}
                width={Math.max(4.4, w * 0.09)}
                height={l * 0.12}
                rx={Math.max(2.2, w * 0.045)}
                fill={
                  ghost ? "none" : shape === "trackball" ? pal.key : pal.accent
                }
                stroke={line}
                strokeWidth={stroke * 0.8}
              />
            </>
          )}
          {/* A grid of side buttons under the thumb. */}
          {mmo &&
            [0, 1, 2].flatMap((row) =>
              [0, 1].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={w * 0.04 + col * w * 0.09}
                  y={l * (0.4 + row * 0.07)}
                  width={w * 0.07}
                  height={l * 0.05}
                  rx={0.8}
                  fill={ghost ? "none" : pal.key}
                  stroke={line}
                  strokeWidth={stroke * 0.7}
                />
              )),
            )}
          {ball}
        </g>
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
  if (item.category === "mouse") {
    const { shape, hand, lengthMm, widthMm, ballPosition, mmo } = item.specs;
    return (
      <MouseGlyph
        shape={shape}
        hand={hand}
        lengthMm={lengthMm}
        widthMm={widthMm}
        ballPosition={ballPosition}
        mmo={mmo}
        colorFamily={colorFamily}
        ghost={ghost}
        {...svg}
      />
    );
  }
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
  if (item.category === "mouse") {
    // Mice a few millimetres apart look the same at canvas size: they share a bitmap.
    const { shape, hand, ballPosition, mmo } = item.specs;
    const { length, width } = mouseBox(item.specs);
    const mm = (v: number) => Math.round(v / 3) * 3;
    return `s:${shape}:${hand === "left" ? "l" : "r"}:${mm(length)}:${mm(width)}:${ballPosition ?? ""}:${mmo ? 1 : 0}:${colorFamily}`;
  }
  if (item.category === "keyboard") {
    const { formFactor, lowProfile, knob, screen } = item.specs;
    return `k:${formFactor}:${colorFamily}:${lowProfile ? 1 : 0}:${knob ? 1 : 0}:${screen ? 1 : 0}`;
  }
  const { aspect, diagonalIn, panel, curvatureR } = item.specs;
  return `m:${aspect}:${diagonalIn}:${panel}:${curvatureR ?? 0}:${colorFamily}`;
}
