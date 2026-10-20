import type { CatalogItem, Locale, Ranked } from "@choose/catalog";
import { useRef } from "react";
import { css } from "styled-system/css";
import { button } from "styled-system/recipes";
import { messages as m } from "~/i18n/messages";
import { gsap, prefersReducedMotion, useGSAP } from "../motion/gsap";
import { motion } from "../motion/tokens";
import { AnnotatedHero } from "../product/AnnotatedHero";
import { ProductGlyph } from "../product/glyphs";
import { Match } from "../product/Match";
import { MatchBreakdown } from "../product/MatchBreakdown";
import { formatPrice, keySpecs } from "../product/specs";
import { useDockHeight } from "./DockPanel";

// The end of the questionnaire, in the dock's panel: the console grows into it and shrinks back
// out of it. The best match annotated like a spec drawing, with what its match is made of, the
// next two beside it, every other match in a list below. Leader lines draw themselves in when the
// view opens. Every product opens its sheet: the best match from its button, the others from
// anywhere on their card or row.

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
  const leaving = useRef(false);
  const [first, ...others] = ranked;
  const runnersUp = others.slice(0, 2);
  const rest = others.slice(2);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const tl = gsap.timeline({ defaults: { ease: motion.ease } });
      // The panel grows into the results: they fade in as it opens.
      tl.from(root.current, { opacity: 0, duration: motion.base, delay: 0.08 });
      tl.from(
        "[data-leader-dot]",
        { scale: 0, duration: motion.base, stagger: 0.08 },
        "-=0.4",
      );
      tl.from(
        "[data-leader]",
        {
          attr: { "stroke-dashoffset": 1 },
          duration: motion.base,
          ease: "none",
          stagger: 0.12,
        },
        "<0.1",
      );
      tl.from(
        "[data-callout]",
        { opacity: 0, y: 6, duration: motion.base, stagger: 0.08 },
        "<0.2",
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
          alignItems: "center",
          justifyContent: "space-between",
          gap: "3",
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
        <div className={css({ display: "flex", gap: "2" })}>
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
          <article className={css({ display: "grid", gap: "4" })}>
            <div
              className={css({
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "3",
              })}
            >
              <div>
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
                    fontSize: { base: "2xl", md: "4xl" },
                    fontWeight: "650",
                    letterSpacing: "-0.04em",
                    lineHeight: "1",
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
                  <p className={css({ mt: "2", color: "ink.muted" })}>
                    {first.item.tagline[locale]}
                  </p>
                )}
              </div>
              <div
                className={css({
                  display: "grid",
                  justifyItems: "end",
                  gap: "2",
                })}
              >
                <span className={css({ fontFamily: "mono", fontSize: "2xl" })}>
                  {formatPrice(first.item.priceEur, locale)}
                </span>
                {scored && (
                  <Match score={first.score} locale={locale} size="lg" accent />
                )}
                <button
                  type="button"
                  className={button({ tone: "ink", size: "sm" })}
                  onClick={() => onOpen(first.item.slug)}
                >
                  {m.viewSheet[locale]} →
                </button>
              </div>
            </div>
            <AnnotatedHero item={first.item} locale={locale} />
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
                    <ProductGlyph
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
              <ol className={css({ display: "grid" })}>
                {rest.map((entry, i) => (
                  <li
                    key={entry.item.slug}
                    data-result
                    className={css({
                      position: "relative",
                      display: "grid",
                      gridTemplateColumns: {
                        base: "28px 56px 1fr auto",
                        md: "28px 72px 1.2fr 2fr auto",
                      },
                      alignItems: "center",
                      gap: "3",
                      py: "3",
                      px: "2",
                      mx: "-2",
                      borderTopWidth: "1px",
                      borderColor: "line",
                      transition: "background 160ms",
                      _hover: { bg: "surface" },
                    })}
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
                    <ProductGlyph
                      item={entry.item}
                      className={css({ h: "8", w: "auto", maxW: "72px" })}
                    />
                    <span
                      className={css({ fontWeight: "600", fontSize: "sm" })}
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
                        className={css({ fontFamily: "mono", fontSize: "sm" })}
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
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
