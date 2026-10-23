import type { CatalogItem, Locale, Ranked } from "@choose/catalog";
import { useLayoutEffect, useRef } from "react";
import { css, cx } from "styled-system/css";
import { messages as m } from "~/i18n/messages";
import { Flip, gsap, prefersReducedMotion } from "../motion/gsap";
import { motion } from "../motion/tokens";
import { Match } from "../product/Match";
import { ProductPicture } from "../product/ProductPicture";
import { formatPrice } from "../product/specs";

// The best matches for the answers so far, under a header that says what the numbers are: the
// rank on each drawing, the match as a ring. Three cards, no more (the canvas stays the main
// thing to look at), then a way to the whole ranking. Every entry opens its product's sheet: hovered, the
// drawing lifts and the price gives way to "View details"; until the visitor has opened a sheet,
// the best match plays that once by itself. When the ranking changes, GSAP Flip moves each entry
// from where it was to where it now belongs, so a product visibly climbs or drops. Before the first
// answer there is nothing to rank on: the page keeps the podium out of sight (Finder), and its
// entries come in one after the other once there is a ranking.

const useIsoLayoutEffect =
  typeof window === "undefined" ? () => {} : useLayoutEffect;

/** How many products the podium shows at most. */
export const PODIUM_SIZE = 3;

const frosted = css({
  bg: "surface.raised/80",
  backdropFilter: "blur(8px)",
  borderWidth: "1px",
  borderColor: "line",
  borderRadius: "card",
  cursor: "pointer",
  textAlign: "left",
  transition: "border-color 160ms, background 160ms, box-shadow 300ms",
  _hover: {
    borderColor: "line.strong",
    bg: "surface.raised",
    boxShadow: "0 12px 28px -18px rgba(20,20,20,0.35)",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "signal",
    outlineOffset: "2px",
  },
});

const card = cx(
  "group",
  frosted,
  css({
    display: "grid",
    gridTemplateColumns: {
      base: "48px minmax(0, 1fr) auto",
      md: "64px minmax(0, 1fr) auto",
    },
    alignItems: "center",
    gap: "3",
    w: "100%",
    px: "3",
    py: "2",
    "&[data-first]": {
      borderColor: "signal",
      _hover: { borderColor: "signal" },
    },
  }),
);

const compact = cx(
  "group",
  frosted,
  css({
    display: "grid",
    gridTemplateColumns: "1.25rem 2.5rem minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "2.5",
    w: "100%",
    h: "10",
    px: "3",
    fontSize: "xs",
  }),
);

/** The drawing lifts under the pointer: the card is something to open. */
const lift = css({
  transition: "transform 450ms token(easings.signal)",
  _groupHover: { transform: "translateY(-3px) scale(1.06)" },
  _groupFocusVisible: { transform: "translateY(-3px) scale(1.06)" },
  "[data-hint] &": { animation: "hintLift 2.4s token(easings.signal) 1.4s" },
  _motionReduce: { transition: "none", animation: "none" },
});

/** One line that swaps the price for "View details →" under the pointer. */
const swap = css({
  display: "grid",
  overflow: "hidden",
  "& > *": {
    gridArea: "1 / 1",
    transition: "transform 380ms token(easings.signal)",
  },
  "& > :last-child": {
    transform: "translateY(115%)",
    color: "ink",
    fontWeight: "550",
  },
  _groupHover: {
    "& > :first-child": { transform: "translateY(-115%)" },
    "& > :last-child": { transform: "translateY(0)" },
  },
  _groupFocusVisible: {
    "& > :first-child": { transform: "translateY(-115%)" },
    "& > :last-child": { transform: "translateY(0)" },
  },
  "[data-hint] &": {
    "& > :first-child": {
      animation: "hintOut 2.4s token(easings.signal) 1.4s",
    },
    "& > :last-child": { animation: "hintIn 2.4s token(easings.signal) 1.4s" },
  },
  _motionReduce: { "& > *": { transition: "none", animation: "none" } },
});

// Ranks 4 and 5 show only if the column is tall enough for them under the header, the three cards
// and the "See all" button (19rem), each row taking 3.125rem more.
const fourth = css({
  display: "none",
  "@container (min-height: 22.25rem)": { display: "block" },
});
const fifth = css({
  display: "none",
  "@container (min-height: 25.25rem)": { display: "block" },
});

const columnLabel = css({
  fontFamily: "mono",
  fontSize: "2xs",
  color: "ink.faint",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
});

/** What the match is made of, under the column header: shown while it is hovered or focused. */
const matchHelp = css({
  position: "absolute",
  top: "calc(100% + 8px)",
  right: "-3",
  zIndex: "5",
  display: "grid",
  gap: "1.5",
  w: "72",
  p: "3.5",
  bg: "surface.raised/95",
  backdropFilter: "blur(12px)",
  borderWidth: "1px",
  borderColor: "line",
  borderRadius: "card",
  boxShadow: "panel",
  fontSize: "xs",
  lineHeight: "1.5",
  color: "ink.muted",
  textAlign: "left",
  textTransform: "none",
  letterSpacing: "normal",
  opacity: 0,
  visibility: "hidden",
  transform: "translateY(-4px)",
  transition:
    "opacity 200ms, transform 300ms token(easings.signal), visibility 0s 300ms",
  _groupHover: {
    opacity: 1,
    visibility: "visible",
    transform: "translateY(0)",
    transitionDelay: "0s",
  },
  _groupFocusWithin: {
    opacity: 1,
    visibility: "visible",
    transform: "translateY(0)",
    transitionDelay: "0s",
  },
});

export function Podium({
  top,
  total,
  informed = true,
  locale,
  layout = "column",
  hint = false,
  onOpen,
  onShowAll,
}: {
  top: Ranked<CatalogItem>[];
  /** How many products the answers keep: the whole ranking behind "See all". */
  total: number;
  /** False until an answer gives the ranking something to go on. */
  informed?: boolean;
  locale: Locale;
  layout?: "column" | "row";
  /** The best match shows once, by itself, what hovering it does. */
  hint?: boolean;
  onOpen: (slug: string) => void;
  onShowAll: () => void;
}) {
  const root = useRef<HTMLOListElement>(null);
  /** Where the entries stood before the ranking changed, and the ranking on screen. */
  const before = useRef<Flip.FlipState | null>(null);
  const drawn = useRef<string | null>(null);
  // Before the first answer there is no entry: the first ranking enters as a whole.
  const signature = informed ? top.map((r) => r.item.slug).join("|") : "";
  // Entries hidden for lack of room take no part in the move.
  const entries = () =>
    [
      ...(root.current?.querySelectorAll<HTMLElement>("[data-flip-id]") ?? []),
    ].filter((el) => el.getClientRects().length > 0);
  // The ranking is about to change: each entry's place is read now, while the page still shows
  // the old order (a move under way is read where it is, then finished, so the new places measure
  // clean). Read after Flip.from instead, they would end each move as it begins.
  if (
    typeof window !== "undefined" &&
    drawn.current !== null &&
    drawn.current !== signature &&
    !before.current
  ) {
    before.current = Flip.getState(entries());
  }

  useIsoLayoutEffect(() => {
    const from = before.current;
    before.current = null;
    drawn.current = signature;
    if (!from || prefersReducedMotion()) return;
    Flip.from(from, {
      targets: entries(),
      duration: motion.base + 0.1,
      ease: motion.ease,
      // Entries stay in the list's flow: newcomers fade in where they belong.
      scale: false,
      onEnter: (els) =>
        gsap.fromTo(
          els,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: motion.base,
            ease: motion.ease,
            stagger: 0.07,
          },
        ),
      onLeave: (els) => gsap.to(els, { opacity: 0, duration: motion.fast }),
    });
  }, [signature]);

  const row = layout === "row";
  const name = (entry: Ranked<CatalogItem>) =>
    `${entry.item.brand.name} ${entry.item.name}`;
  if (row && !informed) return null;

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: row ? "row" : "column",
        gap: "2.5",
        overflowX: row ? "auto" : undefined,
        scrollbarWidth: "none",
      })}
    >
      {!row && (
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            px: "3",
          })}
        >
          <span className={columnLabel}>{m.ranking[locale]}</span>
          <span className={cx("group", css({ position: "relative" }))}>
            <button
              type="button"
              aria-describedby="match-help"
              className={cx(
                columnLabel,
                css({
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "1",
                  cursor: "help",
                  _hover: { color: "ink.muted" },
                }),
              )}
            >
              {m.match[locale]}
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 16v-4.5M12 8h.01" />
              </svg>
            </button>
            <span id="match-help" role="tooltip" className={matchHelp}>
              <strong className={css({ color: "ink", fontWeight: "600" })}>
                {m.matchHow[locale]}
              </strong>
              <span>{m.matchExplain[locale]}</span>
              <span>{m.matchSeeSheet[locale]}</span>
            </span>
          </span>
        </div>
      )}
      <ol
        ref={root}
        className={css({
          display: "flex",
          flexDirection: row ? "row" : "column",
          gap: "2.5",
        })}
      >
        {informed && top.map((entry, i) => {
          const asCard = row || i < 3;
          const first = i === 0;
          return (
            <li
              key={entry.item.slug}
              data-flip-id={entry.item.slug}
              className={cx(
                css({ flexShrink: "0", minW: row ? "60" : undefined }),
                !row && i === 3 && fourth,
                !row && i === 4 && fifth,
              )}
            >
              {asCard ? (
                <button
                  type="button"
                  className={card}
                  data-first={first || undefined}
                  data-hint={(hint && first) || undefined}
                  onClick={() => onOpen(entry.item.slug)}
                >
                  <span
                    className={css({
                      position: "relative",
                      display: "grid",
                      placeItems: "center",
                      h: { base: "9", md: "10" },
                    })}
                  >
                    <span
                      className={cx(
                        lift,
                        css({ display: "grid", placeItems: "center" }),
                      )}
                    >
                      <ProductPicture
                        item={entry.item}
                        className={css({
                          maxH: { base: "9", md: "10" },
                          maxW: "100%",
                          w: "100%",
                          h: "auto",
                        })}
                      />
                    </span>
                    <span
                      className={css({
                        position: "absolute",
                        top: "-1.5",
                        left: "-1.5",
                        display: "grid",
                        placeItems: "center",
                        minW: "4.5",
                        h: "4.5",
                        px: "1",
                        borderRadius: "pill",
                        fontFamily: "mono",
                        fontSize: "2xs",
                        lineHeight: "1",
                        bg: "ink",
                        color: "paper",
                        boxShadow: "0 0 0 2px token(colors.surface.raised)",
                        "[data-first] &": { bg: "signal", color: "white" },
                      })}
                    >
                      <span className={css({ srOnly: true })}>n° </span>
                      {i + 1}
                    </span>
                  </span>
                  <span
                    className={css({ minW: "0", display: "grid", gap: "0.5" })}
                  >
                    {/* Brand over model, as everywhere else: a long name stays readable. */}
                    <span
                      className={css({
                        fontSize: "2xs",
                        lineHeight: "1.35",
                        color: "ink.muted",
                        truncate: true,
                      })}
                    >
                      {entry.item.brand.name}
                    </span>
                    <span
                      className={css({
                        fontWeight: "600",
                        fontSize: "sm",
                        lineHeight: "1.2",
                        truncate: true,
                      })}
                    >
                      {entry.item.name}
                    </span>
                    <span
                      className={cx(
                        swap,
                        css({ fontSize: "xs", lineHeight: "1.4" }),
                      )}
                    >
                      <span
                        className={css({
                          fontFamily: "mono",
                          color: "ink.muted",
                        })}
                      >
                        {formatPrice(entry.item.priceEur, locale)}
                      </span>
                      <span aria-hidden>{m.viewSheet[locale]} →</span>
                    </span>
                  </span>
                  <Match
                    score={entry.score}
                    locale={locale}
                    size="sm"
                    accent={first}
                    label={false}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  className={compact}
                  onClick={() => onOpen(entry.item.slug)}
                >
                  <span
                    className={css({
                      fontFamily: "mono",
                      fontSize: "2xs",
                      color: "ink.muted",
                    })}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={cx(
                      lift,
                      css({ display: "grid", placeItems: "center", h: "6" }),
                    )}
                  >
                    <ProductPicture
                      item={entry.item}
                      className={css({
                        maxH: "6",
                        maxW: "100%",
                        w: "100%",
                        h: "auto",
                      })}
                    />
                  </span>
                  <span className={css({ fontWeight: "600", truncate: true })}>
                    {name(entry)}
                  </span>
                  <span
                    className={css({ fontFamily: "mono", color: "ink.muted" })}
                  >
                    {Math.round(entry.score * 100)} %
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {total > 0 && (
        <button
          type="button"
          onClick={onShowAll}
          className={cx(
            frosted,
            css({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "3",
              flexShrink: "0",
              h: row ? "auto" : "9",
              minW: row ? "36" : undefined,
              px: "4",
              fontSize: "sm",
              fontWeight: "550",
            }),
          )}
        >
          <span>
            {m.seeAll[locale]}{" "}
            <span
              className={css({
                fontFamily: "mono",
                fontSize: "xs",
                color: "ink.muted",
              })}
            >
              {String(total).padStart(3, "0")}
            </span>
          </span>
          <span aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}
