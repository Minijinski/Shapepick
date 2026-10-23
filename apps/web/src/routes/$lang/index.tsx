import { type Category, categorySlugs, type Locale } from "@choose/catalog";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import {
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { css, cx } from "styled-system/css";
import { gsap, prefersReducedMotion } from "~/features/motion/gsap";
import { scene } from "~/features/scene/controller";
import {
  bandQuads,
  bandsInRows,
  clipPathOf,
  edgeAt,
  frameOf,
  isCompact,
  type Quad,
  rowsFrame,
  type Viewport,
} from "~/features/scene/geometry";
import {
  isPlainClick,
  useArrival,
  useEnterDelay,
  usePageExit,
  useSceneNavigation,
  useViewport,
} from "~/features/scene/navigation";
import { messages as m } from "~/i18n/messages";

// The home page: the scene draws one tilted panel per category behind a single line of copy.
// Each panel is a link laid over its drawing with the same shape, so hover, focus, a click and a
// middle click all behave like the link they are. Picking a panel opens it over the others into
// that category's canvas. On a phone the panels are rows under the title instead, and the page
// scrolls: the scene moves the rows and this page's layer with the scroll, frame by frame.

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

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

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

/**
 * The page: one screen behind which the slats lie, or, on a phone (styles.css, `[data-home]`), as
 * tall as its rows, which the document scrolls through.
 */
const page = css({
  position: "relative",
  md: { h: "100dvh", minH: "520px", overflow: "hidden" },
});

/**
 * Everything the page lays over the scene. On a phone, once the scene follows the page
 * (`data-follow`), it stays fixed and the scene moves it with the scroll, in step with the rows
 * it draws; until then (server render, no JavaScript), it simply scrolls with the page.
 */
const layer = css({
  position: "absolute",
  inset: "0",
  pointerEvents: "none",
  "&[data-follow]": {
    position: "fixed",
    insetInline: "0",
    top: "0",
    bottom: "auto",
    h: "var(--rows-height)",
    willChange: "transform",
  },
});

/** On a phone, what scrolls fades into paper under the header, which stays legible. */
const underHeader = css({
  position: "fixed",
  insetInline: "0",
  top: "0",
  zIndex: "10",
  h: "calc(5.5rem + env(safe-area-inset-top))",
  pointerEvents: "none",
  background:
    "linear-gradient(to bottom, rgba(243,241,236,0.96) 55%, rgba(243,241,236,0))",
  md: { display: "none" },
});

/** The title: above the rows on a phone, aligned left; centred over the slats on a wider screen. */
const hero = css({
  position: "absolute",
  insetInline: "0",
  top: "16",
  h: "var(--rows-hero)",
  display: "grid",
  alignContent: "center",
  pl: "max(1rem, env(safe-area-inset-left))",
  pr: "max(1rem, env(safe-area-inset-right))",
  md: {
    top: "0",
    bottom: "0",
    h: "auto",
    placeItems: "center",
    alignContent: "normal",
    px: "6",
    // Centred a little above the middle: the panels' names live at their feet.
    pb: "14dvh",
  },
});

function Home() {
  // One panel per category the site offers (`shown`: those with products).
  const { catalogs, shown } = layout.useLoaderData();
  const locale = Route.useParams().lang as Locale;
  const viewport = useViewport();
  // A phone: rows under the title (null while the viewport is unknown: CSS lays the rows out).
  const rows = viewport ? bandsInRows(viewport) : null;
  const frame = useMemo(
    () => (viewport && rows ? rowsFrame(viewport, shown.length) : null),
    [viewport, rows, shown],
  );
  const quads = useMemo(
    () => (viewport ? bandQuads(viewport, shown.length) : null),
    [viewport, shown],
  );
  const spots = useMemo(() => {
    if (!viewport || !quads || rows) return null;
    const each = quads.map((quad) => labelSpot(quad, viewport));
    // One size for every name: the largest at which each name still fits its own panel.
    const fit = Math.min(
      ...shown.map(
        (c, i) => (each[i]?.width ?? 0) / (0.58 * m.category[c][locale].length),
      ),
    );
    return each.map((spot) => ({ ...spot, nameFit: Math.max(20, fit) }));
  }, [viewport, quads, rows, locale, shown]);
  const open = useSceneNavigation();
  const root = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const opening = useRef(false);
  // The panel hovered (or focused): the canvas veils the others, and they blur (BandLink).
  const [hovered, setHovered] = useState<Category | null>(null);
  const hover = (category: Category | null) => {
    scene.hoverBand(category);
    setHovered(category);
  };
  // Back from a category, the copy comes in while the panel is still settling into its slot.
  const delay = useEnterDelay({ mode: "bands" }, 0.55, 0.15);
  const arrival = useArrival({ mode: "bands" });

  // Rows: the scene moves the layer with the page's scroll. Back from a category, the page returns
  // to the scroll it was left at, where the row the visitor opened folds back.
  useIsoLayoutEffect(() => {
    const el = layerRef.current;
    if (!rows || !el) return;
    if (arrival === "close") window.scrollTo(0, scene.homeScroll());
    el.dataset.follow = "";
    scene.followHome(el);
    return () => {
      scene.followHome(null);
      delete el.dataset.follow;
      el.style.transform = "";
    };
  }, [rows, arrival]);

  useEffect(() => {
    scene.showBands();
    // A pointer already resting on a panel when the scene settles (back from a category) never
    // sends an enter event: hand it over now. A finger rests on nothing.
    return scene.whenSettled(() => {
      if (!window.matchMedia("(hover: hover)").matches) return;
      const under =
        root.current?.querySelector<HTMLElement>("[data-band]:hover");
      if (!under) return;
      scene.hoverBand(under.dataset.band as Category);
      setHovered(under.dataset.band as Category);
    });
  }, []);

  usePageExit(
    () =>
      new Promise<void>((resolve) => {
        // The other panels' blur fades while the opening panel covers them.
        setHovered(null);
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
    // A keyboard "click" has no position: the panel opens from its centre.
    open(category, e.detail === 0 ? undefined : { x: e.clientX, y: e.clientY });
  };

  /** A row reached with the keyboard comes into view: the layer is fixed, nothing else scrolls. */
  const reveal = (index: number) => {
    if (!frame) return;
    const top = frame.top + index * (frame.band + frame.gutter);
    const y = window.scrollY;
    if (top >= y + 72 && top + frame.band <= y + window.innerHeight) return;
    window.scrollTo({
      top: Math.max(0, top - 88),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  let index = 0;
  const lines = m.homeTitle[locale].split("\n");
  // The rows' numbers from the viewport, once known; CSS works them out until then.
  const vars: Record<string, string | number> = { "--n": shown.length };
  if (frame) {
    vars["--rows-hero"] = `${frame.hero}px`;
    vars["--rows-top"] = `${frame.top}px`;
    vars["--rows-band"] = `${frame.band}px`;
    vars["--rows-height"] = `${frame.height}px`;
    vars.height = `calc(${frame.height}px + env(safe-area-inset-bottom))`;
  }

  return (
    <main
      ref={root}
      data-home
      className={page}
      style={vars as CSSProperties}
    >
      <div ref={layerRef} data-home-layer className={layer}>
        <nav
          aria-label={m.worlds[locale]}
          className={css({ position: "absolute", inset: "0" })}
        >
          {shown.map((category, i) => (
            <BandLink
              key={category}
              category={category}
              index={i}
              quad={rows === false ? (quads?.[i] ?? null) : null}
              spot={spots?.[i] ?? null}
              count={catalogs[category].length}
              locale={locale}
              veiled={hovered !== null && hovered !== category}
              onHover={hover}
              onPick={pick}
              onReveal={reveal}
            />
          ))}
        </nav>

        <div className={hero}>
          <div
            className={css({
              position: "relative",
              display: "grid",
              justifyItems: "start",
              gap: "3",
              textAlign: "left",
              maxW: "5xl",
              // Its own stacking context, so the halo below stays above the canvas.
              isolation: "isolate",
              md: { justifyItems: "center", gap: "5", textAlign: "center" },
            })}
          >
            {/* A frosted paper halo keeps the line legible over the products drifting behind it
                (a phone's title stands on bare paper, above the rows). */}
            <span
              data-fade
              aria-hidden
              className={cx(
                fade,
                css({
                  display: { base: "none", md: "block" },
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
                // Four lines at most on the narrowest phone, two from about 380 px.
                fontSize: {
                  base: "clamp(1.75rem, 0.9rem + 4.2vw, 2.5rem)",
                  md: "clamp(2.4rem, 1.35rem + 3.5vw, 4.75rem)",
                },
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
          </div>
        </div>
      </div>
      <div aria-hidden className={underHeader} />
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

/**
 * A panel's link. On a phone, a row from the rows' numbers (`--rows-*`, styles.css); on a wider
 * screen the whole screen, cut to the panel's shape (`clipPath`), or a plain column until the
 * viewport is known.
 */
const bandLink = css({
  position: "absolute",
  left: "2",
  right: "2",
  top: "calc(var(--rows-top) + var(--i) * (var(--rows-band) + 8px))",
  h: "var(--rows-band)",
  display: "block",
  borderRadius: "panel",
  outline: "none",
  pointerEvents: "auto",
  WebkitTapHighlightColor: "transparent",
  _focusVisible: { boxShadow: "inset 0 0 0 2px token(colors.signal)" },
  md: {
    top: "0",
    bottom: "0",
    h: "auto",
    left: "calc(var(--i) * 100% / var(--n))",
    right: "auto",
    w: "calc(100% / var(--n))",
    borderRadius: "0",
    _focusVisible: { boxShadow: "none" },
  },
});

const label = css({
  position: "absolute",
  display: "grid",
  gap: "1.5",
  w: "max-content",
  pointerEvents: "none",
  isolation: "isolate",
  // On a phone, its foot at the bottom-left corner of its row.
  left: "5",
  top: "calc(var(--rows-top) + var(--i) * (var(--rows-band) + 8px) + var(--rows-band) - 0.875rem)",
  translate: "0 -100%",
  maxW: "calc(100% - 2.5rem)",
  // The label leans with the panel's left edge, so its plate keeps the same margin from the
  // divider all the way up; each line leans back, so the text itself stays upright.
  transform: "skewX(calc(-1 * var(--slant, 0rad)))",
  transformOrigin: "left bottom",
  "& > *": { transform: "skewX(var(--slant, 0rad))" },
  md: {
    // Until the viewport is known: at the foot of its column.
    left: "calc(var(--i) * 100% / var(--n) + 24px)",
    top: "auto",
    bottom: "24px",
    translate: "none",
    maxW: "none",
  },
  // A frosted plate behind the name, so it stays legible over the products drifting under it:
  // always there on a phone's row, revealed by the pointer on a wider screen.
  _before: {
    content: '""',
    position: "absolute",
    inset: { base: "-10px -12px", md: "-14px -18px -14px -16px" },
    zIndex: "-1",
    borderRadius: "panel",
    bg: "paper/72",
    backdropFilter: "blur(22px) saturate(1.1)",
    boxShadow:
      "0 0 0 1px rgba(20,20,20,0.05), 0 18px 40px -20px rgba(20,20,20,0.25)",
    transformOrigin: "left bottom",
    transition: "opacity 450ms, transform 600ms token(easings.signal)",
    "@media (min-width: 48rem) and (hover: hover)": { opacity: 0, transform: "scale(0.96)" },
  },
  "@media (hover: hover)": {
    _groupHover: { _before: { opacity: 1, transform: "scale(1)" } },
    ".group:has(:focus-visible) &": {
      _before: { opacity: 1, transform: "scale(1)" },
    },
  },
});
/**
 * While another panel is hovered, this one blurs, on top of the paper the canvas veils it with.
 * It lies beside the link, cut to the same shape: inside the link, whose clip-path makes it a
 * backdrop root, the blur would not see the canvas.
 */
const veil = css({
  position: "absolute",
  inset: "0",
  pointerEvents: "none",
  backdropFilter: "blur(3px)",
  opacity: 0,
  visibility: "hidden",
  // The canvas's veil eases in with power3.out over 0.7 s (renderer.ts, hoverBand).
  transition:
    "opacity 700ms cubic-bezier(0.215, 0.61, 0.355, 1), visibility 0s 700ms",
  "&[data-on]": {
    opacity: 1,
    visibility: "visible",
    transition: "opacity 700ms cubic-bezier(0.215, 0.61, 0.355, 1)",
  },
  _motionReduce: { transition: "none" },
});

// Revealed by hovering or focusing the panel on a wider screen with a pointer; always shown on a
// phone's row and where there is no hover.
const reveal = css({
  transition: "transform 700ms token(easings.signal), opacity 500ms",
  "@media (hover: hover)": {
    _groupHover: { transform: "translateY(0)", opacity: 1 },
    ".group:has(:focus-visible) &": { transform: "translateY(0)", opacity: 1 },
  },
});

function BandLink({
  category,
  index,
  quad,
  spot,
  count,
  locale,
  veiled,
  onHover,
  onPick,
  onReveal,
}: {
  category: Category;
  index: number;
  /** Its shape on a wider screen (null on a phone, or while the viewport is unknown). */
  quad: Quad | null;
  spot: LabelSpot | null;
  count: number;
  locale: Locale;
  /** Another panel is hovered: this one blurs. */
  veiled: boolean;
  onHover: (category: Category | null) => void;
  onPick: (category: Category, e: MouseEvent) => void;
  /** Brings its row into view (a phone, reached with the keyboard). */
  onReveal: (index: number) => void;
}) {
  const name = m.category[category][locale];
  // A pointer previews a panel; a finger only opens it.
  const enter = (e: { pointerType: string }) =>
    e.pointerType === "mouse" && onHover(category);
  const leave = (e: { pointerType: string }) =>
    e.pointerType === "mouse" && onHover(null);
  const focus = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.matches(":focus-visible")) return;
    onHover(category);
    onReveal(index);
  };
  const linkStyle: CSSProperties = quad
    ? // The whole screen, cut to the panel's shape.
      { clipPath: clipPathOf(quad), left: 0, width: "100%" }
    : {};
  const labelStyle: CSSProperties = spot
    ? {
        left: spot.left,
        bottom: spot.bottom,
        maxWidth: `min(30rem, ${spot.width}px)`,
        ["--slant" as string]: `${spot.slant}rad`,
        // A name too long for a narrow panel gets smaller rather than overflowing it.
        ["--name-fit" as string]: `${spot.nameFit}px`,
      }
    : {};

  // The label sits beside the link rather than inside it, so the link's clip-path can never cut
  // it; the wrapper is the hover group of both.
  return (
    <div
      className={cx(
        "group",
        css({ position: "absolute", inset: "0", pointerEvents: "none" }),
      )}
      style={{ "--i": index } as CSSProperties}
    >
      <Link
        to="/$lang/$category"
        params={{ lang: locale, category: categorySlugs[category][locale] }}
        data-band={category}
        draggable={false}
        className={bandLink}
        style={linkStyle}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={focus}
        onBlur={() => onHover(null)}
        onClick={(e) => onPick(category, e)}
      >
        <span className={css({ srOnly: true })}>
          {name} · {count} {m.models[locale]} ·{" "}
          {m.categoryPitch[category][locale]}
        </span>
      </Link>
      {quad && (
        <span
          aria-hidden
          data-on={veiled || undefined}
          className={veil}
          style={{ clipPath: clipPathOf(quad) }}
        />
      )}
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
                base: "min(1.625rem, var(--name-fit, 1.625rem))",
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
                "@media (min-width: 48rem) and (hover: hover)": {
                  transform: "translateY(calc(100% + 0.5em))",
                },
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
                columnGap: { base: "3", md: "4" },
                rowGap: "0.5",
                // A phone's row keeps its products in sight: a smaller line under the name.
                fontSize: { base: "xs", md: "sm" },
                color: "ink.muted",
                transitionDelay: "60ms",
                "@media (min-width: 48rem) and (hover: hover)": {
                  opacity: 0,
                  transform: "translateY(8px)",
                },
              }),
            )}
          >
            <span>{m.categoryPitch[category][locale]}</span>
            <span className={css({ fontWeight: "600", color: "ink" })}>
              {m.explore[locale]} →
            </span>
          </span>
        </span>
      </span>
    </div>
  );
}
