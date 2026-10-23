import {
  ANY,
  type Category,
  type ChoiceStep,
  histogram,
  type Locale,
  readChoice,
} from "@choose/catalog";
import {
  type CSSProperties,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { css, cx } from "styled-system/css";
import { button, optionTile } from "styled-system/recipes";
import { messages as m } from "~/i18n/messages";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "../motion/gsap";
import { motion } from "../motion/tokens";
import { BudgetControl } from "./BudgetControl";
import { useDockHeight } from "./DockPanel";
import { HelpBubble, plainHelp } from "./HelpBubble";
import { examplesScale, OptionExample } from "./OptionExample";
import { type Finder, toggled } from "./useFinder";

// The question console, in the dock's panel. One question at a time; tiles carry a live count,
// picked tiles a tick, and a tile that would leave nothing says which earlier answer blocks it.
//
// The console takes the height of its question: same header and footer for every question, tiles
// of one height in between (a long list scrolls past a ceiling), the budget's histogram at a fixed
// height. The tiles share the width in rows of (nearly) equal length; "No preference" is no tile
// but the footer's button, which turns into "Continue" once a tile is picked. The panel eases from
// one height to the next, growing or shrinking upwards, so the footer and its buttons never move
// under the visitor's pointer. Each tile says in a few words what its option means; the question's
// full explanation waits behind the help button, in a bubble above the console.

const useIsoLayoutEffect =
  typeof window === "undefined" ? () => {} : useLayoutEffect;

const content = css({
  flexShrink: "0",
  p: { base: "4", md: "5" },
  display: "flex",
  flexDirection: "column",
  gap: "3",
  // Past this, the tiles scroll inside the panel rather than covering the page.
  maxH: { base: "min(30rem, 52dvh)", md: "min(32rem, 58dvh)" },
  // A short phone: the answers come first, up to the counter (the canvas only shows above a
  // short question).
  "@media (max-width: 47.99rem) and (min-height: 30.01rem) and (max-height: 43.75rem)":
    { maxH: "calc(100dvh - 10rem)" },
  // A phone on its side: the console takes the screen under the header.
  _short: { maxH: "calc(100dvh - 5.5rem)" },
});

/**
 * The question's header. On a phone, two rows: its buttons around the journey's (the step, which
 * opens the whole journey), then the title, the width of the console, and what kind of answer it
 * takes. Wider, one row: the buttons, the step, the title, the help.
 */
const head = css({
  display: "grid",
  gridTemplateColumns: "auto auto minmax(0, 1fr) auto",
  gridTemplateAreas:
    '"back reset journey help" "title title title title" "kind kind kind kind"',
  alignItems: "center",
  columnGap: "1",
  rowGap: "1.5",
  flexShrink: "0",
  md: {
    display: "flex",
    gap: "2",
    // Room for a title on two lines, so the header never changes height.
    minH: "2.5rem",
  },
});

/**
 * The step on screen, on a phone: it opens the journey. The questions answered so far fill it from
 * its left edge.
 */
const journeyButton = css({
  gridArea: "journey",
  justifySelf: "center",
  position: "relative",
  isolation: "isolate",
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  h: "9",
  px: "3.5",
  overflow: "hidden",
  borderRadius: "pill",
  borderWidth: "1px",
  borderColor: "line",
  bg: "surface",
  fontSize: "xs",
  fontWeight: "550",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "border-color 160ms",
  _hover: { borderColor: "line.strong" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "signal",
    outlineOffset: "2px",
  },
  _before: {
    content: '""',
    position: "absolute",
    insetBlock: "0",
    left: "0",
    zIndex: "-1",
    w: "var(--progress)",
    bg: "ink/8",
    transition: "width 600ms token(easings.signal)",
  },
  md: { display: "none" },
});

const body = css({
  position: "relative",
  minH: "0",
  display: "flex",
  flexDirection: "column",
  gap: "3",
});

/**
 * The tiles' scroll box. A div rather than the fieldset itself, which does not clip what
 * overflows it. The padding is room for what overhangs a tile (the tick, the focus ring), which
 * the scroll box would otherwise cut; the negative margin keeps the tiles aligned with the header.
 * While the tiles rise into place they overflow it for a moment: it shows no scrollbar meanwhile.
 */
const tileScroll = css({
  m: "-2",
  p: "2",
  minW: "0",
  minH: "0",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
  "&[data-entering]": { overflowY: "hidden" },
  // More answers below: the list fades out at the bottom rather than stopping dead.
  "&[data-more-below]": {
    maskImage:
      "linear-gradient(to bottom, #000 calc(100% - 2.5rem), transparent)",
  },
});

/** One answer per row on a phone, with room for its hint; tiles in rows of equal length wider. */
const tileGrid = css({
  border: "0",
  m: "0",
  p: "0",
  minW: "0",
  display: "grid",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    md: "repeat(var(--cols, 5), minmax(0, 1fr))",
  },
  // A dead tile that needs one more line to say what blocks it grows its row rather than
  // overflowing it.
  gridAutoRows: { base: "minmax(3.25rem, auto)", md: "minmax(6.25rem, auto)" },
  gap: { base: "2", md: "2.5" },
});

/** The kind of answer a question takes, under its title on a phone. */
const kind = css({
  gridArea: "kind",
  fontFamily: "mono",
  fontSize: "2xs",
  color: "ink.faint",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  md: { display: "none" },
});

/** On a phone the footer's buttons share its width, and wrap rather than overflow. */
const grow = css({ flex: { base: "1 1 auto", md: "0 0 auto" } });

/**
 * Columns for n tiles on a wide screen: one row up to five, then rows of (nearly) equal length,
 * so no tile is ever left alone on a row of its own.
 */
const columnsFor = (n: number) =>
  n <= 5 ? Math.max(2, n) : Math.ceil(n / Math.ceil(n / 5));

const iconButton = cx(
  button({ tone: "ghost", size: "icon" }),
  css({ color: "ink.muted" }),
);

/** The help button: ⓘ, turned into × while the help is open. */
const helpToggle = css({
  display: "inline-grid",
  "& > span": {
    gridArea: "1 / 1",
    display: "grid",
    placeItems: "center",
    transition: "transform 320ms token(easings.signal), opacity 200ms",
  },
  "& > [data-close]": { opacity: 0, transform: "rotate(-90deg) scale(0.6)" },
  "&[aria-expanded=true]": { color: "ink", bg: "ink/6" },
  "&[aria-expanded=true] > [data-info]": {
    opacity: 0,
    transform: "rotate(90deg) scale(0.6)",
  },
  "&[aria-expanded=true] > [data-close]": { opacity: 1, transform: "none" },
  _motionReduce: { "& > span": { transition: "none" } },
});

/**
 * "No preference" while nothing is picked, then "Continue": one button whose two labels share a
 * cell (it is as wide as the longer one, so nothing moves) and slide past each other as it turns
 * from a dashed outline to ink.
 */
const skipOrGo = css({
  display: "inline-grid",
  placeItems: "center",
  overflow: "hidden",
  borderWidth: "1px",
  borderColor: "ink",
  "& > span": {
    gridArea: "1 / 1",
    transition: "transform 420ms token(easings.signal), opacity 240ms",
  },
  "&:not([data-skip]):hover": { borderColor: "ink.soft" },
  "&[data-skip]": {
    bg: "transparent",
    color: "ink",
    borderStyle: "dashed",
    borderColor: "line.strong",
    _hover: { bg: "transparent", borderStyle: "solid", borderColor: "ink" },
  },
  "&[data-skip] > [data-go]": { transform: "translateY(110%)", opacity: 0 },
  "&:not([data-skip]) > [data-skip-label]": {
    transform: "translateY(-110%)",
    opacity: 0,
  },
  _motionReduce: { "& > span": { transition: "none" } },
});

const Icon = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

export function Console({
  finder,
  category,
  locale,
  enterDelay = 0,
  morph = false,
  onJourney,
}: {
  finder: Finder;
  category: Category;
  locale: Locale;
  /** Opens the whole journey (a phone's sheet): its step, in the header, is the button. */
  onJourney?: () => void;
  /** Seconds before the first question plays in, while the console itself rises. */
  enterDelay?: number;
  /**
   * In place of the results, or of another category's question: its header and footer fade in
   * with the question.
   */
  morph?: boolean;
}) {
  const { step, counts, draft } = finder;
  const root = useRef<HTMLElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const uid = useId();
  const leaving = useRef(false);
  const first = useRef(true);
  /**
   * The tiles' columns, and whether they are cards, settled once per visit of a question: picks
   * never reflow the grid.
   */
  const columns = useRef({ visit: "", cols: 5, card: false });
  // The question plays in when it changes or gets a new answer, not when other answers do: a
  // brand picked or dropped only updates the counts on its tiles.
  const committed = step ? finder.answers[step.key] : undefined;

  useGSAP(
    () => {
      leaving.current = false;
      setHelpOpen(false);
      const fresh = first.current;
      const delay = fresh ? enterDelay : 0;
      first.current = false;
      const el = root.current;
      if (prefersReducedMotion() || !el) return;
      if (fresh && morph) {
        gsap.from("[data-console-part]", {
          opacity: 0,
          duration: motion.base,
          ease: motion.ease,
          delay,
        });
      }
      const split = SplitText.create("[data-title]", {
        type: "words,chars",
        mask: "words",
      });
      gsap.from(split.chars, {
        yPercent: 110,
        duration: motion.base,
        ease: motion.ease,
        stagger: 0.012,
        delay,
      });
      // The tiles are new nodes for every question (their box is keyed by it), and they are taken
      // to their final state explicitly all the same: what an exit leaves on an element can never
      // hold it invisible.
      const scroller = el.querySelector<HTMLElement>("[data-tile-scroll]");
      scroller?.setAttribute("data-entering", "");
      gsap.fromTo(
        el.querySelectorAll("[data-tile], [data-budget]"),
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: motion.base,
          ease: motion.ease,
          stagger: motion.stagger,
          delay: delay + 0.08,
          clearProps: "opacity,transform",
          onComplete: () => scroller?.removeAttribute("data-entering"),
        },
      );
      // The budget's bars rise from their baseline, one after the other.
      const bars = el.querySelectorAll("[data-bar]");
      if (bars.length)
        gsap.fromTo(
          bars,
          { scaleY: 0 },
          {
            scaleY: 1,
            transformOrigin: "50% 100%",
            duration: motion.base + 0.1,
            ease: motion.ease,
            stagger: 0.012,
            delay: delay + 0.14,
            clearProps: "transform",
          },
        );
      return () => split.revert();
    },
    { dependencies: [step?.key, committed], scope: root },
  );
  // Once the title is split into words (above), the panel eases to the question's height.
  useDockHeight();

  // A list longer than its box fades out at the bottom while there is more of it below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new question brings a new list
  useIsoLayoutEffect(() => {
    const box = root.current?.querySelector<HTMLElement>("[data-tile-scroll]");
    if (!box) return;
    const check = () =>
      box.toggleAttribute(
        "data-more-below",
        box.scrollTop + box.clientHeight < box.scrollHeight - 2,
      );
    check();
    box.addEventListener("scroll", check, { passive: true });
    const resized = new ResizeObserver(check);
    resized.observe(box);
    return () => {
      box.removeEventListener("scroll", check);
      resized.disconnect();
    };
  }, [step?.key]);

  // A brand picked or dropped can still add must-haves to the question on screen (or take some
  // away): only the tiles that appear play in.
  const tilesShown = useRef<{ key?: string; ids: Set<string> }>({
    ids: new Set(),
  });
  useIsoLayoutEffect(() => {
    const tiles = [
      ...(root.current?.querySelectorAll<HTMLElement>("[data-option]") ?? []),
    ];
    const before = tilesShown.current;
    tilesShown.current = {
      key: step?.key,
      ids: new Set(tiles.map((t) => t.dataset.option ?? "")),
    };
    if (before.key !== step?.key || prefersReducedMotion()) return;
    const fresh = tiles.filter((t) => !before.ids.has(t.dataset.option ?? ""));
    if (!fresh.length) return;
    const scroller =
      root.current?.querySelector<HTMLElement>("[data-tile-scroll]");
    scroller?.setAttribute("data-entering", "");
    gsap.fromTo(
      fresh,
      { opacity: 0, y: 10 },
      {
        opacity: 1,
        y: 0,
        duration: motion.base,
        ease: motion.ease,
        stagger: motion.stagger,
        clearProps: "opacity,transform",
        onComplete: () => scroller?.removeAttribute("data-entering"),
      },
    );
  });

  /**
   * Plays the tiles out (the whole console when the results take its place), then runs the
   * navigation. A timer backs the animation up: in a hidden tab the browser pauses animation
   * frames, and an answer must never wait on one.
   */
  const leave = (then: () => void, whole = false) => {
    if (leaving.current) return;
    leaving.current = true;
    if (prefersReducedMotion() || document.hidden) return then();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      then();
    };
    const parts = whole
      ? "[data-console-part]"
      : "[data-tile], [data-budget], [data-title]";
    gsap.to(root.current?.querySelectorAll(parts) ?? [], {
      opacity: 0,
      y: -10,
      duration: motion.fast,
      ease: motion.easeIn,
      stagger: 0.015,
      onComplete: finish,
    });
    window.setTimeout(finish, (motion.fast + 0.2) * 1000);
  };

  if (!step) return null;
  const total = finder.matching;
  const picked =
    step.kind === "range"
      ? undefined
      : readChoice(step as ChoiceStep<unknown>, draft);
  const pickedIds = new Set(picked && picked !== ANY ? picked : []);
  const isMulti = step.kind === "multi" || step.kind === "musts";
  const base = counts?.base ?? 0;

  const options =
    step.kind === "range"
      ? []
      : step.options.filter((o) => {
          if (pickedIds.has(o.id)) return true;
          // An option nothing in the catalogue has (no TN monitor this season) is no choice: no
          // earlier answer to change would make it one.
          if (!step.weightOnly && !finder.items.some(o.match)) return false;
          // Must-haves every remaining item already has (or that nothing could add) are noise.
          if (step.kind !== "musts") return true;
          const c = counts?.counts[o.id] ?? 0;
          return c > 0 && c < base;
        });
  const visit = `${step.key}|${committed ?? ""}`;
  if (columns.current.visit !== visit)
    columns.current = {
      visit,
      cols: columnsFor(options.length),
      // Two or three answers, each with its device: cards, the device above its words.
      card: options.length <= 3 && !!finder.examples?.size,
    };

  // Each tile pictures the product its option brings forward, to scale on a size question.
  const scale = examplesScale(category, step.key, finder.examples);
  const bins =
    step.kind === "range"
      ? histogram(finder.def, finder.items, finder.answers, step.key, 32)
      : [];
  const help = step.help?.[locale];
  const helpId = `${uid}help`;

  // The footer's main button. "No preference" keeps everything: a question that may be skipped
  // offers it until a tile is picked (a multiple choice then continues with its picks).
  const skipLabel =
    step.kind === "musts" ? m.noMustHaves[locale] : m.noPreference[locale];
  let primary: ReactNode = null;
  if (step.kind === "range" || (isMulti && step.required)) {
    primary = (
      <button
        type="button"
        className={cx(button({ tone: "ink", size: "md" }), grow)}
        disabled={step.kind !== "range" && pickedIds.size === 0}
        onClick={() => leave(() => finder.commit(draft ? draft : ANY))}
      >
        {m.continue[locale]}
      </button>
    );
  } else if (isMulti) {
    const skip = pickedIds.size === 0;
    primary = (
      <button
        type="button"
        className={cx(button({ tone: "ink", size: "md" }), skipOrGo, grow)}
        data-skip={skip || undefined}
        title={skip ? m.noPreferenceHint[locale] : undefined}
        onClick={() => leave(() => finder.commit(!skip && draft ? draft : ANY))}
      >
        <span data-skip-label aria-hidden={!skip || undefined}>
          {skipLabel}
        </span>
        <span data-go aria-hidden={skip || undefined}>
          {m.continue[locale]}
        </span>
      </button>
    );
  } else if (!step.required) {
    primary = (
      <button
        type="button"
        className={cx(button({ tone: "dashed", size: "md" }), grow)}
        title={m.noPreferenceHint[locale]}
        onClick={() => leave(() => finder.commit(ANY))}
      >
        {skipLabel}
      </button>
    );
  }

  const seeResults = () => leave(finder.showResults, true);

  return (
    <section ref={root} className={content} aria-labelledby="step-title">
      <div data-console-part className={head}>
        <button
          type="button"
          className={cx(iconButton, css({ gridArea: "back" }))}
          onClick={finder.back}
          disabled={!finder.canGoBack}
          aria-label={m.back[locale]}
        >
          <Icon d="M5 12h14M5 12l6 6M5 12l6-6" />
        </button>
        <button
          type="button"
          className={cx(iconButton, css({ gridArea: "reset" }))}
          onClick={finder.reset}
          aria-label={m.reset[locale]}
        >
          <Icon d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-4v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
        </button>
        <span
          className={css({
            display: { base: "none", md: "inline" },
            fontFamily: "mono",
            fontSize: "xs",
            color: "ink.faint",
            ml: "1",
            fontVariantNumeric: "tabular-nums",
          })}
        >
          {String(finder.position).padStart(2, "0")} /{" "}
          {String(finder.asked.length).padStart(2, "0")}
        </span>
        {onJourney && (
          <button
            type="button"
            className={journeyButton}
            aria-label={m.stepOf(finder.position, finder.asked.length, locale)}
            onClick={onJourney}
            style={
              {
                "--progress": `${(100 * Math.max(0, finder.position - 1)) / Math.max(1, finder.asked.length)}%`,
              } as CSSProperties
            }
          >
            <span
              className={css({
                fontFamily: "mono",
                fontVariantNumeric: "tabular-nums",
              })}
            >
              {String(finder.position).padStart(2, "0")}/
              {String(finder.asked.length).padStart(2, "0")}
            </span>
            <span aria-hidden className={css({ color: "ink.faint" })}>
              ·
            </span>
            {m.journey[locale]}
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
        <h2
          id="step-title"
          data-title
          key={step.key}
          className={css({
            gridArea: "title",
            flex: "1",
            fontSize: { base: "xl", md: "2xl" },
            fontWeight: "600",
            letterSpacing: "-0.03em",
            lineHeight: "1.1",
            mt: { base: "1", md: "0" },
            ml: { base: "0", md: "2" },
          })}
        >
          {step.title[locale]}
        </h2>
        <p className={kind}>
          {step.kind === "range"
            ? m.rangeAnswer[locale]
            : isMulti
              ? m.manyAnswers[locale]
              : m.oneAnswer[locale]}
        </p>
        {help && (
          <button
            ref={helpButton}
            type="button"
            className={cx(iconButton, helpToggle, css({ gridArea: "help" }))}
            popoverTarget={helpId}
            aria-expanded={helpOpen}
            aria-label={m.help[locale]}
          >
            <span data-info>
              <Icon d="M12 17v-5m0-4h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
            </span>
            <span data-close>
              <Icon d="M7 7l10 10M17 7L7 17" />
            </span>
          </button>
        )}
      </div>
      {help && (
        <HelpBubble
          key={step.key}
          id={helpId}
          help={help}
          anchor={helpButton}
          onToggle={setHelpOpen}
        />
      )}

      <div data-console-part className={body}>
        {step.kind === "range" ? (
          <div
            data-budget
            className={css({ h: { base: "12rem", md: "13.5rem" } })}
          >
            <BudgetControl
              step={step as never}
              draft={draft}
              onDraft={finder.setDraft}
              bins={bins}
              locale={locale}
              labels={{
                min: m.budgetMin[locale],
                max: m.budgetMax[locale],
                noLimit: m.noLimit[locale],
              }}
            />
          </div>
        ) : (
          <>
            {/* The explanation shows in the help bubble; screen readers get it with the tiles. */}
            {help && (
              <p id="step-lead" className={css({ srOnly: true })}>
                {plainHelp(help)}
              </p>
            )}
            <div key={step.key} data-tile-scroll className={tileScroll}>
              <fieldset
                aria-labelledby="step-title"
                aria-describedby={help ? "step-lead" : undefined}
                data-layout={columns.current.card ? "card" : undefined}
                className={tileGrid}
                style={{ "--cols": columns.current.cols } as CSSProperties}
              >
                {options.map((option) => {
                  const selected = pickedIds.has(option.id);
                  const count = counts?.counts[option.id] ?? 0;
                  const dead = count === 0 && !selected && !step.weightOnly;
                  const tile = optionTile();
                  const example = finder.examples?.get(option.id);
                  if (dead) {
                    // Nothing to pick: not a button, the tile says which earlier answer leaves it
                    // empty and leads back to that question.
                    const blocker = finder.blockerOf(option.id);
                    const why = `${uid}${option.id}`;
                    return (
                      <div
                        key={option.id}
                        data-tile
                        data-option={option.id}
                        data-dead
                        className={tile.root}
                      >
                        <span className={css({ display: "grid", gap: "1" })}>
                          <span id={`${why}-label`} className={tile.label}>
                            {option.label[locale]}
                          </span>
                          <span className={tile.blocked}>
                            <span id={why}>
                              {blocker
                                ? `${m.blockedBy[locale]} ${blocker.label}`
                                : m.noMatch[locale]}
                            </span>
                            {blocker && (
                              <button
                                type="button"
                                className={tile.change}
                                aria-describedby={`${why}-label ${why}`}
                                onClick={() => finder.goTo(blocker.key)}
                              >
                                {m.change[locale]} →
                              </button>
                            )}
                          </span>
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={option.id}
                      data-tile
                      data-option={option.id}
                      className={css({ display: "grid" })}
                    >
                      <button
                        type="button"
                        className={tile.root}
                        data-pictured={example ? "" : undefined}
                        data-no-count={step.weightOnly || undefined}
                        aria-pressed={isMulti ? selected : undefined}
                        // A preview follows a mouse or the keyboard, never a tap: a finger has
                        // nothing to hover with, and the preview would stay behind it.
                        onPointerEnter={(e) =>
                          e.pointerType === "mouse" &&
                          finder.setHovered(option.id)
                        }
                        onPointerLeave={(e) =>
                          e.pointerType === "mouse" && finder.setHovered(null)
                        }
                        onFocus={(e) =>
                          e.currentTarget.matches(":focus-visible") &&
                          finder.setHovered(option.id)
                        }
                        onBlur={() => finder.setHovered(null)}
                        onClick={() => {
                          if (isMulti)
                            finder.setDraft(toggled(step, draft, option.id));
                          else leave(() => finder.commit(option.id));
                        }}
                      >
                        {example && (
                          <OptionExample
                            item={example}
                            scale={scale.get(option.id)}
                          />
                        )}
                        <span
                          data-text
                          className={css({
                            display: "grid",
                            gap: "0.5",
                            // A phone's row: the words take what the picture and count leave.
                            flex: { base: "1 1 auto", md: "0 1 auto" },
                            minW: "0",
                            md: { gap: "1" },
                          })}
                        >
                          <span className={tile.label}>
                            {option.label[locale]}
                          </span>
                          {option.hint && (
                            <span data-hint className={tile.hint}>
                              {option.hint[locale]}
                            </span>
                          )}
                        </span>
                        {!step.weightOnly && (
                          <span className={tile.count}>
                            {String(count).padStart(3, "0")}
                          </span>
                        )}
                        {selected && (
                          <span className={tile.tick} aria-hidden>
                            <svg
                              aria-hidden
                              viewBox="0 0 24 24"
                              width="12"
                              height="12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M5 12l5 5 9-10" />
                            </svg>
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </fieldset>
            </div>
          </>
        )}
      </div>

      {/* On a phone the two buttons share the width, each a finger's height; when they do not
          fit on one line, the main one goes under the other, the whole width. */}
      <div
        data-console-part
        className={css({
          display: "flex",
          flexWrap: { base: "wrap", md: "nowrap" },
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "2",
          flexShrink: "0",
          minH: "11",
        })}
      >
        {total > 0 && (
          <>
            <button
              type="button"
              className={cx(
                button({ tone: "ghost", size: "sm" }),
                css({ display: { base: "none", md: "inline-flex" } }),
              )}
              onClick={seeResults}
            >
              {m.seeResults(total, locale)} →
            </button>
            <button
              type="button"
              className={cx(
                button({ tone: "line", size: "md" }),
                grow,
                css({ md: { display: "none" } }),
              )}
              onClick={seeResults}
            >
              {m.seeResultsShort(total, locale)} →
            </button>
          </>
        )}
        {primary}
      </div>
    </section>
  );
}
