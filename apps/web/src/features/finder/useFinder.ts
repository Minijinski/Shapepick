import {
  ANY,
  type Answers,
  askedSteps,
  type CatalogItem,
  type Category,
  type ChoiceStep,
  deadEnd,
  describeAnswer,
  filter,
  finderOf,
  firstPending,
  isInformed,
  journeyStates,
  type Locale,
  optionCounts,
  predicateOf,
  previousStep,
  rank,
  readChoice,
  readOrder,
  type Step,
  sanitizeAnswers,
  type Text,
  withAnswer,
  withDraft,
  withOrder,
} from "@choose/catalog";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItemDetail } from "../scene/controller";
import type { JourneyStop } from "./JourneyBar";

// Everything a finder screen shows is derived here from three inputs: the catalogue, the answers
// in the URL, and what the visitor is doing right now (a draft pick, a hovered tile). Committed
// answers live in the URL, with the order the visitor chose for the questions (`order`); the
// draft lives in state until "Continue".

export const DONE = "done";

/**
 * How long a hovered option stays hovered once the pointer leaves its tile. Going from one tile
 * to the next crosses the gap between them: the canvas then moves straight from one option's
 * products to the other's instead of flashing back to none in between.
 */
const HOVER_GRACE_MS = 160;

export type FinderSearch = Record<string, string | undefined>;

/**
 * What a product's sheet shows: its rank and match (with the fit and the answers met it is made
 * of) once there is something to rank on, what rules it out when the answers do.
 */
export type ProductSheet = {
  item: CatalogItem;
  rank: number | null;
  score: number | null;
  fit: number | null;
  met: number | null;
  pros: Text[];
  cons: Text[];
  ruledOut: boolean;
  excludedBy: string | null;
};

export function useFinder(
  category: Category,
  items: CatalogItem[],
  search: FinderSearch,
  locale: Locale,
) {
  const sequence = search.order;
  const def = useMemo(() => {
    const base = finderOf(category);
    return withOrder(base, readOrder(base, sequence));
  }, [category, sequence]);
  const navigate = useNavigate();
  const answers = useMemo(() => sanitizeAnswers(def, search), [def, search]);
  const at = search.at;

  const currentKey = useMemo(() => {
    if (at === DONE) return null;
    const explicit = def.steps.find((s) => s.key === at);
    if (explicit && (explicit.applies?.(answers) ?? true)) return explicit.key;
    return firstPending(def, items, answers);
  }, [def, items, answers, at]);
  const step = currentKey
    ? (def.steps.find((s) => s.key === currentKey) ?? null)
    : null;

  // ---- Draft & hover ------------------------------------------------------------------------
  const [draft, setDraft] = useState<string | undefined>(
    currentKey ? answers[currentKey] : undefined,
  );
  const [hovered, setHoveredNow] = useState<string | null>(null);
  const letGo = useRef<ReturnType<typeof setTimeout>>(undefined);
  const setHovered = useCallback((id: string | null) => {
    clearTimeout(letGo.current);
    if (id != null) setHoveredNow(id);
    else letGo.current = setTimeout(() => setHoveredNow(null), HOVER_GRACE_MS);
  }, []);
  useEffect(() => () => clearTimeout(letGo.current), []);
  useEffect(() => {
    setDraft(currentKey ? answers[currentKey] : undefined);
    clearTimeout(letGo.current);
    setHoveredNow(null);
  }, [currentKey, answers]);

  const effective = useMemo(
    () =>
      currentKey && draft !== undefined
        ? withAnswer(answers, currentKey, draft)
        : answers,
    [answers, currentKey, draft],
  );

  // ---- Derived catalogue state ---------------------------------------------------------------
  const ranked = useMemo(
    () => rank(def, items, effective),
    [def, items, effective],
  );
  /** Whether the answers give the ranking anything to go on: until then, no podium, rank or match. */
  const informed = useMemo(
    () => isInformed(def, effective),
    [def, effective],
  );
  /** The use the visitor picked, which the match is measured against. */
  const useLabel = useMemo(() => {
    const profile = def.steps.find((s) => s.key === def.profileStep);
    return profile
      ? describeAnswer(profile, effective[def.profileStep], locale)
      : null;
  }, [def, effective, locale]);
  const asked = useMemo(
    () => askedSteps(def, items, answers),
    [def, items, answers],
  );
  const counts = useMemo(
    () => (step ? optionCounts(def, items, effective, step.key) : null),
    [def, items, effective, step],
  );

  /** What the counter would read if the hovered tile were picked. */
  const preview = useMemo(() => {
    if (!step || !hovered || step.weightOnly || step.kind === "range")
      return null;
    const next = toggled(step, draft, hovered);
    return filter(def, items, withAnswer(answers, step.key, next)).length;
  }, [def, items, answers, step, draft, hovered]);

  // ---- Navigation ----------------------------------------------------------------------------
  const go = useCallback(
    (next: Answers, at?: string, from?: string, order = sequence) =>
      navigate({
        to: ".",
        search: {
          ...next,
          ...(order && { order }),
          ...(at && { at }),
          ...(from && { from }),
        },
        resetScroll: false,
      }),
    [navigate, sequence],
  );
  const commit = useCallback(
    (value: string | null) => {
      if (!currentKey) return;
      go(withAnswer(answers, currentKey, value));
    },
    [answers, currentKey, go],
  );
  /**
   * An answered question reopened, from a chip of the rail or a tile's "Change". Like a stop of
   * the journey bar, it commits the picks on screen first, as "Continue" would; Back drops them.
   */
  const goTo = useCallback(
    (key: string) => {
      if (key !== currentKey) go(withDraft(answers, currentKey, draft), key);
    },
    [answers, currentKey, draft, go],
  );
  /**
   * A question picked on the journey bar. An answered one reopens, like a chip of the rail; one
   * still ahead moves up to be the next answered, and the others keep their order behind it.
   */
  const pickStep = useCallback(
    (key: string) => {
      if (key === currentKey) return;
      const next = withDraft(answers, currentKey, draft);
      if (next[key] != null) return go(next, key);
      const answered = def.steps
        .filter((s) => s.key !== key && next[s.key] != null)
        .map((s) => s.key);
      go(next, undefined, undefined, [...answered, key].join(","));
    },
    [def, answers, currentKey, draft, go],
  );
  const back = useCallback(() => {
    const previous = previousStep(def, items, answers, currentKey);
    if (previous) go(answers, previous);
  }, [def, items, answers, currentKey, go]);
  // Starting over forgets the order too.
  const reset = useCallback(() => go({}, undefined, undefined, ""), [go]);
  // The results read the answers on screen, picks not yet confirmed included (the button said
  // how many they leave), and remember the question they were opened from.
  const showResults = useCallback(
    () => go(sanitizeAnswers(def, effective), DONE, currentKey ?? undefined),
    [def, effective, currentKey, go],
  );
  // Back from the results to that question; without one (a shared link), to the first question
  // left unanswered, or the last one asked when every question has its answer.
  const from = search.from;
  const editAnswers = useCallback(() => {
    const target =
      (from && asked.includes(from) ? from : null) ??
      firstPending(def, items, answers) ??
      asked[asked.length - 1];
    if (target) go(answers, target);
  }, [def, items, answers, asked, from, go]);
  const canGoBack = useMemo(
    () => previousStep(def, items, answers, currentKey) != null,
    [def, items, answers, currentKey],
  );

  const blockerOf = useCallback(
    (optionId: string) => {
      if (!step) return null;
      const found = deadEnd(def, items, effective, step.key, optionId);
      if (!found) return null;
      const blocker = def.steps.find((s) => s.key === found.blockedBy);
      return blocker
        ? { key: blocker.key, label: blocker.label[locale], count: found.count }
        : null;
    },
    [def, items, effective, step, locale],
  );

  // ---- Answer rail ---------------------------------------------------------------------------
  const rail = useMemo(
    () =>
      def.steps
        .filter((s) => answers[s.key] != null && asked.includes(s.key))
        .map((s) => ({
          key: s.key,
          label: s.label[locale],
          value: describeAnswer(s, answers[s.key], locale) ?? "",
        })),
    [def, answers, asked, locale],
  );

  // ---- Journey bar ---------------------------------------------------------------------------
  /**
   * Every question, answered, on screen or still ahead, in the questionnaire's own order: the bar
   * is a map that stays put whatever order they answer in. One that the answers, the draft on
   * screen included, leave nothing to decide stays in its place, greyed out.
   */
  const stops = useMemo(
    () => journeyStates(def, items, answers, currentKey, draft),
    [def, items, answers, currentKey, draft],
  );
  const journey = useMemo(
    () =>
      finderOf(category).steps.map((s): JourneyStop => ({
        key: s.key,
        label: s.label[locale],
        value: describeAnswer(s, answers[s.key], locale),
        state: stops[s.key] ?? "skipped",
      })),
    [category, stops, answers, locale],
  );

  // ---- Canvas --------------------------------------------------------------------------------
  /** The test each answered step puts on a product, the draft included. */
  const tests = useMemo(
    () =>
      def.steps.flatMap((s) => {
        const test = predicateOf(s, effective);
        return test ? [{ step: s, test }] : [];
      }),
    [def, effective],
  );

  /**
   * How many answers each product fails: 0 is kept (drawn in colour), more is drawn as an ever
   * fainter sketch. null while no answer filters anything yet.
   */
  const misses = useMemo(() => {
    if (!tests.length) return null;
    return new Map(
      items.map((item) => [
        def.id(item),
        tests.filter((t) => !t.test(item)).length,
      ]),
    );
  }, [def, items, tests]);

  /** Kept products, best match first: the canvas's short list and podium badges follow it. */
  const order = useMemo(() => ranked.map((r) => def.id(r.item)), [def, ranked]);
  const scores = useMemo(() => ranked.map((r) => r.score), [ranked]);

  /** Products the hovered option keeps, given every other answer: highlighted on the canvas. */
  const hotIds = useMemo(() => {
    if (!step || !hovered || step.weightOnly || step.kind === "range")
      return null;
    const option = step.options.find((o) => o.id === hovered);
    if (!option) return null;
    const base = filter(def, items, answers, { without: step.key });
    // A must-have adds to the ones already picked, so those stay applied.
    const pool = step.kind === "musts" ? filter(def, base, effective) : base;
    return new Set(pool.filter(option.match).map(def.id));
  }, [def, items, answers, effective, step, hovered]);

  /** What the product popup prints: rank and match for a kept product, the blocking answer otherwise. */
  const details = useMemo(() => {
    const map = new Map<string, ItemDetail>();
    ranked.forEach((r, i) => {
      map.set(
        def.id(r.item),
        informed
          ? { rank: i, score: r.score, ruledOut: false, excludedBy: null }
          : { rank: null, score: null, ruledOut: false, excludedBy: null },
      );
    });
    for (const item of items) {
      const id = def.id(item);
      if (map.has(id)) continue;
      const blocker = tests.find((t) => !t.test(item));
      map.set(id, {
        rank: null,
        score: null,
        ruledOut: true,
        excludedBy: blocker?.step.label[locale] ?? null,
      });
    }
    return map;
  }, [def, items, ranked, informed, tests, locale]);

  /** One product's sheet, whether the answers keep it or rule it out. */
  const sheetOf = useCallback(
    (slug: string): ProductSheet | null => {
      const index = ranked.findIndex((r) => def.id(r.item) === slug);
      const entry = ranked[index];
      if (entry && !informed)
        return {
          ...entry,
          rank: null,
          score: null,
          fit: null,
          met: null,
          ruledOut: false,
          excludedBy: null,
        };
      if (entry)
        return { ...entry, rank: index, ruledOut: false, excludedBy: null };
      const item = items.find((i) => def.id(i) === slug);
      if (!item) return null;
      // Ruled out: no rank and no score, but its strengths still read against the visitor's use.
      const use = effective[def.profileStep];
      const [fit] = rank(def, [item], use ? { [def.profileStep]: use } : {});
      return {
        item,
        rank: null,
        score: null,
        fit: null,
        met: null,
        pros: fit?.pros ?? [],
        cons: fit?.cons ?? [],
        ruledOut: true,
        excludedBy: details.get(slug)?.excludedBy ?? null,
      };
    },
    [def, items, ranked, informed, effective, details],
  );

  return {
    def,
    items,
    answers,
    step,
    currentKey,
    draft,
    setDraft,
    hovered,
    setHovered,
    ranked,
    informed,
    useLabel,
    matching: ranked.length,
    preview,
    counts,
    asked,
    position: currentKey ? asked.indexOf(currentKey) + 1 : asked.length,
    rail,
    journey,
    misses,
    order,
    scores,
    hotIds,
    details,
    commit,
    goTo,
    pickStep,
    back,
    canGoBack,
    reset,
    showResults,
    editAnswers,
    blockerOf,
    sheetOf,
  };
}

export type Finder = ReturnType<typeof useFinder>;

/** The draft after clicking a tile: a single pick replaces, a multi pick toggles. */
export function toggled<I>(
  step: Step<I>,
  draft: string | undefined,
  id: string,
): string {
  if (step.kind !== "multi" && step.kind !== "musts") return id;
  const picked = readChoice(step as ChoiceStep<I>, draft);
  const list = picked && picked !== ANY ? picked : [];
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  return next.length ? next.join(",") : "";
}
