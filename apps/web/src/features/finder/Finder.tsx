import {
  type CatalogItem,
  type Category,
  finderOf,
  type Locale,
  similar,
} from "@choose/catalog";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { css, cx } from "styled-system/css";
import { messages as m } from "~/i18n/messages";
import { CatalogueLink } from "../catalogue/CatalogueLink";
import { gsap, prefersReducedMotion } from "../motion/gsap";
import { scene } from "../scene/controller";
import {
  saveJourney,
  useArrival,
  useEnterDelay,
  usePageExit,
} from "../scene/navigation";
import { BrandFilter } from "./BrandFilter";
import { Console } from "./Console";
import { DockPanel } from "./DockPanel";
import { FrostedEdge } from "./FrostedEdge";
import { JourneyBar } from "./JourneyBar";
import { JourneyRail } from "./JourneyRail";
import { JourneySheet } from "./JourneySheet";
import { useFinderLayout } from "./layout";
import { LiveCounter } from "./LiveCounter";
import { PODIUM_SIZE, Podium } from "./Podium";
import { ProductDrawer } from "./ProductDrawer";
import { ResultsView } from "./ResultsView";
import { TopPick } from "./TopPick";
import { type FinderSearch, useFinder } from "./useFinder";

// The finder over its category's canvas: the live counter (with the brand filter) top-left, the
// podium on the right, the question console docked at the bottom over the journey bar, which holds
// the answers given and lets the visitor take the questions in any order (in the layout under test,
// layout.ts, the journey is a column at the left of the console instead); at the end the console's
// panel grows into the results, up to the site header (the counter and the brands move into them),
// and shrinks back when the visitor edits an answer. Switching categories, what the next finder
// shows in the same place stays on screen and only what it says changes: the console's panel, the
// journey, the counter and the canvas hint, the podium when it ranks as many products. The canvas
// itself is the layout's scene: the finder only tells it which products the answers keep,
// which ones the hovered option would keep, and the podium. Only the widgets take the pointer, so
// dragging anywhere else browses the canvas. Any product, on the canvas, the podium or the
// results, opens its sheet over the page: the page's own path with the product in it
// (/fr/claviers/<slug>), which the server renders with the sheet open.

type Props = {
  category: Category;
  items: CatalogItem[];
  search: FinderSearch;
  /** The product whose sheet the page's path opens. */
  product: string | null;
  locale: Locale;
};

/** The finder's route, with or without a product's sheet open. */
const PAGE = "/$lang/$category/{-$product}";

// One-time hints, remembered in the browser only: a blocked storage just shows them again.
const SHEET_SEEN = "choose-a-device:sheet-seen";
const CANVAS_HINT_SEEN = "choose-a-device:canvas-hint-seen";

const seen = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const markSeen = (key: string) => {
  try {
    localStorage.setItem(key, "1");
  } catch {}
};

/**
 * What the last finder left on screen for the next category's as it went, and when (ms): the
 * counter with the canvas hint, the podium, and the dock's height and the page's cramped state
 * they were laid out for. The next finder takes them over instead of bringing its own in.
 */
let kept: {
  category: Category;
  hud: boolean;
  podium: boolean;
  dockH: string;
  cramped: boolean;
  at: number;
} | null = null;
/** Past this (ms), what the last finder left is stale: a page that late enters as usual. */
const KEPT_MS = 3000;

const enterLeft = css({
  animation: "slideInLeft 0.9s token(easings.signal) backwards",
  _motionReduce: { animation: "none" },
});
const enterRight = css({
  animation: "slideInRight 1s token(easings.signal) backwards",
  _motionReduce: { animation: "none" },
});
const enterDock = css({
  animation: "dockRise 1.15s token(easings.signal) backwards",
  transformOrigin: "50% 100%",
  _motionReduce: { animation: "none" },
});
const enterFade = css({
  animation: "fadeUp 0.8s token(easings.signal) backwards",
  _motionReduce: { animation: "none" },
});
/**
 * The counter gives way to the results: it lifts away while the results rise. As wide as what it
 * shows, which the canvas's popup keeps clear of. Past a phone's width the top gradient stops
 * short of it: a soft halo of paper of its own keeps it legible over the products drifting behind,
 * and goes wherever it goes.
 */
const fadesWithResults = css({
  position: "relative",
  isolation: "isolate",
  display: "grid",
  gap: "3",
  w: "fit-content",
  transition: "opacity 300ms, transform 450ms token(easings.signal)",
  "&[data-done]": { opacity: 0, transform: "translateY(-12px)" },
  _motionReduce: { transition: "none" },
  md: {
    _before: {
      content: '""',
      position: "absolute",
      inset: "-0.5rem -2rem -0.75rem -1.5rem",
      zIndex: "-1",
      borderRadius: "2rem",
      bg: "rgba(243,241,236,0.84)",
      filter: "blur(18px)",
      pointerEvents: "none",
    },
  },
});

export function Finder({ category, items, search, product, locale }: Props) {
  const finder = useFinder(category, items, search, locale);
  const stage = useRef<HTMLElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const podium = useRef<HTMLElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const layout = useFinderLayout();
  const done = finder.step == null;
  /** The podium shows once there is something to rank on, and gives way to the results. */
  const ranking = !done && finder.informed;
  const target = { mode: "canvas", category } as const;
  // From the home page the chrome waits for the panel to open. Switching categories, the console
  // stays where it is and only what it says changes.
  const arrival = useArrival(target);
  const swapped = arrival === "swap";
  const delay = useEnterDelay(target, swapped ? 0.3 : 0.92, 0.1);
  const [carried] = useState(() =>
    swapped &&
    kept?.category === category &&
    performance.now() - kept.at < KEPT_MS
      ? kept
      : null,
  );
  // Back from the results, the console grows back in at once rather than with the page entrance.
  const wasDone = useRef(done);
  const backFromResults = !done && wasDone.current;
  useEffect(() => {
    wasDone.current = done;
  }, [done]);

  // The sheet on screen is the path's product, and where it stands among the kept ones. Once the
  // path drops it (closed, or Back), it stays the time it takes to fold away; a sheet opened
  // again meanwhile is a new one (`opening`). Stepping to another product keeps the sheet open.
  const [view, setView] = useState({ product, shown: product, opening: 0 });
  if (view.product !== product) {
    const opens = product != null && view.product == null;
    setView({
      product,
      shown: product ?? view.shown,
      opening: opens ? view.opening + 1 : view.opening,
    });
  }
  const shown = product ?? view.shown;
  const sheet = shown ? finder.sheetOf(shown) : null;
  const leaving = product == null && sheet != null;
  const gone = useCallback(
    () => setView((v) => (v.product == null ? { ...v, shown: null } : v)),
    [],
  );
  // The products its sheet suggests beside it: like it whatever the answers, so its links (and
  // the page's structured data, which names them) stay put.
  const sheetItem = sheet?.item;
  const similarModels = useMemo(
    () => (sheetItem ? similar(finderOf(category), items, sheetItem) : []),
    [category, items, sheetItem],
  );

  // Opening a sheet from the finder takes an entry of the history (marked, so that closing it goes
  // back to the finder rather than adding another); stepping through the ranking swaps the product
  // in that entry. Reached directly (a search result, a shared link), closing it shows the finder
  // in place of the sheet.
  const navigate = useNavigate();
  const router = useRouter();
  const openSheet = useCallback(
    (slug: string) =>
      navigate({
        from: PAGE,
        to: PAGE,
        params: (prev) => ({ ...prev, product: slug }),
        search: (prev) => prev,
        state: { sheet: true },
        resetScroll: false,
      }),
    [navigate],
  );
  const stepSheet = useCallback(
    (delta: -1 | 1) => {
      const next =
        sheet?.rank != null ? finder.ranked[sheet.rank + delta] : undefined;
      if (next)
        navigate({
          from: PAGE,
          to: PAGE,
          params: (prev) => ({ ...prev, product: next.item.slug }),
          search: (prev) => prev,
          state: (prev) => ({ sheet: prev.sheet }),
          replace: true,
          resetScroll: false,
        });
    },
    [sheet?.rank, finder.ranked, navigate],
  );
  const closeSheet = useCallback(() => {
    if (router.state.location.state.sheet) return router.history.back();
    navigate({
      from: PAGE,
      to: PAGE,
      params: (prev) => ({ ...prev, product: undefined }),
      search: (prev) => prev,
      replace: true,
      resetScroll: false,
    });
  }, [navigate, router]);
  // Until the visitor has opened a sheet once, the podium's best match shows how.
  const [hint, setHint] = useState(false);
  useEffect(() => setHint(!seen(SHEET_SEEN)), []);
  useEffect(() => {
    if (!product) return;
    setHint(false);
    markSeen(SHEET_SEEN);
  }, [product]);
  // On a phone the journey opens in a sheet, from the console's step or the results' "Edit".
  const [journeyOpen, setJourneyOpen] = useState(false);
  const openJourney = useCallback(() => setJourneyOpen(true), []);
  const closeJourney = useCallback(() => setJourneyOpen(false), []);
  // A finger that has dragged the canvas or picked a product knows it can: the hint goes.
  const [canvasKnown, setCanvasKnown] = useState(false);
  useEffect(() => {
    setCanvasKnown(seen(CANVAS_HINT_SEEN));
    return scene.onCanvasPress(() => {
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      setCanvasKnown(true);
      markSeen(CANVAS_HINT_SEEN);
    });
  }, []);

  useEffect(() => {
    scene.showCanvas(category);
  }, [category]);

  // A product clicked on the canvas opens its sheet.
  useEffect(
    () =>
      scene.onOpenProduct(
        (picked, slug) => picked === category && openSheet(slug),
      ),
    [category, openSheet],
  );

  // Each category remembers where its questionnaire was left.
  useEffect(() => {
    saveJourney(category, search);
  }, [category, search]);

  // The canvas shows what the answers keep; a new answer ripples out from the console. Ranks only
  // show once there is something to rank on.
  useEffect(() => {
    const box = dock.current?.getBoundingClientRect();
    scene.setTargets(
      category,
      {
        // Once an answer filters, the canvas keeps only the products ranked: the others leave it.
        kept: finder.misses ? new Set(finder.order) : null,
        hot: finder.hotIds,
        order: finder.informed ? finder.order : [],
        scores: finder.informed ? finder.scores : [],
      },
      box
        ? { x: box.left + box.width / 2, y: box.top + box.height / 3 }
        : undefined,
    );
  }, [
    category,
    finder.misses,
    finder.hotIds,
    finder.informed,
    finder.order,
    finder.scores,
  ]);
  useEffect(() => {
    scene.setDetails(category, finder.details);
  }, [category, finder.details]);
  // The results cover the canvas: its products take no pointer meanwhile.
  useEffect(() => {
    scene.setPickable(!done);
  }, [done]);
  useEffect(
    () => () => {
      // The canvas keeps what the answers keep until it is out of sight: going home shows every
      // product again (the scene does it), going to another category hides this one meanwhile.
      scene.setDetails(category, null);
      scene.setStage(category, null);
      scene.setPickable(true);
    },
    [category],
  );

  // The free space between the counter, the podium and the console is where a short list of
  // products gathers. Layout boxes, not on-screen ones: the entrances move them with transforms.
  // While the dock's panel eases to the height of a new question (or of the results), the page
  // lays out for the height it is heading to, so the short list, the podium and the hint move with
  // it rather than after it.
  useEffect(() => {
    const main = stage.current;
    if (!main) return;
    const panelOf = () =>
      dock.current?.querySelector<HTMLElement>("[data-dock-panel]");
    const contentOf = () => panelOf()?.firstElementChild ?? null;
    const measure = () => {
      const d = dock.current;
      const h = hud.current;
      if (!d || !h) return;
      const panel = panelOf();
      const content = contentOf();
      const dockH =
        d.offsetHeight +
        (panel && content instanceof HTMLElement
          ? content.offsetHeight - panel.clientHeight
          : 0);
      main.style.setProperty("--dock-h", `${dockH}px`);
      if (done) return scene.setStage(category, null);
      const p = podium.current;
      const r = rail.current;
      // The dock hangs from the bottom of the page: its top is where its new height puts it.
      const bottom = d.offsetTop + d.offsetHeight - dockH - 64;
      // The journey's column, beside the console (layout under test), may rise into the free space.
      const left =
        r?.offsetWidth && r.offsetTop < bottom
          ? r.offsetLeft + r.offsetWidth + 28
          : 20;
      const right = p?.offsetWidth ? p.offsetLeft - 28 : main.clientWidth - 20;
      const top = h.offsetTop + h.offsetHeight + 28;
      // No free space left above the dock (a phone): the canvas hint would sit on the counter.
      main.toggleAttribute("data-cramped", bottom < top);
      // Centred under the console when it fits, like everything else on the page's axis (the
      // console moves off-centre when the journey's column needs the room).
      const axis = r?.offsetWidth
        ? d.offsetLeft + d.offsetWidth / 2
        : main.clientWidth / 2;
      scene.setStage(category, {
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
        axis,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [
      dock.current,
      hud.current,
      podium.current,
      rail.current,
      contentOf(),
    ])
      if (el) observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [category, done]);

  /** The visitor's layout answer (azerty, ansi, iso), which the Amazon links follow. */
  const layouts = finder.answers.layout?.split(",");
  // The brands, beside the counter; once the results show, beside their count (one at a time).
  const brandFilter = finder.brands && finder.brands.options.length > 1 && (
    <BrandFilter
      options={finder.brands.options}
      selected={finder.brands.selected}
      open={finder.brandsOpen}
      locale={locale}
      onOpenChange={finder.setBrandsOpen}
      onChange={finder.setBrands}
      onHover={finder.setHoveredBrand}
    />
  );

  usePageExit(
    (kind, ahead) =>
      new Promise<void>((resolve) => {
        const el = stage.current;
        // What the next category's finder shows in the same place stays: the counter and the
        // canvas hint while its console shows, the podium when it shows as many cards.
        const cards = (n: number) => Math.min(PODIUM_SIZE, n);
        const hud = kind === "switch" && !done && !!ahead && !ahead.results;
        const keepPodium =
          kind === "switch" &&
          ranking &&
          ahead?.ranked != null &&
          cards(ahead.ranked) === cards(finder.podium.length);
        kept =
          el && ahead && kind === "switch"
            ? {
                category: ahead.category,
                hud,
                podium: keepPodium,
                dockH: el.style.getPropertyValue("--dock-h"),
                cramped: el.hasAttribute("data-cramped"),
                at: performance.now(),
              }
            : null;
        if (!el || prefersReducedMotion()) return resolve();
        gsap.set(el.querySelectorAll("[data-enter]"), { animation: "none" });
        const tl = gsap.timeline({
          onComplete: resolve,
          defaults: { ease: "power3.in" },
        });
        if (kind === "switch") {
          // The panel stays, and takes the next category's height (DockPanel): only what it
          // shows goes, the question or the results, and the new category's comes in.
          tl.to(
            el.querySelectorAll(
              done
                ? "[data-dock-panel] > *, [data-console-part]"
                : "[data-console-part], [data-podium-row]",
            ),
            { opacity: 0, y: -10, duration: 0.26, stagger: 0.015 },
            0,
          );
          // So do the counter's words and the podium cards' contents, last, as the page goes:
          // the next category's come in right after, in frames that never stand empty long.
          const parts = el.querySelectorAll("[data-swap-part]");
          const out = 0.2 + 0.012 * Math.max(0, parts.length - 1);
          tl.to(
            parts,
            { opacity: 0, y: -6, duration: 0.2, stagger: 0.012 },
            Math.max(0, tl.duration() - out),
          );
          const going = [
            !hud && "[data-enter=hud], [data-enter=hint]",
            !keepPodium && "[data-enter=podium]",
          ].filter(Boolean);
          if (going.length)
            tl.to(
              el.querySelectorAll(going.join(", ")),
              { opacity: 0, duration: 0.22 },
              0,
            );
          return;
        }
        tl.to(
          el.querySelectorAll("[data-enter=dock]"),
          {
            y: 80,
            rotateX: 26,
            opacity: 0,
            transformPerspective: 1400,
            transformOrigin: "50% 100%",
            duration: 0.4,
          },
          0,
        )
          .to(
            el.querySelectorAll(
              "[data-enter=hud], [data-enter=podium], [data-enter=hint], [data-enter=rail]",
            ),
            { opacity: 0, y: -10, duration: 0.3 },
            0,
          )
          // The frost behind the journey fades layer by layer: a fading box would blind them.
          .to(
            el.querySelectorAll("[data-enter=veil]"),
            { opacity: 0, duration: 0.3 },
            0,
          );
      }),
  );

  return (
    <main
      ref={stage}
      data-finder-layout={layout}
      // Taking over from the last finder, the page starts laid out as that one was.
      data-cramped={carried?.cramped || undefined}
      style={
        carried?.dockH
          ? ({ "--dock-h": carried.dockH } as CSSProperties)
          : undefined
      }
      className={css({
        position: "relative",
        h: "100dvh",
        // A phone, upright or on its side, is narrower or shorter than this: everything then fits
        // the screen it has.
        "@media (min-width: 48rem) and (min-height: 30.01rem)": {
          minH: "560px",
        },
        overflow: "hidden",
        pointerEvents: "none",
        "--dock-h": "320px",
      })}
    >
      {/* The page's heading, unless a product's sheet is open: its name is then the heading. */}
      {sheet ? (
        <p className={css({ srOnly: true })}>
          {m.categoryQuestion[category][locale]}
        </p>
      ) : (
        <h1 className={css({ srOnly: true })}>
          {m.categoryQuestion[category][locale]}
        </h1>
      )}

      {/* The canvas fades into paper under the header and the counter, which stay legible. Past
          a phone's width the fade is eased, so that no line shows where it ends, and a shorter
          screen gives it less of its height, the counter keeping a halo of its own
          (`fadesWithResults`); `topVeil` in scene/geometry.ts says the same height, for the
          products it leaves out of reach. */}
      <div
        aria-hidden
        className={cx(
          !swapped && enterFade,
          css({
            position: "absolute",
            insetInline: "0",
            top: "0",
            h: { base: "48", md: "clamp(8.5rem, 17dvh, 15rem)" },
            background: {
              base: "linear-gradient(to bottom, rgba(243,241,236,0.94) 35%, rgba(243,241,236,0.6) 70%, rgba(243,241,236,0))",
              md: "linear-gradient(to bottom, rgba(243,241,236,0.94) 25%, rgba(243,241,236,0.89) 35%, rgba(243,241,236,0.78) 45%, rgba(243,241,236,0.61) 55%, rgba(243,241,236,0.42) 65%, rgba(243,241,236,0.24) 75%, rgba(243,241,236,0.1) 85%, rgba(243,241,236,0.02) 92%, rgba(243,241,236,0))",
            },
          }),
        )}
        style={{ animationDelay: `${delay}s` }}
      />

      {/* The results rise over its place, its counter and answers with them: it lifts away
          meanwhile and comes back after. The inner box fades, the outer one plays the entrance,
          so results opened from a link never show it on the way in. Taken over from the last
          category's, it plays none: its digits roll on. */}
      <div
        ref={hud}
        data-enter="hud"
        inert={done || undefined}
        className={cx(
          !carried?.hud && (swapped ? enterFade : enterLeft),
          css({
            position: "absolute",
            top: { base: "16", md: "20" },
            left: { base: "4", md: "8" },
            right: { base: "4", lg: "96" },
            // A screen this short has room for the question alone (the results button counts).
            _short: { display: "none" },
          }),
        )}
        style={{ animationDelay: `${delay + 0.1}s` }}
      >
        <div
          data-done={done || undefined}
          data-keep-clear
          className={fadesWithResults}
        >
          <LiveCounter
            value={finder.matching}
            total={items.length}
            label={m.matching[category][locale]}
            labels={Object.values(m.matching).map((words) => words[locale])}
            preview={finder.preview}
            previewLabel={m.ifPicked[locale]}
            ofLabel={m.of[locale]}
            carryOver={!!carried?.hud}
          >
            {!done && (
              <span
                className={css({
                  display: "inline-flex",
                  flexWrap: "wrap",
                  gap: "2",
                })}
              >
                {brandFilter}
                <CatalogueLink
                  category={category}
                  label={m.catalogue[locale]}
                  locale={locale}
                />
              </span>
            )}
          </LiveCounter>
        </div>
      </div>

      {/* Before the first answer there is nothing to rank, and the results grow over its place:
          the podium waits out of sight meanwhile, and comes in once there is a ranking. Its box
          stays, as the edge of the canvas's free space. */}
      <aside
        ref={podium}
        data-enter="podium"
        aria-hidden={!ranking || undefined}
        inert={!ranking || undefined}
        className={cx(
          !carried?.podium && (swapped ? enterFade : enterRight),
          css({
            position: "absolute",
            top: "20",
            right: "8",
            // Down to just above the console: the podium shows as many entries as fit.
            bottom: "calc(var(--dock-h) + 2.5rem)",
            w: "72",
            display: { base: "none", lg: "block" },
            containerType: "size",
            "& button, & a": { pointerEvents: "auto" },
          }),
        )}
        style={{ animationDelay: `${delay + 0.2}s` }}
      >
        <div
          data-off={!ranking || undefined}
          className={css({
            h: "100%",
            transition: "opacity 300ms, transform 450ms token(easings.signal)",
            "&[data-off]": { opacity: 0, transform: "translateX(16px)" },
            _motionReduce: { transition: "none" },
          })}
        >
          <Podium
            top={finder.podium}
            total={finder.matching}
            informed={finder.informed}
            locale={locale}
            hint={hint}
            carryOver={!!carried?.podium}
            onShowAll={finder.showResults}
          />
        </div>
      </aside>

      {!done && (
        <p
          data-enter="hint"
          data-known={canvasKnown || undefined}
          // Not a line for search results to quote.
          data-nosnippet
          aria-hidden
          className={cx(
            !carried?.hud && enterFade,
            css({
              position: "absolute",
              // Centred by its margins, not by a transform: the entrance animates the transform,
              // which would hold the hint off-centre until it ends.
              insetInline: "0",
              mx: "auto",
              w: "fit-content",
              // On the narrowest phones it goes onto a second line rather than past the edges.
              maxW: "calc(100% - 2rem)",
              textAlign: "center",
              bottom: "calc(var(--dock-h) + 40px)",
              fontFamily: "mono",
              fontSize: "2xs",
              color: "ink.muted",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              px: "3",
              py: "1.5",
              borderRadius: "pill",
              bg: "paper/80",
              backdropFilter: "blur(8px)",
              transition: "bottom 400ms token(easings.signal), opacity 300ms",
              "[data-cramped] &": { opacity: 0 },
              "&[data-known]": { opacity: 0 },
              _short: { display: "none" },
            }),
          )}
          style={{ animationDelay: `${delay + 0.5}s` }}
        >
          <span
            className={css({ "@media (hover: none)": { display: "none" } })}
          >
            {m.canvasHint[locale]}
          </span>
          <span
            className={css({ "@media (hover: hover)": { display: "none" } })}
          >
            {m.canvasHintTouch[locale]}
          </span>
        </p>
      )}

      {/* The layout under test (layout.ts, styles.css): the journey as a column at the left of the
          console, standing on the paper like the counter above it. Switching categories it stays
          on screen: only what it lists changes. */}
      <div
        ref={rail}
        data-journey-rail
        data-keep-clear
        className={css({
          position: "absolute",
          left: "8",
          bottom: "6",
          w: "52",
          isolation: "isolate",
        })}
      >
        {/* The canvas frosts over into paper along the left edge, down to the bottom, so the
            steps stay legible over the products drifting behind (as the counter does under the
            top gradient). Beside the column's entrance rather than in it: a fading parent would
            blind its blur. */}
        <FrostedEdge
          delay={swapped ? null : delay + 0.35}
          className={css({ inset: "-6rem -7rem -1.5rem -2rem", zIndex: "-1" })}
        />
        <div
          data-enter="rail"
          className={cx(!swapped && enterLeft, css({ pointerEvents: "auto" }))}
          style={{ animationDelay: `${delay + 0.35}s` }}
        >
          <JourneyRail
            stops={finder.journey}
            done={done}
            locale={locale}
            onPick={finder.pickStep}
            results={finder.matching}
            onResults={finder.showResults}
            carryOver={swapped}
          />
        </div>
      </div>
      <div
        ref={dock}
        data-dock
        data-keep-clear
        className={css({
          position: "absolute",
          // Clear of the iPhone's home indicator.
          bottom: {
            base: "calc(0.75rem + env(safe-area-inset-bottom))",
            md: "calc(1.5rem + env(safe-area-inset-bottom))",
          },
          left: "50%",
          transform: "translateX(-50%)",
          w: {
            base: "calc(100% - 24px - env(safe-area-inset-left) - env(safe-area-inset-right))",
            md: "min(960px, calc(100% - 48px))",
          },
        })}
      >
        <div
          data-enter="dock"
          className={cx(
            !swapped && enterDock,
            css({
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: { base: "2", md: "3" },
              pointerEvents: "auto",
            }),
          )}
          style={{ animationDelay: `${delay}s` }}
        >
          {/* A phone has room for the best match alone, above the console: a tap opens its
              sheet, whose arrows lead to the next ones. A short phone keeps the room for the
              answers. */}
          {ranking && finder.ranked[0] && (
            <div
              data-podium-row
              className={css({
                display: { base: "block", md: "none" },
                animation: "fadeUp 0.5s token(easings.signal) backwards",
                _motionReduce: { animation: "none" },
                "@media (max-height: 43.75rem)": { display: "none" },
              })}
            >
              <TopPick entry={finder.ranked[0]} locale={locale} />
            </div>
          )}
          {ranking && (
            <div
              data-podium-row
              className={css({
                // A tablet's row, below the podium's column; not on a screen too short for it.
                display: "none",
                "@media (min-width: 48rem) and (max-width: 63.99rem) and (min-height: 30.01rem)":
                  { display: "block" },
                animation: "fadeUp 0.5s token(easings.signal) backwards",
                _motionReduce: { animation: "none" },
              })}
            >
              <Podium
                top={finder.podium}
                total={finder.matching}
                locale={locale}
                layout="row"
                hint={hint}
                onShowAll={finder.showResults}
              />
            </div>
          )}
          <DockPanel carryOver={swapped}>
            {done ? (
              <ResultsView
                ranked={finder.ranked}
                near={finder.near}
                scored={finder.informed}
                use={finder.useLabel}
                locale={locale}
                total={items.length}
                layouts={layouts}
                brands={brandFilter}
                onEdit={finder.editAnswers}
                onJourney={openJourney}
                onReset={finder.reset}
              />
            ) : (
              <Console
                finder={finder}
                category={category}
                locale={locale}
                onJourney={openJourney}
                enterDelay={backFromResults ? 0.12 : delay + 0.3}
                morph={backFromResults || swapped}
              />
            )}
          </DockPanel>
          {/* A phone's journey is a sheet, opened from the console: the bar has no room there. */}
          {/* data-journey-bar: the layout under test hides it with its bar (styles.css). */}
          <div
            data-journey-bar
            className={css({
              display: "none",
              // Nor on a screen too short for it (a phone on its side): its step opens the sheet.
              "@media (min-width: 48rem) and (min-height: 30.01rem)": {
                display: "block",
              },
            })}
          >
            <JourneyBar
              stops={finder.journey}
              done={done}
              locale={locale}
              onPick={finder.pickStep}
              results={finder.matching}
              onResults={finder.showResults}
              enterDelay={delay + 0.45}
            />
          </div>
        </div>
      </div>

      {journeyOpen && (
        <JourneySheet
          stops={finder.journey}
          done={done}
          position={finder.position}
          total={finder.asked.length}
          locale={locale}
          results={finder.matching}
          onPick={finder.pickStep}
          onResults={finder.showResults}
          onClose={closeJourney}
        />
      )}

      {/* In the page itself rather than in a portal, so that the server renders it. */}
      {sheet && (
        <ProductDrawer
          key={view.opening}
          sheet={sheet}
          similar={similarModels}
          catalogue={items}
          use={finder.useLabel}
          layouts={layouts}
          locale={locale}
          position={
            sheet.rank != null
              ? { index: sheet.rank, total: finder.ranked.length }
              : null
          }
          leaving={leaving}
          onStep={stepSheet}
          onClose={closeSheet}
          onGone={gone}
        />
      )}
    </main>
  );
}
