import {
  type Category,
  categories,
  categorySlugs,
  type Locale,
} from "@choose/catalog";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { css, cx } from "styled-system/css";
import { gsap, prefersReducedMotion } from "~/features/motion/gsap";
import { scene } from "~/features/scene/controller";
import {
  bandQuads,
  clipPathOf,
  edgeAt,
  frameOf,
  isCompact,
  type Quad,
  type Viewport,
} from "~/features/scene/geometry";
import {
  isPlainClick,
  useEnterDelay,
  usePageExit,
  useSceneNavigation,
  useViewport,
} from "~/features/scene/navigation";
import { messages as m } from "~/i18n/messages";

// The home page: the scene draws one tilted panel per category behind a single line of copy.
// Each panel is a link laid over its drawing with the same shape, so hover, focus, a click and a
// middle click all behave like the link they are. Picking a panel opens it over the others into
// that category's canvas.

export const Route = createFileRoute("/$lang/")({
  head: ({ params }) => {
    const lang = params.lang as Locale;
    return {
      meta: [
        { title: `choose-a-device · ${m.homeKicker[lang]}` },
        { name: "description", content: m.homeLead[lang] },
      ],
      links: [
        { rel: "canonical", href: `/${lang}` },
        { rel: "alternate", hrefLang: "fr", href: "/fr" },
        { rel: "alternate", hrefLang: "en", href: "/en" },
      ],
    };
  },
  component: Home,
});

const layout = getRouteApi("/$lang");

/**
 * A slot text rises out of. Its padding leaves room for what glyphs draw outside their line box
 * (accents above, descenders below), so nothing is clipped at rest; hidden, the text sits a whole
 * line plus half an em lower (`translateY(calc(100% + 0.5em))`, as in `wordUp`), so nothing peeks
 * out, whatever the text.
 */
const slot = css({
  overflow: "hidden",
  verticalAlign: "top",
  pt: "0.22em",
  mt: "-0.22em",
  pb: "0.16em",
  mb: "-0.16em",
  px: "0.06em",
  mx: "-0.06em",
});
/** Out through the top of its slot: a whole line plus half an em up. */
const outAbove = (_: number, el: Element) =>
  -(
    (el as HTMLElement).offsetHeight +
    0.5 * Number.parseFloat(getComputedStyle(el).fontSize)
  );

const word = css({
  display: "inline-block",
  animation: "wordUp 1s token(easings.signal) backwards",
  _motionReduce: { animation: "none" },
});
const fade = css({
  animation: "fadeUp 0.9s token(easings.signal) backwards",
  _motionReduce: { animation: "none" },
});

function Home() {
  const { catalogs } = layout.useLoaderData();
  const locale = Route.useParams().lang as Locale;
  const viewport = useViewport();
  const quads = useMemo(
    () => (viewport ? bandQuads(viewport, categories.length) : null),
    [viewport],
  );
  const spots = useMemo(() => {
    if (!viewport || !quads) return null;
    const each = quads.map((quad) => labelSpot(quad, viewport));
    // One size for every name: the largest at which each name still fits its own panel.
    const fit = Math.min(
      ...categories.map(
        (c, i) => (each[i]?.width ?? 0) / (0.58 * m.category[c][locale].length),
      ),
    );
    return each.map((spot) => ({ ...spot, nameFit: Math.max(20, fit) }));
  }, [viewport, quads, locale]);
  const open = useSceneNavigation();
  const root = useRef<HTMLElement>(null);
  const opening = useRef(false);
  // Back from a category, the copy comes in while the panel is still settling into its slot.
  const delay = useEnterDelay({ mode: "bands" }, 0.55, 0.15);

  useEffect(() => {
    scene.showBands();
    // A pointer already resting on a panel when the scene settles (back from a category) never
    // sends an enter event: hand it over now.
    return scene.whenSettled(() => {
      const hovered =
        root.current?.querySelector<HTMLElement>("[data-band]:hover");
      if (hovered) scene.hoverBand(hovered.dataset.band as Category);
    });
  }, []);

  usePageExit(
    () =>
      new Promise<void>((resolve) => {
        const el = root.current;
        if (!el || prefersReducedMotion()) return resolve();
        const words = el.querySelectorAll("[data-word]");
        const fades = el.querySelectorAll("[data-fade]");
        gsap.set([...words, ...fades], { animation: "none" });
        gsap
          .timeline({ onComplete: resolve, defaults: { ease: "power3.in" } })
          .to(words, { y: outAbove, duration: 0.42, stagger: 0.018 }, 0)
          .to(fades, { opacity: 0, y: -10, duration: 0.3 }, 0)
          .to(
            el.querySelectorAll("[data-band-label]"),
            { opacity: 0, duration: 0.22 },
            0,
          );
      }),
  );

  const pick = (category: Category, e: MouseEvent) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    if (opening.current) return;
    opening.current = true;
    // A keyboard "click" has no position: the panel then opens from its centre.
    open(category, e.detail === 0 ? undefined : { x: e.clientX, y: e.clientY });
  };

  let index = 0;
  const lines = m.homeTitle[locale].split("\n");

  return (
    <main
      ref={root}
      className={css({
        position: "relative",
        h: "100dvh",
        minH: "520px",
        overflow: "hidden",
      })}
    >
      <nav
        aria-label={m.worlds[locale]}
        className={css({ position: "absolute", inset: "0" })}
      >
        {categories.map((category, i) => (
          <BandLink
            key={category}
            category={category}
            index={i}
            quad={quads?.[i] ?? null}
            spot={spots?.[i] ?? null}
            count={catalogs[category].length}
            locale={locale}
            onPick={pick}
          />
        ))}
      </nav>

      <div
        className={css({
          position: "absolute",
          inset: "0",
          display: "grid",
          placeItems: "center",
          px: "6",
          pointerEvents: "none",
        })}
      >
        <div
          className={css({
            position: "relative",
            display: "grid",
            justifyItems: "center",
            gap: { base: "4", md: "5" },
            textAlign: "center",
            maxW: "5xl",
            // Its own stacking context, so the halo below stays above the canvas.
            isolation: "isolate",
          })}
        >
          {/* A frosted paper halo keeps the line legible over the products drifting behind it. */}
          <span
            data-fade
            aria-hidden
            className={cx(
              fade,
              css({
                position: "absolute",
                inset: "-34% -18%",
                zIndex: "-1",
                background:
                  "radial-gradient(closest-side, rgba(243,241,236,0.9), rgba(243,241,236,0.72) 58%, rgba(243,241,236,0))",
                backdropFilter: "blur(8px)",
                maskImage:
                  "radial-gradient(closest-side, #000 62%, transparent)",
                WebkitMaskImage:
                  "radial-gradient(closest-side, #000 62%, transparent)",
              }),
            )}
            style={{ animationDelay: `${delay}s` }}
          />
          <p
            data-fade
            className={cx(
              fade,
              css({
                fontFamily: "mono",
                fontSize: "xs",
                color: "ink.muted",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }),
            )}
            style={{ animationDelay: `${delay}s` }}
          >
            <span className={css({ color: "signal" })}>●</span>{" "}
            {m.homeKicker[locale]}
          </p>
          <h1
            className={css({
              fontSize: "clamp(2.4rem, 1.35rem + 3.5vw, 4.75rem)",
              fontWeight: "650",
              letterSpacing: "-0.035em",
              lineHeight: "1.04",
            })}
          >
            {lines.map((line, l) => (
              <span key={line} className={css({ display: "block" })}>
                {l > 0 && " "}
                {line.split(" ").map((w, j) => {
                  const i = index++;
                  return (
                    <span key={`${w}-${i}`}>
                      {j > 0 && " "}
                      {/* The mask leaves room for accents and overhangs, so nothing is clipped. */}
                      <span
                        className={cx(slot, css({ display: "inline-block" }))}
                      >
                        <span
                          data-word
                          className={word}
                          style={{
                            animationDelay: `${delay + 0.08 + i * 0.05}s`,
                          }}
                        >
                          {w}
                        </span>
                      </span>
                    </span>
                  );
                })}
              </span>
            ))}
          </h1>
          <p
            data-fade
            className={cx(
              fade,
              css({
                fontSize: { base: "md", md: "lg" },
                color: "ink.muted",
                maxW: "34rem",
                lineHeight: "1.5",
              }),
            )}
            style={{ animationDelay: `${delay + 0.45}s` }}
          >
            {m.homeSub[locale]}
          </p>
        </div>
      </div>
    </main>
  );
}

// ---- One panel ----------------------------------------------------------------------------------

/** Height the label (plate included) may rise above its foot, in px, when checking its room. */
const LABEL_REACH = 140;

type LabelSpot = {
  left: number;
  bottom: number;
  slant: number;
  width: number;
  nameFit: number;
};

/**
 * Where a panel's label sits: its foot at the panel's bottom-left corner, leaning with the left
 * edge, and as wide as the panel allows. Pure geometry, so any number of panels gets labels that
 * stay inside their own panel.
 */
function labelSpot(quad: Quad, viewport: Viewport) {
  // Phones have narrow panels: a tighter margin, and a tighter plate (see `label`).
  const pad = frameOf(viewport).gutter + (isCompact(viewport) ? 14 : 18);
  const bottom = quad[3].y - pad;
  const left = edgeAt(quad, "left", bottom) + pad;
  const slope = (quad[0].x - quad[3].x) / (quad[3].y - quad[0].y);
  // Room up to the right edge, at the label's foot and at its top: the label leans with the
  // left edge, which may lean more than the right one (the last panel's is upright).
  const room = (rise: number) =>
    edgeAt(quad, "right", bottom - rise) - pad - left - rise * slope;
  return {
    left,
    bottom: viewport.h - bottom,
    slant: Math.atan(slope),
    width: Math.max(72, Math.min(room(0), room(LABEL_REACH))),
  };
}

const label = css({
  position: "absolute",
  display: "grid",
  gap: "1.5",
  w: "max-content",
  pointerEvents: "none",
  isolation: "isolate",
  // The label leans with the panel's left edge, so its plate keeps the same margin from the
  // divider all the way up; each line leans back, so the text itself stays upright.
  transform: "skewX(calc(-1 * var(--slant, 0rad)))",
  transformOrigin: "left bottom",
  "& > *": { transform: "skewX(var(--slant, 0rad))" },
  // A frosted plate behind the name, so it stays legible over the products drifting under it.
  _before: {
    content: '""',
    position: "absolute",
    inset: { base: "-10px -12px", md: "-14px -18px -14px -16px" },
    zIndex: "-1",
    borderRadius: "panel",
    bg: "paper/72",
    backdropFilter: "blur(14px) saturate(1.1)",
    boxShadow:
      "0 0 0 1px rgba(20,20,20,0.05), 0 18px 40px -20px rgba(20,20,20,0.25)",
    opacity: 0,
    transform: "scale(0.96)",
    transformOrigin: "left bottom",
    transition: "opacity 450ms, transform 600ms token(easings.signal)",
  },
  "@media (hover: hover)": {
    _groupHover: { _before: { opacity: 1, transform: "scale(1)" } },
    ".group:has(:focus-visible) &": {
      _before: { opacity: 1, transform: "scale(1)" },
    },
  },
  "@media (hover: none)": { _before: { opacity: 1, transform: "scale(1)" } },
});
// Revealed by hovering or focusing the panel; always shown where there is no hover.
const reveal = css({
  transition: "transform 700ms token(easings.signal), opacity 500ms",
  "@media (hover: hover)": {
    _groupHover: { transform: "translateY(0)", opacity: 1 },
    ".group:has(:focus-visible) &": { transform: "translateY(0)", opacity: 1 },
  },
  "@media (hover: none)": { transform: "translateY(0)", opacity: 1 },
});

function BandLink({
  category,
  index,
  quad,
  spot,
  count,
  locale,
  onPick,
}: {
  category: Category;
  index: number;
  quad: Quad | null;
  spot: LabelSpot | null;
  count: number;
  locale: Locale;
  onPick: (category: Category, e: MouseEvent) => void;
}) {
  const name = m.category[category][locale];
  // Before the viewport is known (server, hydration) the panels are plain columns.
  const linkStyle: CSSProperties = quad
    ? { clipPath: clipPathOf(quad) }
    : {
        left: `${(index / categories.length) * 100}%`,
        right: "auto",
        width: `${100 / categories.length}%`,
      };
  const labelStyle: CSSProperties = spot
    ? {
        left: spot.left,
        bottom: spot.bottom,
        maxWidth: `min(30rem, ${spot.width}px)`,
        ["--slant" as string]: `${spot.slant}rad`,
        // A name too long for a narrow panel gets smaller rather than overflowing it.
        ["--name-fit" as string]: `${spot.nameFit}px`,
      }
    : {
        left: `calc(${(index / categories.length) * 100}% + 24px)`,
        bottom: 24,
      };

  // The label sits beside the link rather than inside it, so the link's clip-path can never cut
  // it; the wrapper is the hover group of both.
  return (
    <div
      className={cx(
        "group",
        css({ position: "absolute", inset: "0", pointerEvents: "none" }),
      )}
    >
      <Link
        to="/$lang/$category"
        params={{ lang: locale, category: categorySlugs[category][locale] }}
        data-band={category}
        draggable={false}
        className={css({
          position: "absolute",
          inset: "0",
          display: "block",
          outline: "none",
          pointerEvents: "auto",
          WebkitTapHighlightColor: "transparent",
        })}
        style={linkStyle}
        onPointerEnter={() => scene.hoverBand(category)}
        onPointerLeave={() => scene.hoverBand(null)}
        onFocus={() => scene.hoverBand(category)}
        onBlur={() => scene.hoverBand(null)}
        onClick={(e) => onPick(category, e)}
      >
        <span className={css({ srOnly: true })}>
          {name} · {count} {m.models[locale]} ·{" "}
          {m.categoryPitch[category][locale]}
        </span>
      </Link>
      <span aria-hidden data-band-label className={label} style={labelStyle}>
        <span
          className={css({
            display: "flex",
            alignItems: "center",
            gap: { base: "2", md: "3" },
            fontFamily: "mono",
            fontSize: { base: "2xs", md: "xs" },
            color: "ink.muted",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          })}
        >
          <span
            className={css({
              display: { base: "none", md: "inline" },
              color: "signal",
            })}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span
            aria-hidden
            className={css({
              display: { base: "none", md: "block" },
              w: "16",
              h: "1px",
              bg: "ink",
              transformOrigin: "left center",
              transform: "scaleX(0.25)",
              transition: "transform 700ms token(easings.signal)",
              "@media (hover: hover)": {
                _groupHover: { transform: "scaleX(1)" },
                ".group:has(:focus-visible) &": { transform: "scaleX(1)" },
              },
              "@media (hover: none)": { transform: "scaleX(1)" },
            })}
          />
          <span>
            {String(count).padStart(3, "0")} {m.models[locale]}
          </span>
        </span>
        <span
          className={cx(
            slot,
            css({
              display: "block",
              fontSize: {
                base: "min(1.875rem, var(--name-fit, 1.875rem))",
                md: "min(3rem, var(--name-fit, 3rem))",
              },
              fontWeight: "650",
              letterSpacing: "-0.045em",
              lineHeight: "1",
            }),
          )}
        >
          <span
            className={cx(
              reveal,
              css({
                display: "block",
                overflowWrap: "anywhere",
                transform: "translateY(calc(100% + 0.5em))",
              }),
            )}
          >
            {name}
          </span>
        </span>
        <span className={css({ display: "block" })}>
          <span
            className={cx(
              reveal,
              css({
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                columnGap: "4",
                rowGap: "0.5",
                fontSize: "sm",
                color: "ink.muted",
                opacity: 0,
                transform: "translateY(8px)",
                transitionDelay: "60ms",
              }),
            )}
          >
            <span className={css({ display: { base: "none", md: "inline" } })}>
              {m.categoryPitch[category][locale]}
            </span>
            <span className={css({ fontWeight: "600", color: "ink" })}>
              {m.explore[locale]} →
            </span>
          </span>
        </span>
      </span>
    </div>
  );
}
