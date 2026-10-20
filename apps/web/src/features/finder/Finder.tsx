import type { CatalogItem, Category, Locale } from "@choose/catalog";
import { useCallback, useEffect, useRef, useState } from "react";
import { css, cx } from "styled-system/css";
import { messages as m } from "~/i18n/messages";
import { gsap, prefersReducedMotion } from "../motion/gsap";
import { scene } from "../scene/controller";
import {
  saveJourney,
  useArrival,
  useEnterDelay,
  usePageExit,
} from "../scene/navigation";
import { AnswerRail } from "./AnswerRail";
import { Console } from "./Console";
import { LiveCounter } from "./LiveCounter";
import { PODIUM_SIZE, Podium } from "./Podium";
import { ProductDrawer } from "./ProductDrawer";
import { ResultsView } from "./ResultsView";
import { type FinderSearch, useFinder } from "./useFinder";

// The finder over its category's canvas: the live counter and the answer rail top-left, the
// podium on the right, the question console docked at the bottom; at the end the console gives
// way to the results. The canvas itself is the layout's scene: the finder only tells it which
// products the answers keep, which ones the hovered option would keep, and the podium. Only the
// widgets take the pointer, so dragging anywhere else browses the canvas. Any product, on the
// canvas, the podium or the results, opens its sheet over the page.

type Props = {
  category: Category;
  items: CatalogItem[];
  search: FinderSearch;
  locale: Locale;
};

const SHEET_SEEN = "choose-a-device:sheet-seen";
const sheetSeen = () => {
  try {
    return localStorage.getItem(SHEET_SEEN) === "1";
  } catch {
    return false;
  }
};
const markSheetSeen = () => {
  try {
    localStorage.setItem(SHEET_SEEN, "1");
  } catch {}
};

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

export function Finder({ category, items, search, locale }: Props) {
  const finder = useFinder(category, items, search, locale);
  const stage = useRef<HTMLElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const podium = useRef<HTMLElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const done = finder.step == null;
  const target = { mode: "canvas", category } as const;
  // From the home page the chrome waits for the panel to open. Switching categories, the console
  // stays where it is and only what it says changes.
  const arrival = useArrival(target);
  const swapped = arrival === "swap";
  const delay = useEnterDelay(target, swapped ? 0.3 : 0.92, 0.1);

  // The product whose sheet is open, and where it stands among the kept ones.
  const [open, setOpen] = useState<string | null>(null);
  const sheet = open ? finder.sheetOf(open) : null;
  const stepSheet = useCallback(
    (delta: -1 | 1) => {
      const next =
        sheet?.rank != null ? finder.ranked[sheet.rank + delta] : undefined;
      if (next) setOpen(next.item.slug);
    },
    [sheet?.rank, finder.ranked],
  );
  const closeSheet = useCallback(() => setOpen(null), []);
  // Until the visitor has opened a sheet once, the podium's best match shows how.
  const [hint, setHint] = useState(false);
  useEffect(() => setHint(!sheetSeen()), []);
  const openSheet = useCallback((slug: string) => {
    setOpen(slug);
    setHint(false);
    markSheetSeen();
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

  // The canvas mirrors the answers; a new answer ripples out from the console.
  useEffect(() => {
    const box = dock.current?.getBoundingClientRect();
    scene.setTargets(
      category,
      {
        misses: finder.misses,
        hot: finder.hotIds,
        order: finder.order,
        scores: finder.scores,
      },
      box
        ? { x: box.left + box.width / 2, y: box.top + box.height / 3 }
        : undefined,
    );
  }, [category, finder.misses, finder.hotIds, finder.order, finder.scores]);
  useEffect(() => {
    scene.setDetails(category, finder.details);
  }, [category, finder.details]);
  useEffect(
    () => () => {
      // Back on the home page the panel shows every product again.
      scene.setTargets(category, null);
      scene.setDetails(category, null);
      scene.setStage(category, null);
    },
    [category],
  );

  // The free space between the counter, the podium and the console is where a short list of
  // products gathers. Layout boxes, not on-screen ones: the entrances move them with transforms.
  useEffect(() => {
    const main = stage.current;
    if (!main) return;
    const measure = () => {
      const d = dock.current;
      const h = hud.current;
      if (!d || !h) return;
      main.style.setProperty("--dock-h", `${d.offsetHeight}px`);
      if (done) return scene.setStage(category, null);
      const p = podium.current;
      const left = 20;
      const right = p?.offsetWidth ? p.offsetLeft - 28 : main.clientWidth - 20;
      const top = h.offsetTop + h.offsetHeight + 28;
      const bottom = d.offsetTop - 64;
      // Centred under the console when it fits, like everything else on the page's axis.
      const axis = main.clientWidth / 2;
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
    for (const el of [dock.current, hud.current, podium.current])
      if (el) observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [category, done]);

  usePageExit(
    (kind) =>
      new Promise<void>((resolve) => {
        const el = stage.current;
        if (!el || prefersReducedMotion()) return resolve();
        gsap.set(el.querySelectorAll("[data-enter]"), { animation: "none" });
        const tl = gsap.timeline({
          onComplete: resolve,
          defaults: { ease: "power3.in" },
        });
        if (kind === "switch") {
          // The console stays: only its question goes, and the new category's comes in.
          tl.to(
            el.querySelectorAll(
              done ? "[data-enter=dock]" : "[data-console-part]",
            ),
            { opacity: 0, y: -10, duration: 0.26, stagger: 0.015 },
            0,
          ).to(
            el.querySelectorAll(
              "[data-enter=hud], [data-enter=podium], [data-enter=hint]",
            ),
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
        ).to(
          el.querySelectorAll(
            "[data-enter=hud], [data-enter=podium], [data-enter=hint]",
          ),
          { opacity: 0, y: -10, duration: 0.3 },
          0,
        );
      }),
  );

  return (
    <main
      ref={stage}
      className={css({
        position: "relative",
        h: "100dvh",
        minH: "560px",
        overflow: "hidden",
        pointerEvents: "none",
        "--dock-h": "320px",
      })}
    >
      <h1 className={css({ srOnly: true })}>{m.category[category][locale]}</h1>

      {/* The canvas fades into paper under the header and the counter, which stay legible. */}
      <div
        aria-hidden
        className={cx(
          enterFade,
          css({
            position: "absolute",
            insetInline: "0",
            top: "0",
            h: { base: "48", md: "60" },
            background:
              "linear-gradient(to bottom, rgba(243,241,236,0.94) 35%, rgba(243,241,236,0.6) 70%, rgba(243,241,236,0))",
          }),
        )}
        style={{ animationDelay: `${delay}s` }}
      />

      <div
        ref={hud}
        data-enter="hud"
        className={cx(
          swapped ? enterFade : enterLeft,
          css({
            position: "absolute",
            top: { base: "16", md: "20" },
            left: { base: "4", md: "8" },
            right: { base: "4", lg: "96" },
            display: "grid",
            gap: "3",
            "&[data-done]": { right: { base: "4", md: "8" } },
          }),
        )}
        style={{ animationDelay: `${delay + 0.1}s` }}
        data-done={done || undefined}
      >
        <LiveCounter
          value={finder.matching}
          total={items.length}
          label={m.matching[category][locale]}
          preview={finder.preview}
          previewLabel={m.ifPicked[locale]}
          ofLabel={m.of[locale]}
        />
        <AnswerRail
          items={finder.rail}
          current={finder.currentKey}
          onPick={finder.goTo}
        />
      </div>

      {!done && (
        <aside
          ref={podium}
          data-enter="podium"
          className={cx(
            swapped ? enterFade : enterRight,
            css({
              position: "absolute",
              top: "20",
              right: "8",
              // Down to just above the console: the podium shows as many entries as fit.
              bottom: "calc(var(--dock-h) + 2.5rem)",
              w: "72",
              display: { base: "none", lg: "block" },
              containerType: "size",
              "& button": { pointerEvents: "auto" },
            }),
          )}
          style={{ animationDelay: `${delay + 0.2}s` }}
        >
          <Podium
            top={finder.ranked.slice(0, PODIUM_SIZE)}
            total={finder.matching}
            locale={locale}
            hint={hint}
            onOpen={openSheet}
            onShowAll={finder.showResults}
          />
        </aside>
      )}

      {!done && (
        <p
          data-enter="hint"
          aria-hidden
          className={cx(
            enterFade,
            css({
              position: "absolute",
              left: "50%",
              bottom: "calc(var(--dock-h) + 40px)",
              transform: "translateX(-50%)",
              fontFamily: "mono",
              fontSize: "2xs",
              color: "ink.muted",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
              px: "3",
              py: "1.5",
              borderRadius: "pill",
              bg: "paper/80",
              backdropFilter: "blur(8px)",
              transition: "bottom 400ms token(easings.signal)",
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

      <div
        ref={dock}
        className={css({
          position: "absolute",
          bottom: { base: "3", md: "6" },
          left: "50%",
          transform: "translateX(-50%)",
          w: { base: "calc(100% - 24px)", md: "min(960px, calc(100% - 48px))" },
        })}
      >
        <div
          data-enter="dock"
          className={cx(
            !swapped && enterDock,
            css({
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: "3",
              pointerEvents: "auto",
            }),
          )}
          style={{ animationDelay: `${delay}s` }}
        >
          {!done && (
            <div className={css({ display: { base: "block", lg: "none" } })}>
              <Podium
                top={finder.ranked.slice(0, PODIUM_SIZE)}
                total={finder.matching}
                locale={locale}
                layout="row"
                hint={hint}
                onOpen={openSheet}
                onShowAll={finder.showResults}
              />
            </div>
          )}
          {done ? (
            <ResultsView
              ranked={finder.ranked}
              locale={locale}
              onEdit={finder.editAnswers}
              onReset={finder.reset}
              onOpen={openSheet}
            />
          ) : (
            <Console
              finder={finder}
              category={category}
              locale={locale}
              enterDelay={delay + 0.3}
            />
          )}
        </div>
      </div>

      {sheet && (
        <ProductDrawer
          sheet={sheet}
          locale={locale}
          position={
            sheet.rank != null
              ? { index: sheet.rank, total: finder.ranked.length }
              : null
          }
          onStep={stepSheet}
          onClose={closeSheet}
        />
      )}
    </main>
  );
}
