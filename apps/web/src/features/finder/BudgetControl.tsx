import {
  ANY,
  type Bin,
  type Locale,
  type RangeStep,
  readRange,
  writeRange,
} from "@choose/catalog";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { css, cx } from "styled-system/css";
import { gsap, prefersReducedMotion } from "../motion/gsap";
import { motion } from "../motion/tokens";
import { formatAmount } from "../product/specs";

// Two thumbs on one rail, under the price histogram of what the other answers leave. The bars in
// the range turn ink over a band that spans it; each thumb carries its price, which rolls to every
// new value, and the two tags merge into one when the thumbs meet; a scale of prices runs under
// the rail. The bars rise in a wave when the question plays in (Console). The top of the rail
// means "no ceiling", so the answer stays open-ended rather than silently capping at the slider's
// maximum.
//
// A thumb's centre never reaches the ends of its input: it stops half a thumb short of them.
// Everything placed by price (bars, band, tags, scale) sits in a box inset by that half, so it
// lines up with the thumbs.

type Props = {
  step: RangeStep<unknown>;
  draft: string | undefined;
  onDraft: (value: string) => void;
  bins: Bin[];
  locale: Locale;
  labels: { min: string; max: string; noLimit: string };
};

const useIsoLayoutEffect =
  typeof window === "undefined" ? () => {} : useLayoutEffect;

/** A price tag's width (px) from its text: mono characters of 0.6 em at 12 px, plus some room. */
const tagWidth = (text: string) => text.length * 7.2 + 12;

/** The box of everything placed by price: inset by half a thumb (12 px) on either side. */
const inset = css({ position: "relative", mx: "3" });

const bar = css({
  position: "relative",
  flex: "1",
  minW: "0",
  borderTopRadius: "3px",
  transition: "height 400ms token(easings.signal), background-color 180ms",
});
const barIn = css({ bg: "ink" });
const barOut = css({ bg: "line" });

/** The range, behind the bars it takes in. */
const band = css({
  position: "absolute",
  top: "0",
  bottom: "0",
  zIndex: "-1",
  bg: "ink/5",
  borderRadius: "4px",
});

const tag = css({
  position: "absolute",
  top: "0",
  fontFamily: "mono",
  fontSize: "xs",
  lineHeight: "1.25rem",
  textAlign: "center",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
});

/** The line between the thumbs, a little thicker while one is dragged. */
const fill = css({
  position: "absolute",
  top: "50%",
  h: "1",
  mt: "-0.5",
  bg: "ink",
  borderRadius: "full",
  transition: "height 200ms, margin 200ms",
  "[data-dragging] &": { h: "1.5", mt: "-0.75" },
});

const thumbLook = {
  appearance: "none",
  pointerEvents: "auto",
  w: "6",
  h: "6",
  // A finger needs a larger thumb than a pointer.
  _coarse: { w: "7", h: "7" },
  borderRadius: "full",
  bg: "surface.raised",
  border: "2px solid token(colors.ink)",
  cursor: "grab",
  boxShadow: "0 2px 8px rgba(20,20,20,0.18)",
  transition: "transform 220ms token(easings.signal), box-shadow 220ms",
} as const;
const thumbHover = { transform: "scale(1.08)" } as const;
const thumbHeld = {
  transform: "scale(1.18)",
  cursor: "grabbing",
  boxShadow: "0 2px 8px rgba(20,20,20,0.18), 0 0 0 6px rgba(20,20,20,0.08)",
} as const;

const thumb = css({
  position: "absolute",
  inset: "0",
  w: "100%",
  m: "0",
  appearance: "none",
  bg: "transparent",
  pointerEvents: "none",
  "&::-webkit-slider-thumb": thumbLook,
  "&::-webkit-slider-thumb:hover": thumbHover,
  "&:active::-webkit-slider-thumb": thumbHeld,
  "&::-moz-range-thumb": thumbLook,
  "&::-moz-range-thumb:hover": thumbHover,
  "&:active::-moz-range-thumb": thumbHeld,
  _focusVisible: {
    outline: "none",
    "&::-webkit-slider-thumb": { borderColor: "signal" },
    "&::-moz-range-thumb": { borderColor: "signal" },
  },
  _motionReduce: {
    "&::-webkit-slider-thumb": { transition: "none" },
    "&::-moz-range-thumb": { transition: "none" },
  },
});

/**
 * An amount that rolls to each new value, like the live counter. React writes the first one (in
 * the server HTML), GSAP the next ones, straight into the node.
 */
function Amount({ value, locale }: { value: number; locale: Locale }) {
  const el = useRef<HTMLSpanElement>(null);
  const [initial] = useState(value);
  const shown = useRef({ v: value });
  useIsoLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const write = () => {
      node.textContent = formatAmount(Math.round(shown.current.v), locale);
    };
    if (prefersReducedMotion()) {
      shown.current.v = value;
      return write();
    }
    const tween = gsap.to(shown.current, {
      v: value,
      duration: 0.3,
      ease: motion.ease,
      onUpdate: write,
    });
    return () => {
      tween.kill();
    };
  }, [value, locale]);
  return <span ref={el}>{formatAmount(initial, locale)}</span>;
}

export function BudgetControl({
  step,
  draft,
  onDraft,
  bins,
  locale,
  labels,
}: Props) {
  const [lo, hi] = step.bounds;
  const range = readRange(draft);
  const [min, max] =
    range && range !== ANY ? [range[0], range[1] ?? hi] : [lo, hi];
  const open = max >= hi;
  const set = (nextMin: number, nextMax: number) => {
    const a = Math.min(nextMin, nextMax - step.snap);
    const b = Math.max(nextMax, nextMin + step.snap);
    onDraft(writeRange([Math.max(lo, a), b >= hi ? null : b]));
  };
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const peak = Math.max(1, ...bins.map((b) => b.count));

  // How wide the price scale is, to tell when the two tags would touch.
  const scale = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = scale.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  // A thumb held: the rail thickens until it is let go, wherever the pointer is then.
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    const release = () => setDragging(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [dragging]);

  const minText = formatAmount(min, locale);
  const maxText = open ? labels.noLimit : formatAmount(max, locale);
  const merged =
    width > 0 &&
    ((pct(max) - pct(min)) / 100) * width <
      (tagWidth(minText) + tagWidth(maxText)) / 2 + 8;
  /** A tag centred on a price, kept within the scale (and the half thumb either side of it). */
  const at = (p: number, text: string) => {
    const w = tagWidth(text);
    return {
      width: w,
      left: `clamp(-12px, calc(${p}% - ${w / 2}px), calc(100% - ${w - 12}px))`,
    };
  };
  const maxTag = open ? labels.noLimit : <Amount value={max} locale={locale} />;
  const ticks = [0, 1, 2, 3, 4].map((k) => lo + (k * (hi - lo)) / 4);

  return (
    <div
      data-dragging={dragging || undefined}
      className={css({
        h: "100%",
        display: "grid",
        gridTemplateRows: "minmax(0, 1fr) auto auto auto",
        gap: "2",
        pt: "1",
      })}
    >
      <div
        aria-hidden
        className={cx(
          inset,
          css({
            minH: "0",
            display: "flex",
            alignItems: "flex-end",
            gap: "3px",
            isolation: "isolate",
          }),
        )}
      >
        <span
          className={band}
          style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }}
        />
        {bins.map((bin) => (
          <span
            key={bin.from}
            data-bar
            className={cx(
              bar,
              bin.to > min && (open || bin.from < max) ? barIn : barOut,
            )}
            style={{ height: `${Math.max(3, (bin.count / peak) * 100)}%` }}
          />
        ))}
      </div>

      <div aria-hidden ref={scale} className={cx(inset, css({ h: "5" }))}>
        {merged ? (
          <span
            className={tag}
            style={at((pct(min) + pct(max)) / 2, `${minText} – ${maxText}`)}
          >
            <Amount value={min} locale={locale} /> – {maxTag}
          </span>
        ) : (
          <>
            <span className={tag} style={at(pct(min), minText)}>
              <Amount value={min} locale={locale} />
            </span>
            <span className={tag} style={at(pct(max), maxText)}>
              {maxTag}
            </span>
          </>
        )}
      </div>

      {/* Taller under a finger: the whole height of the inputs takes the touch. */}
      <div
        className={css({ position: "relative", h: "6", _coarse: { h: "10" } })}
      >
        <div
          className={css({
            position: "absolute",
            top: "0",
            bottom: "0",
            left: "3",
            right: "3",
          })}
        >
          <div
            className={css({
              position: "absolute",
              insetInline: "0",
              top: "50%",
              h: "1",
              mt: "-0.5",
              bg: "line",
              borderRadius: "full",
            })}
          />
          <div
            className={fill}
            style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }}
          />
        </div>
        <input
          type="range"
          aria-label={labels.min}
          aria-valuetext={minText}
          className={thumb}
          min={lo}
          max={hi}
          step={step.snap}
          value={min}
          onPointerDown={() => setDragging(true)}
          onBlur={() => setDragging(false)}
          onChange={(e) => set(Number(e.target.value), max)}
        />
        <input
          type="range"
          aria-label={labels.max}
          aria-valuetext={maxText}
          className={thumb}
          min={lo}
          max={hi}
          step={step.snap}
          value={max}
          onPointerDown={() => setDragging(true)}
          onBlur={() => setDragging(false)}
          onChange={(e) => set(min, Number(e.target.value))}
        />
      </div>

      <div
        aria-hidden
        className={cx(
          inset,
          css({
            h: "4",
            fontFamily: "mono",
            fontSize: "2xs",
            lineHeight: "1rem",
            color: "ink.faint",
          }),
        )}
      >
        {ticks.map((value, k) => (
          <span
            key={value}
            className={css({ position: "absolute", top: "0" })}
            style={
              k === 0
                ? { left: 0 }
                : k === ticks.length - 1
                  ? { right: 0 }
                  : { left: `${k * 25}%`, transform: "translateX(-50%)" }
            }
          >
            {formatAmount(value, locale)}
            {k === ticks.length - 1 && "+"}
          </span>
        ))}
      </div>
    </div>
  );
}
