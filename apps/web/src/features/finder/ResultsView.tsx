import type { CatalogItem, Locale, Ranked } from "@choose/catalog";
import {
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { css, cx } from "styled-system/css";
import { button } from "styled-system/recipes";
import { messages as m } from "~/i18n/messages";
import { gsap, prefersReducedMotion, useGSAP } from "../motion/gsap";
import { motion } from "../motion/tokens";
import { AmazonLink } from "../product/AmazonLink";
import { KeyFigures } from "../product/KeyFigures";
import { Match } from "../product/Match";
import { MatchBreakdown } from "../product/MatchBreakdown";
import { KeySpecs } from "../product/ProductHero";
import { ProductPicture } from "../product/ProductPicture";
import { formatPrice, specCells } from "../product/specs";
import { SpecValue } from "../product/SpecValue";
import { useDockHeight } from "./DockPanel";

// The end of the questionnaire, in the dock's panel: the console grows into it and shrinks back
// out of it. It takes the height of the page down from the site header, the finder's counter and
// answers giving it their place: they come with it, under its title (how many products, the
// brands, a chip per answer that reopens its question). The best match as a product card (its
// photo beside its name, price, match and key specs, then what its match is made of), the next two
// below it, every other match in a list. Every product opens its sheet: the best match from its
// photo or its button, the others from anywhere on their card or row; each also links to Amazon
// (keyboards). The list can hold the whole catalogue: only the rows in view (and a few around
// them) are rendered, each the same height, so opening the results costs the same for 5 products
// as for 500.

type Props = {
  ranked: Ranked<CatalogItem>[];
  /** False until an answer gives the ranking something to go on: no match is printed then. */
  scored?: boolean;
  /** The use the visitor picked, which the match is measured against. */
  use: string | null;
  locale: Locale;
  /** How many products the category holds, beside how many the answers keep. */
  total: number;
  /** The visitor's layout answer (azerty, ansi, iso), which the shop links follow. */
  layouts?: readonly string[];
  /** The brand control, beside the count. */
  brands?: ReactNode;
  onEdit: () => void;
  /** Opens the whole journey (a phone's sheet), where "Edit" leads on a phone. */
  onJourney?: () => void;
  onReset: () => void;
  onOpen: (slug: string) => void;
};

/**
 * Height of a row of the list (px), which places every row without measuring any: a phone's row
 * is taller, its name on two lines with its price and match under it.
 */
const ROW = { wide: 56, phone: 88 };
/** Rows rendered beyond those in view, above and below, for a scroll to never reveal a gap. */
const OVERSCAN = 8;

const useIsoLayoutEffect =
  typeof window === "undefined" ? () => {} : useLayoutEffect;

/** The height of a row on this screen (a wide one's while rendering on the server). */
function useRowHeight() {
  const [height, setHeight] = useState(ROW.wide);
  useIsoLayoutEffect(() => {
    const phone = window.matchMedia("(max-width: 47.99rem)");
    const update = () => setHeight(phone.matches ? ROW.phone : ROW.wide);
    update();
    phone.addEventListener("change", update);
    return () => phone.removeEventListener("change", update);
  }, []);
  return height;
}

/**
 * Which rows of a list of `count` rows of `row` px are in view in `scroller`, with `OVERSCAN` on
 * either side: followed on scroll and resize, once per frame.
 */
function useRowsInView(
  scroller: RefObject<HTMLElement | null>,
  list: RefObject<HTMLElement | null>,
  count: number,
  row: number,
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
      const first = Math.floor((box.scrollTop - top) / row) - OVERSCAN;
      const last =
        Math.ceil((box.scrollTop + box.clientHeight - top) / row) + OVERSCAN;
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
  }, [count, row]);
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
/**
 * What the best match's match is made of, its strengths and caveats: right under it, with no line
 * between, so they read as its own. The hairline comes after them, before the products behind.
 */
const heroNotes = css({
  display: "grid",
  gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
  gap: "4",
});
const heroNotesScored = css({
  display: "grid",
  gridTemplateColumns: { base: "1fr", md: "1.15fr 1fr 1fr" },
  gap: { base: "4", md: "6" },
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

/** The best match's two buttons: on a phone, where they stack, each as wide as the card. */
const actionButton = css({ flex: { base: "1 1 auto", md: "0 0 auto" } });

/** A row of the list: rank, photo, name, specs, price and match, then its Amazon link. */
const row = css({
  position: "absolute",
  insetInline: "-2",
  display: "grid",
  alignItems: "center",
  gap: "3",
  px: "2",
  borderTopWidth: "1px",
  borderColor: "line",
  transition: "background 160ms",
  _hover: { bg: "surface" },
});
/**
 * Rank, picture, name, specs, price, then the Amazon arrow. On a phone: the picture (its rank on
 * it), the name with its price and match under it, the arrow.
 */
// The price has a column of its own width, so the specs line up from row to row.
const rowColumns = css({
  // The arrow is a finger's width under a finger.
  "--amazon-col": "32px",
  _coarse: { "--amazon-col": "2.5rem" },
  gridTemplateColumns: {
    base: "2.75rem minmax(0, 1fr) var(--amazon-col)",
    md: "24px 64px minmax(0, 0.9fr) minmax(0, 2.5fr) 5.5rem var(--amazon-col)",
  },
});

/** A row's four specs, in the columns the list's header names. */
const specColumns = css({
  display: { base: "none", md: "grid" },
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  columnGap: "3",
  alignItems: "center",
  minW: "0",
});

/** In a row, a spec is one line: its value, and at most a short qualifier in grey. */
const rowSpec = css({
  minW: "0",
  fontSize: "sm",
  fontWeight: "500",
  color: "ink",
  fontVariantNumeric: "tabular-nums",
  truncate: true,
});
const rowAside = css({ ml: "1.5", color: "ink.faint", fontWeight: "400" });

const headLabel = css({
  fontFamily: "mono",
  fontSize: "2xs",
  color: "ink.faint",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  truncate: true,
});

const ResetIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-4v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
  </svg>
);

export function ResultsView({
  ranked,
  scored = true,
  use,
  locale,
  total,
  layouts,
  brands,
  onEdit,
  onJourney,
  onReset,
  onOpen,
}: Props) {
  const root = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const leaving = useRef(false);
  const [first, ...others] = ranked;
  const runnersUp = others.slice(0, 2);
  const rest = others.slice(2);
  const rowHeight = useRowHeight();
  const rows = useRowsInView(root, list, rest.length, rowHeight);

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
        // Down from the site header (64 px, then 8) to the journey bar (44 px and the dock's
        // gaps, 12 px between them and 24 px under it), borders included; on a phone, which has
        // no journey bar, to 12 px above the bottom of the screen.
        maxH: {
          base: "calc(100dvh - 84px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
          md: "calc(100dvh - 156px)",
        },
        overflowY: "auto",
        overscrollBehavior: "contain",
      })}
    >
      <header
        className={css({
          position: "sticky",
          top: "0",
          zIndex: "2",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "3",
          px: { base: "4", md: "6" },
          py: { base: "3", md: "4" },
          bg: "surface.raised/90",
          backdropFilter: "blur(10px)",
          borderBottomWidth: "1px",
          borderColor: "line",
        })}
      >
        <h2
          id="results-title"
          className={css({
            fontSize: { base: "lg", md: "2xl" },
            fontWeight: "600",
            letterSpacing: "-0.03em",
            whiteSpace: "nowrap",
          })}
        >
          {m.resultsTitle[locale]}
        </h2>
        {/* A phone has room for "Edit" and the start-over arrow, a wider screen for the words. */}
        <div
          className={css({ display: "flex", gap: "1.5", whiteSpace: "nowrap" })}
        >
          {/* On a phone, every answer at once in the journey's sheet, to pick the one to
              change, the results staying in place; wider, back to the question they were
              opened from. */}
          <button
            type="button"
            className={cx(
              button({ tone: "line", size: "sm" }),
              css({ _coarse: { h: "10", px: "4" } }),
            )}
            onClick={() =>
              onJourney && window.matchMedia("(max-width: 47.99rem)").matches
                ? onJourney()
                : leave(onEdit)()
            }
          >
            <span className={css({ display: { base: "none", md: "inline" } })}>
              {m.editAnswers[locale]}
            </span>
            <span className={css({ display: { base: "inline", md: "none" } })}>
              {m.editShort[locale]}
            </span>
          </button>
          <button
            type="button"
            className={cx(
              button({ tone: "ghost", size: "sm" }),
              css({ _coarse: { h: "10", minW: "10" } }),
            )}
            aria-label={m.reset[locale]}
            onClick={leave(onReset)}
          >
            <span className={css({ display: { base: "none", md: "inline" } })}>
              {m.reset[locale]}
            </span>
            <span className={css({ display: { base: "grid", md: "none" } })}>
              <ResetIcon />
            </span>
          </button>
        </div>
      </header>

      {/* What the results answer: how many products, and the brands. The answers stay on the
          journey bar under the results, where each one reopens its question. */}
      <div
        className={css({
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: "3",
          rowGap: "2.5",
          px: { base: "4", md: "6" },
          pt: { base: "4", md: "5" },
        })}
      >
        <span
          className={css({
            fontFamily: "mono",
            fontSize: "sm",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          })}
        >
          {String(ranked.length).padStart(3, "0")}
          <span className={css({ color: "ink.faint" })}>
            {" "}
            {m.of[locale]} {total}
          </span>
        </span>
        {brands}
      </div>

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
                {/* Where to buy it first, then its sheet. */}
                <KeyFigures
                  price={first.item.priceEur}
                  score={scored ? first.score : null}
                  accent
                  locale={locale}
                  actionBelow
                  action={
                    <div
                      className={css({
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "2",
                        w: { base: "100%", md: "auto" },
                      })}
                    >
                      <AmazonLink
                        item={first.item}
                        locale={locale}
                        layouts={layouts}
                        className={actionButton}
                      />
                      <button
                        type="button"
                        className={cx(
                          button({ tone: "line", size: "md" }),
                          actionButton,
                        )}
                        onClick={() => onOpen(first.item.slug)}
                      >
                        {m.viewSheet[locale]} →
                      </button>
                    </div>
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
            <section
              className={css({
                display: "grid",
                gap: "1",
                pt: "6",
                borderTopWidth: "1px",
                borderColor: "line",
              })}
            >
              <h4 className={caption}>{m.runnersUp[locale]}</h4>
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
                    {/* The name keeps the width it needs: on a narrow card the price and the
                        shop go under it rather than squeezing it. */}
                    <div
                      className={css({
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        columnGap: "3",
                        rowGap: "2",
                      })}
                    >
                      <h3
                        className={css({
                          flex: "1 1 12rem",
                          minW: "0",
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
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: "2.5",
                          flexShrink: "0",
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
                        <AmazonLink
                          item={entry.item}
                          locale={locale}
                          layouts={layouts}
                          variant="pill"
                        />
                      </span>
                    </div>
                    <dl
                      className={css({
                        display: "grid",
                        gridTemplateColumns: "auto minmax(0, 1fr)",
                        alignItems: "center",
                        columnGap: "4",
                        rowGap: "2",
                        fontSize: "xs",
                      })}
                    >
                      {specCells(entry.item, locale).map((cell) => (
                        <div
                          key={cell.label}
                          className={css({ display: "contents" })}
                        >
                          <dt
                            className={css({
                              fontFamily: "mono",
                              color: "ink.faint",
                            })}
                          >
                            {cell.label}
                          </dt>
                          <dd className={css({ minW: "0" })}>
                            <SpecValue cell={cell} layout="inline" />
                          </dd>
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
            </section>
          )}

          {rest.length > 0 && (
            <div className={css({ display: "grid", gap: "2" })}>
              {/* The list's title, then the name of each spec over its column. */}
              <div
                className={cx(
                  rowColumns,
                  css({
                    display: "grid",
                    alignItems: "end",
                    gap: "3",
                    mx: "-2",
                    px: "2",
                  }),
                )}
              >
                <h4
                  className={css({
                    gridColumn: "1 / 4",
                    fontFamily: "mono",
                    fontSize: "2xs",
                    color: "ink.faint",
                    textTransform: "uppercase",
                  })}
                >
                  {m.allResults[locale]} · {rest.length}
                </h4>
                <span aria-hidden className={specColumns}>
                  {(rest[0] ? specCells(rest[0].item, locale) : []).map(
                    (cell) => (
                      <span key={cell.label} className={headLabel}>
                        {cell.label}
                      </span>
                    ),
                  )}
                </span>
                <span
                  aria-hidden
                  className={cx(
                    headLabel,
                    css({
                      display: { base: "none", md: "block" },
                      textAlign: "right",
                    }),
                  )}
                >
                  {m.price[locale]}
                </span>
              </div>
              <ol
                ref={list}
                className={css({ position: "relative" })}
                style={{ height: rest.length * rowHeight }}
              >
                {rest.slice(rows.start, rows.end).map((entry, offset) => {
                  const i = rows.start + offset;
                  const rank = String(i + 4).padStart(2, "0");
                  return (
                    <li
                      key={entry.item.slug}
                      data-result
                      aria-posinset={i + 1}
                      aria-setsize={rest.length}
                      className={cx("group", row, rowColumns)}
                      style={{ top: i * rowHeight, height: rowHeight }}
                    >
                      <span
                        className={css({
                          display: { base: "none", md: "block" },
                          fontFamily: "mono",
                          fontSize: "xs",
                          color: "ink.faint",
                        })}
                      >
                        {rank}
                      </span>
                      {/* On a phone the rank rides on the picture, as on the podium. */}
                      <span
                        className={css({
                          position: "relative",
                          display: "grid",
                          placeItems: "center",
                          h: { base: "11", md: "8" },
                        })}
                      >
                        <ProductPicture
                          item={entry.item}
                          className={css({
                            h: { base: "11", md: "8" },
                            w: "auto",
                            maxW: "100%",
                          })}
                        />
                        <span
                          aria-hidden
                          className={css({
                            display: { base: "grid", md: "none" },
                            position: "absolute",
                            top: "-1",
                            left: "-1",
                            placeItems: "center",
                            minW: "5",
                            h: "4.5",
                            px: "1",
                            borderRadius: "pill",
                            bg: "surface.raised",
                            boxShadow: "0 0 0 1px token(colors.line)",
                            fontFamily: "mono",
                            fontSize: "2xs",
                            lineHeight: "1",
                            color: "ink.muted",
                          })}
                        >
                          {rank}
                        </span>
                      </span>
                      {/* Brand over model, as everywhere else; on a phone the whole name, on
                          two lines if need be, then its price and match. */}
                      <span
                        className={css({
                          display: "grid",
                          minW: "0",
                          lineHeight: "1.25",
                        })}
                      >
                        <span
                          className={css({
                            fontSize: "2xs",
                            color: "ink.muted",
                            truncate: true,
                          })}
                        >
                          {entry.item.brand.name}
                        </span>
                        <span
                          className={css({
                            fontSize: "sm",
                            fontWeight: "600",
                            overflowWrap: "anywhere",
                            lineClamp: { base: "2", md: "1" },
                          })}
                        >
                          {entry.item.name}
                        </span>
                        <span
                          className={css({
                            display: { base: "block", md: "none" },
                            mt: "0.5",
                            fontFamily: "mono",
                            fontSize: "xs",
                            color: "ink.muted",
                            fontVariantNumeric: "tabular-nums",
                          })}
                        >
                          {formatPrice(entry.item.priceEur, locale)}
                          {scored && (
                            <span className={css({ color: "ink.faint" })}>
                              {" · "}
                              {Math.round(entry.score * 100)} %
                            </span>
                          )}
                        </span>
                      </span>
                      <span className={specColumns}>
                        {specCells(entry.item, locale).map((cell) => (
                          <span key={cell.label} className={rowSpec}>
                            {cell.value || cell.details[0] || "—"}
                            {cell.value && cell.aside && (
                              <span className={rowAside}>{cell.aside}</span>
                            )}
                          </span>
                        ))}
                      </span>
                      <span
                        className={css({
                          display: { base: "none", md: "grid" },
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
                      <AmazonLink
                        item={entry.item}
                        locale={locale}
                        layouts={layouts}
                        variant="icon"
                      />
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
