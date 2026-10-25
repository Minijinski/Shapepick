import { type Category, categorySlugs } from '@choose/catalog'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { type MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { catalogOf, ensureCatalog } from '~/catalogs'
import { loadJourney } from '~/features/finder/journey'
import { type FinderAhead, journeyAhead } from '~/features/finder/targets'
import { useLocale } from '~/i18n/locale'
import { type Arrival, scene } from './controller'
import type { Pt, Viewport } from './geometry'
import type { SceneTarget } from './renderer'

// Moving between the home page and a category is choreographed: the page on screen plays its
// exit, the scene starts its transition at the same moment, and the route changes once the old
// page is out of sight. The new page then enters when the scene is about to settle.

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Longest a page exit may hold a navigation. */
const EXIT_CAP_MS = 650

/** `leave`: the page goes away (home ↔ category); `switch`: one category's finder for another. */
export type ExitKind = 'leave' | 'switch'

/**
 * Plays the page's exit. `ahead`, heading to a category: what its finder will show, so that the
 * page on screen can leave in place what the next one shows in the same place.
 */
type Exit = (kind: ExitKind, ahead: FinderAhead | null) => Promise<void>

let exit: Exit | null = null
/** Bumped by every scene navigation: only the last of several quick clicks navigates. */
let ticket = 0

/** Registers the exit animation of the page on screen. */
export function usePageExit(play: Exit) {
  const latest = useRef(play)
  latest.current = play
  useEffect(() => {
    const run: Exit = (kind, ahead) => latest.current(kind, ahead)
    exit = run
    return () => {
      if (exit === run) exit = null
    }
  }, [])
}

function runPageExit(kind: ExitKind, ahead: FinderAhead | null) {
  const play = exit
  exit = null
  if (!play) return Promise.resolve()
  return Promise.race([
    play(kind, ahead).catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, EXIT_CAP_MS)),
  ])
}

/** A plain left click: modified clicks keep their native meaning (new tab, new window). */
export const isPlainClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

// ---- Journeys ---------------------------------------------------------------------------------

// Each category's questionnaire is resumed where the visitor left it (finder/journey.ts).

const layout = getRouteApi('/$lang')

/** Goes to a category (or home with null), through the scene transition. */
export function useSceneNavigation() {
  const navigate = useNavigate()
  const locale = useLocale()
  const served = layout.useLoaderData()
  return useCallback(
    (category: Category | null, focal?: Pt) => {
      const current = scene.current
      // Already there: the link of the page on screen does nothing.
      if (category && current?.mode === 'canvas' && current.category === category) return
      if (!category && current?.mode === 'bands') return
      const go = () => {
        const kind: ExitKind = category && current?.mode === 'canvas' ? 'switch' : 'leave'
        const journey = category ? loadJourney(category) : {}
        const items = category ? catalogOf(served, category) : undefined
        const ahead = category && items ? journeyAhead(category, items, journey) : null
        if (category && ahead) {
          scene.showCanvas(category, focal)
          // The canvas arrives showing what the saved answers keep, rather than the whole catalogue
          // regrouping once the page is on screen.
          scene.setTargets(category, ahead.targets, focal)
        } else if (category) scene.showCanvas(category, focal)
        else scene.showBands()
        const mine = ++ticket
        void runPageExit(kind, ahead?.finder ?? null).then(() => {
          if (mine !== ticket) return
          // The home page restores the scroll it was left at: its row folds back there.
          if (!category)
            return navigate({ to: '/$lang', params: { lang: locale }, resetScroll: false })
          return navigate({
            to: '/$lang/$category/{-$product}',
            // The category's finder, without the product of a sheet open on the page left.
            params: { lang: locale, category: categorySlugs[category][locale], product: undefined },
            search: journey,
          })
        })
      }
      // A catalogue the page came without (src/catalogs.ts) is in before the transition starts: the
      // scene draws what it shows from the first frame. It usually is in already.
      const needed = category ? [category] : served.shown
      if (needed.every((c) => catalogOf(served, c))) return go()
      void Promise.allSettled(needed.map((c) => ensureCatalog(served, c))).then(go)
    },
    [navigate, locale, served],
  )
}

// ---- Entrances --------------------------------------------------------------------------------

let hydrated = false

/** Called by the layout once the first render has hydrated. */
export const markHydrated = () => {
  hydrated = true
}

/**
 * Delay (s) before a page's entrance animation. While hydrating it is the static default, so the
 * server HTML and the first client render agree; after a client navigation the page waits for the
 * scene to reach `target`, scaled by `share` (1: until it settles).
 */
export function useEnterDelay(target: SceneTarget, share = 1, base = 0.1) {
  const [delay] = useState(() => (hydrated ? Math.max(base, scene.until(target) * share) : base))
  return delay
}

/**
 * Seconds left, as the page mounts, until the scene shows `target` (0 while hydrating): an
 * entrance spread over them ends as the scene settles.
 */
export function useArrivalSpan(target: SceneTarget) {
  const [span] = useState(() => (hydrated ? scene.until(target) : 0))
  return span
}

/** How the scene brings this page in (`intro` on the first paint, server render included). */
export function useArrival(target: SceneTarget): Arrival {
  const [arrival] = useState(() => (hydrated ? scene.arrivalTo(target) : 'intro'))
  return arrival
}

/** The viewport, once known on the client (null while rendering on the server or hydrating). */
export function useViewport(): Viewport | null {
  const [viewport, setViewport] = useState<Viewport | null>(null)
  useIsoLayoutEffect(() => {
    // A phone's toolbar folding away fires resize events that change nothing here: no re-render.
    const fit = () =>
      setViewport((prev) => {
        const next = readViewport()
        return prev && prev.w === next.w && prev.h === next.h ? prev : next
      })
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return viewport
}

/** What a full-viewport fixed element measures, which the canvas and the links both use. */
export const readViewport = (): Viewport => ({
  w: document.documentElement.clientWidth || window.innerWidth,
  h: document.documentElement.clientHeight || window.innerHeight,
})
