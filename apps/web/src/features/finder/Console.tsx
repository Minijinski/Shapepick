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
  maxH: { base: "min(25rem, 46dvh)", md: "min(32rem, 58dvh)" },
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
});

const tileGrid = css({
  border: "0",
  m: "0",
  p: "0",
  minW: "0",
  display: "grid",
  gridTemplateColumns: {
    base: "repeat(2, minmax(0, 1fr))",
    md: "repeat(var(--cols, 5), minmax(0, 1fr))",
  },
  // A dead tile that needs one more line to say what blocks it grows its row rather than
  // overflowing it.
  gridAutoRows: { base: "minmax(4.75rem, auto)", md: "minmax(6.25rem, auto)" },
  gap: "2.5",
});

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
}: {
  finder: Finder;
  category: Category;
  locale: Locale;
  /** Seconds before the first question plays in, while the console itself rises. */
  enterDelay?: number;
  /** In place of the results: its header and footer fade in with the question. */
  morph?: boolean;
}) {
  const { step, counts, draft } = finder;
  const root = useRef<HTMLElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const uid = useId();
  const leaving = useRef(false);
  const first = useRef(true);
  /** The tiles' columns, settled once per visit of a question: picks never reflow the grid. */
  const columns = useRef({ visit: "", cols: 5 });
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
    columns.current = { visit, cols: columnsFor(options.length) };

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
        className={button({ tone: "ink", size: "md" })}
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
        className={cx(button({ tone: "ink", size: "md" }), skipOrGo)}
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
        className={button({ tone: "dashed", size: "md" })}
        title={m.noPreferenceHint[locale]}
        onClick={() => leave(() => finder.commit(ANY))}
      >
        {skipLabel}
      </button>
    );
  }

  return (
    <section ref={root} className={content} aria-labelledby="step-title">
      <div
        data-console-part
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "2",
          flexShrink: "0",
          // Room for a title on two lines on phones, so the header never changes height.
          minH: { base: "3.25rem", md: "2.5rem" },
        })}
      >
        <button
          type="button"
          className={iconButton}
          onClick={finder.back}
          disabled={!finder.canGoBack}
          aria-label={m.back[locale]}
        >
          <Icon d="M5 12h14M5 12l6 6M5 12l6-6" />
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={finder.reset}
          aria-label={m.reset[locale]}
        >
          <Icon d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-4v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
        </button>
        <span
          className={css({
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
        <h2
          id="step-title"
          data-title
          key={step.key}
          className={css({
            flex: "1",
            fontSize: { base: "xl", md: "2xl" },
            fontWeight: "600",
            letterSpacing: "-0.03em",
            lineHeight: "1.1",
            ml: "2",
          })}
        >
          {step.title[locale]}
        </h2>
        {help && (
          <button
            ref={helpButton}
            type="button"
            className={cx(iconButton, helpToggle)}
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
                        onPointerEnter={() => finder.setHovered(option.id)}
                        onPointerLeave={() => finder.setHovered(null)}
                        onFocus={() => finder.setHovered(option.id)}
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
                            gap: "1",
                            pr: { base: "7", md: "0" },
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

      <div
        data-console-part
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "2",
          flexShrink: "0",
          minH: "11",
        })}
      >
        {total > 0 && (
          <button
            type="button"
            className={button({ tone: "ghost", size: "sm" })}
            onClick={() => leave(finder.showResults, true)}
          >
            {/* A phone has room for the number only, beside "No preference". */}
            <span className={css({ display: { base: "none", md: "inline" } })}>
              {m.seeResults(total, locale)} →
            </span>
            <span className={css({ display: { base: "inline", md: "none" } })}>
              {m.seeResultsShort(total, locale)} →
            </span>
          </button>
        )}
        {primary}
      </div>
    </section>
  );
}
