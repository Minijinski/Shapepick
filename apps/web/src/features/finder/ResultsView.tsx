import type { CatalogItem, Locale, Ranked } from "@choose/catalog";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { css, cx } from "styled-system/css";
import { button } from "styled-system/recipes";
import { messages as m } from "~/i18n/messages";
import { gsap, prefersReducedMotion, useGSAP } from "../motion/gsap";
import { motion } from "../motion/tokens";
import { KeyFigures } from "../product/KeyFigures";
import { Match } from "../product/Match";
import { MatchBreakdown } from "../product/MatchBreakdown";
import { KeySpecs } from "../product/ProductHero";
import { ProductPicture } from "../product/ProductPicture";
import { formatPrice, keySpecs } from "../product/specs";
import { useDockHeight } from "./DockPanel";

// The end of the questionnaire, in the dock's panel: the console grows into it and shrinks back
// out of it. The best match as a product card (its photo beside its name, price, match and key
// specs, then what its match is made of), the next two below it, every other match in a list.
// Every product opens its sheet: the best match from its photo or its button, the others from
// anywhere on their card or row. The list can hold the whole catalogue: only the rows in view (and
// a few around them) are rendered, each the same height, so opening the results costs the same
// for 5 products as for 500.

type Props = {
  ranked: Ranked<CatalogItem>[];
  /** False until an answer gives the ranking something to go on: no match is printed then. */
  scored?: boolean;
  /** The use the visitor picked, which the match is measured against. */
  use: string | null;
  locale: Locale;
  onEdit: () => void;
  onReset: () => void;
  onOpen: (slug: string) => void;
};

/** Height of a row of the list (px), which places every row without measuring any. */
const ROW = 56;
/** Rows rendered beyond those in view, above and below, for a scroll to never reveal a gap. */
const OVERSCAN = 8;

const useIsoLayoutEffect =
  typeof window === "undefined" ? () => {} : useLayoutEffect;

/**
 * Which rows of a list of `count` rows of `ROW` px are in view in `scroller`, with `OVERSCAN` on
 * either side: followed on scroll and resize, once per frame.
 */
function useRowsInView(
  scroller: RefObject<HTMLElement | null>,
  list: RefObject<HTMLElement | null>,
  count: number,
) {
  const [range, setRange] = useState({ start: 0, end: Math.min(count, 24) });
  useIsoLayoutEffect(() => {
    const box = scroller.current;
    const el = list.current;
    if (!box || !el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      // Where the list starts in the scrolled content, from the layout rather than the screen:
      // the panel opens with a 3D tilt that would skew any on-screen measure.
      const top =
        el.offsetParent === box
          ? el.offsetTop
          : el.getBoundingClientRect().top -
            box.getBoundingClientRect().top +
            box.scrollTop;
      const first = Math.floor((box.scrollTop - top) / ROW) - OVERSCAN;
      const last =
        Math.ceil((box.scrollTop + box.clientHeight - top) / ROW) + OVERSCAN;
      const start = Math.max(0, Math.min(count, first));
      const end = Math.max(start, Math.min(count, last));
      setRange((r) =>
        r.start === start && r.end === end ? r : { start, end },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    box.addEventListener("scroll", schedule, { passive: true });
    const resized = new ResizeObserver(schedule);
    resized.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      box.removeEventListener("scroll", schedule);
      resized.disconnect();
    };
  }, [count]);
  return range;
}

/** A card or row that opens its product's sheet: a button stretched over the whole of it. */
const opener = css({
  position: "absolute",
  inset: "0",
  borderRadius: "inherit",
  cursor: "pointer",
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "signal",
    outlineOffset: "2px",
  },
});

const caption = css({
  fontFamily: "mono",
  fontSize: "2xs",
  color: "ink.faint",
  textTransform: "uppercase",
  mb: "2",
});
/** What the best match's match is made of, its strengths and caveats, under a hairline. */
const heroNotes = css({
  display: "grid",
  gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
  gap: "4",
  pt: "5",
  borderTopWidth: "1px",
  borderColor: "line",
});
const heroNotesScored = css({
  display: "grid",
  gridTemplateColumns: { base: "1fr", md: "1.15fr 1fr 1fr" },
  gap: { base: "4", md: "6" },
  pt: "5",
  borderTopWidth: "1px",
  borderColor: "line",
});

/** The best match's photo, on the canvas's dotted paper, as in its sheet: it opens the sheet. */
const photoCard = css({
  position: "relative",
  display: "block",
  h: { base: "44", md: "auto" },
  minH: { md: "64" },
  borderRadius: "card",
  borderWidth: "1px",
  borderColor: "line",
  bg: "paper",
  backgroundImage: "radial-gradient(#CFCBC2 1.1px, transparent 1.3px)",
  backgroundSize: "14px 14px",
  cursor: "pointer",
  transition: "border-color 160ms",
  _hover: { borderColor: "line.strong" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "signal",
    outlineOffset: "2px",
  },
});
/** One cell the size of the card: the photo fills it rather than growing the row. */
const photoFrame = css({
  position: "absolute",
  inset: "0",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gridTemplateRows: "minmax(0, 1fr)",
  placeItems: "center",
  p: { base: "4", md: "6" },
  transition: "transform 450ms token(easings.signal)",
  _groupHover: { transform: "translateY(-3px) scale(1.02)" },
  _motionReduce: { transition: "none" },
});

export function ResultsView({
  ranked,
  scored = true,
  use,
  locale,
  onEdit,
  onReset,
  onOpen,
}: Props) {
  const root = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const leaving = useRef(false);
  const [first, ...others] = ranked;
  const runnersUp = others.slice(0, 2);
  const rest = others.slice(2);
  const rows = useRowsInView(root, list, rest.length);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const tl = gsap.timeline({ defaults: { ease: motion.ease } });
      // The panel grows into the results: they fade in as it opens.
      tl.from(root.current, { opacity: 0, duration: motion.base, delay: 0.08 });
      tl.from(
        "[data-spec]",
        { opacity: 0, y: 6, duration: motion.base, stagger: 0.06 },
        "-=0.3",
      );
      tl.from(
        "[data-result]",
        { opacity: 0, y: 12, duration: motion.base, stagger: 0.04 },
        "<0.1",
      );
    },
    { scope: root },
  );
  useDockHeight();

  /** Fades the results out, then lets the console take their place again. */
  const leave = (then: () => void) => () => {
    if (leaving.current) return;
    leaving.current = true;
    const el = root.current;
    if (!el || prefersReducedMotion() || document.hidden) return then();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      then();
    };
    gsap.to(el, {
      opacity: 0,
      duration: motion.fast,
      ease: motion.easeIn,
      onComplete: finish,
    });
    window.setTimeout(finish, (motion.fast + 0.2) * 1000);
  };

  return (
    <section
      ref={root}
      aria-labelledby="results-title"
      className={css({
        // The list's rows are placed from it (offsetTop).
        position: "relative",
        flexShrink: "0",
        // Room above for the counter, below for the journey bar.
        maxH: "calc(100dvh - 290px)",
        overflowY: "auto",
        overscrollBehavior: "contain",
      })}
    >
      <header
        className={css({
          position: "sticky",
          top: "0",
          zIndex: "1",
          display: "flex",
          // A phone puts the buttons under the title rather than breaking their words.
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          columnGap: "3",
          rowGap: "2",
          px: { base: "4", md: "6" },
          py: "4",
          bg: "surface.raised/90",
          backdropFilter: "blur(10px)",
          borderBottomWidth: "1px",
          borderColor: "line",
        })}
      >
        <h2
          id="results-title"
          className={css({
            fontSize: { base: "xl", md: "2xl" },
            fontWeight: "600",
            letterSpacing: "-0.03em",
          })}
        >
          {m.resultsTitle[locale]}
        </h2>
        <div
          className={css({ display: "flex", gap: "2", whiteSpace: "nowrap" })}
        >
          <button
            type="button"
            className={button({ tone: "line", size: "sm" })}
            onClick={leave(onEdit)}
          >
            {m.editAnswers[locale]}
          </button>
          <button
            type="button"
            className={button({ tone: "ghost", size: "sm" })}
            onClick={leave(onReset)}
          >
            {m.reset[locale]}
          </button>
        </div>
      </header>

      {!first ? (
        <p className={css({ p: "8", color: "ink.muted" })}>
          {m.resultsEmpty[locale]}
        </p>
      ) : (
        <div
          className={css({
            p: { base: "4", md: "6" },
            display: "grid",
            gap: "8",
          })}
        >
          {/* The best match: a product card whose name, figures and specs can be selected and
              copied, like a sheet. */}
          <article
            className={css({ display: "grid", gap: "6", userSelect: "text" })}
          >
            <div
              className={css({
                display: "grid",
                gridTemplateColumns: {
                  base: "minmax(0, 1fr)",
                  md: "minmax(0, 1fr) minmax(0, 1.1fr)",
                },
                gap: { base: "4", md: "8" },
              })}
            >
              <button
                type="button"
                className={cx("group", photoCard)}
                aria-label={m.sheetOf(
                  `${first.item.brand.name} ${first.item.name}`,
                  locale,
                )}
                onClick={() => onOpen(first.item.slug)}
              >
                <span className={photoFrame}>
                  <ProductPicture
                    item={first.item}
                    shadow="lg"
                    className={css({ w: "100%", h: "100%" })}
                  />
                </span>
              </button>
              <div
                className={css({
                  display: "grid",
                  alignContent: "center",
                  gap: "5",
                })}
              >
                <div className={css({ display: "grid", gap: "1.5" })}>
                  <span
                    className={css({
                      fontFamily: "mono",
                      fontSize: "xs",
                      color: "signal",
                    })}
                  >
                    01
                  </span>
                  <h3
                    className={css({
                      fontSize: { base: "2xl", md: "3xl" },
                      fontWeight: "650",
                      letterSpacing: "-0.04em",
                      lineHeight: "1.05",
                    })}
                  >
                    <span
                      className={css({ color: "ink.muted", fontWeight: "500" })}
                    >
                      {first.item.brand.name}
                    </span>{" "}
                    {first.item.name}
                  </h3>
                  {first.item.tagline && (
                    <p
                      className={css({
                        mt: "0.5",
                        color: "ink.muted",
                        lineHeight: "1.45",
                      })}
                    >
                      {first.item.tagline[locale]}
                    </p>
                  )}
                </div>
                <KeyFigures
                  price={first.item.priceEur}
                  score={scored ? first.score : null}
                  accent
                  locale={locale}
                  action={
                    <button
                      type="button"
                      className={button({ tone: "ink", size: "md" })}
                      onClick={() => onOpen(first.item.slug)}
                    >
                      {m.viewSheet[locale]} →
                    </button>
                  }
                />
                <KeySpecs item={first.item} locale={locale} />
              </div>
            </div>
            <div className={scored ? heroNotesScored : heroNotes}>
              {scored && (
                <div>
                  <h4 className={caption}>{m.match[locale]}</h4>
                  <MatchBreakdown
                    fit={first.fit}
                    met={first.met}
                    use={use}
                    locale={locale}
                  />
                </div>
              )}
              {first.pros.length > 0 && (
                <div>
                  <h4
                    className={css({
                      fontFamily: "mono",
                      fontSize: "2xs",
                      color: "ink.faint",
                      textTransform: "uppercase",
                      mb: "2",
                    })}
                  >
                    {m.strengths[locale]}
                  </h4>
                  <ul
                    className={css({
                      display: "grid",
                      gap: "1",
                      fontSize: "sm",
                    })}
                  >
                    {first.pros.map((p) => (
                      <li key={p.en}>+ {p[locale]}</li>
                    ))}
                  </ul>
                </div>
              )}
              {first.cons.length > 0 && (
                <div>
                  <h4
                    className={css({
                      fontFamily: "mono",
                      fontSize: "2xs",
                      color: "ink.faint",
                      textTransform: "uppercase",
                      mb: "2",
                    })}
                  >
                    {m.caveats[locale]}
                  </h4>
                  <ul
                    className={css({
                      display: "grid",
                      gap: "1",
                      fontSize: "sm",
                      color: "ink.muted",
                    })}
                  >
                    {first.cons.map((c) => (
                      <li key={c.en}>– {c[locale]}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </article>

          {runnersUp.length > 0 && (
            <div
              className={css({
                display: "grid",
                gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
                gap: "3",
              })}
            >
              {runnersUp.map((entry, i) => (
                <article
                  key={entry.item.slug}
                  data-result
                  className={css({
                    position: "relative",
                    display: "grid",
                    gap: "3",
                    p: "4",
                    borderRadius: "card",
                    borderWidth: "1px",
                    borderColor: "line",
                    bg: "surface",
                    transition: "border-color 160ms, background 160ms",
                    _hover: {
                      borderColor: "line.strong",
                      bg: "surface.raised",
                    },
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontFamily: "mono",
                      fontSize: "xs",
                      color: "ink.faint",
                    })}
                  >
                    <span>{String(i + 2).padStart(2, "0")}</span>
                    {scored && (
                      <Match score={entry.score} locale={locale} size="sm" />
                    )}
                  </div>
                  <div
                    className={css({
                      h: "24",
                      display: "grid",
                      placeItems: "center",
                    })}
                  >
                    <ProductPicture
                      item={entry.item}
                      className={css({ maxH: "24", w: "80%", h: "auto" })}
                    />
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: "3",
                    })}
                  >
                    <h3
                      className={css({
                        fontWeight: "600",
                        letterSpacing: "-0.02em",
                      })}
                    >
                      <span
                        className={css({
                          color: "ink.muted",
                          fontWeight: "500",
                        })}
                      >
                        {entry.item.brand.name}
                      </span>{" "}
                      {entry.item.name}
                    </h3>
                    <span
                      className={css({ fontFamily: "mono", fontSize: "sm" })}
                    >
                      {formatPrice(entry.item.priceEur, locale)}
                    </span>
                  </div>
                  <dl
                    className={css({
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      columnGap: "3",
                      rowGap: "1",
                      fontSize: "xs",
                    })}
                  >
                    {keySpecs(entry.item, locale).map((s) => (
                      <div
                        key={s.label}
                        className={css({ display: "contents" })}
                      >
                        <dt
                          className={css({
                            fontFamily: "mono",
                            color: "ink.faint",
                          })}
                        >
                          {s.label}
                        </dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    type="button"
                    className={opener}
                    aria-label={m.sheetOf(
                      `${entry.item.brand.name} ${entry.item.name}`,
                      locale,
                    )}
                    onClick={() => onOpen(entry.item.slug)}
                  />
                </article>
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className={css({ display: "grid", gap: "2" })}>
              <h4
                className={css({
                  fontFamily: "mono",
                  fontSize: "2xs",
                  color: "ink.faint",
                  textTransform: "uppercase",
                })}
              >
                {m.allResults[locale]} · {rest.length}
              </h4>
              <ol
                ref={list}
                className={css({ position: "relative" })}
                style={{ height: rest.length * ROW }}
              >
                {rest.slice(rows.start, rows.end).map((entry, offset) => {
                  const i = rows.start + offset;
                  return (
                    <li
                      key={entry.item.slug}
                      data-result
                      aria-posinset={i + 1}
                      aria-setsize={rest.length}
                      className={css({
                        position: "absolute",
                        insetInline: "-2",
                        display: "grid",
                        gridTemplateColumns: {
                          base: "28px 56px 1fr auto",
                          md: "28px 72px 1.2fr 2fr auto",
                        },
                        alignItems: "center",
                        gap: "3",
                        px: "2",
                        borderTopWidth: "1px",
                        borderColor: "line",
                        transition: "background 160ms",
                        _hover: { bg: "surface" },
                      })}
                      style={{ top: i * ROW, height: ROW }}
                    >
                      <span
                        className={css({
                          fontFamily: "mono",
                          fontSize: "xs",
                          color: "ink.faint",
                        })}
                      >
                        {String(i + 4).padStart(2, "0")}
                      </span>
                      <ProductPicture
                        item={entry.item}
                        className={css({ h: "8", w: "auto", maxW: "72px" })}
                      />
                      <span
                        className={css({
                          minW: "0",
                          fontWeight: "600",
                          fontSize: "sm",
                          truncate: true,
                        })}
                      >
                        <span
                          className={css({
                            color: "ink.muted",
                            fontWeight: "500",
                          })}
                        >
                          {entry.item.brand.name}
                        </span>{" "}
                        {entry.item.name}
                      </span>
                      <span
                        className={css({
                          display: { base: "none", md: "block" },
                          fontSize: "xs",
                          color: "ink.muted",
                          truncate: true,
                        })}
                      >
                        {keySpecs(entry.item, locale)
                          .map((s) => s.value)
                          .join(" · ")}
                      </span>
                      <span
                        className={css({
                          display: "grid",
                          justifyItems: "end",
                          gap: "0.5",
                        })}
                      >
                        <span
                          className={css({
                            fontFamily: "mono",
                            fontSize: "sm",
                          })}
                        >
                          {formatPrice(entry.item.priceEur, locale)}
                        </span>
                        {scored && (
                          <span
                            className={css({
                              fontFamily: "mono",
                              fontSize: "2xs",
                              color: "ink.faint",
                            })}
                          >
                            {Math.round(entry.score * 100)}%
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className={opener}
                        aria-label={m.sheetOf(
                          `${entry.item.brand.name} ${entry.item.name}`,
                          locale,
                        )}
                        onClick={() => onOpen(entry.item.slug)}
                      />
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
