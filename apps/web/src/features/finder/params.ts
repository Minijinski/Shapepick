import { BRAND_STEP, finders } from '@choose/catalog'

// What a finder page reads from its address (useFinder.ts): each question's answer, the brands,
// and its own state. Only these make one page differ from another, so Netlify keeps one copy of a
// page per combination of them (`Netlify-Vary`, routes/$lang.tsx), and any other parameter (a
// campaign tag, a made-up one) shares that copy instead of having the function render a page again.
// A new parameter useFinder reads goes here too, or pages differing by it would share one copy.

/** The finder's own state: the order of the questions, the one on screen, the one left for results. */
export const FINDER_STATE = ['order', 'at', 'from'] as const

/** Every parameter a finder page reads, in every category. */
export const FINDER_PARAMS = [
  ...new Set([
    BRAND_STEP,
    ...FINDER_STATE,
    ...Object.values(finders).flatMap((def) => def.steps.map((step) => step.key)),
  ]),
].sort()

/** How Netlify's CDN tells finder pages apart: by those parameters only. */
export const FINDER_VARY = `query=${FINDER_PARAMS.join('|')}`
