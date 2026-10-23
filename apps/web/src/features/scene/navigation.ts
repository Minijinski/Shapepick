import { type Category, categorySlugs } from '@choose/catalog'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { type MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type FinderAhead, journeyAhead } from '~/features/finder/targets'
import type { FinderSearch } from '~/features/finder/useFinder'
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

// Each category remembers where the visitor left its questionnaire, so switching to monitors and
// back to keyboards resumes the keyboard answers. Browser storage only: a convenience, never
// required (private windows and blocked storage simply start afresh).

const journeyKey = (category: Category) => `choose-a-device:journey:${category}`

export function saveJourney(category: Category, search: FinderSearch) {
  try {
    localStorage.setItem(journeyKey(category), JSON.stringify(search))
  } catch {}
}

function loadJourney(category: Category): FinderSearch {
  try {
    const raw = localStorage.getItem(journeyKey(category))
    const value: unknown = raw ? JSON.parse(raw) : null
    if (!value || typeof value !== 'object') return {}
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => typeof v === 'string'),
    ) as FinderSearch
  } catch {
    return {}
  }
}

const layout = getRouteApi('/$lang')

/** Goes to a category (or home with null), through the scene transition. */
export function useSceneNavigation() {
  const navigate = useNavigate()
  const locale = useLocale()
  const { catalogs } = layout.useLoaderData()
  return useCallback(
    (category: Category | null, focal?: Pt) => {
      const current = scene.current
      // Already there: the link of the page on screen does nothing.
      if (category && current?.mode === 'canvas' && current.category === category) return
      if (!category && current?.mode === 'bands') return
      const kind: ExitKind = category && current?.mode === 'canvas' ? 'switch' : 'leave'
      const journey = category ? loadJourney(category) : {}
      const ahead = category ? journeyAhead(category, catalogs[category], journey) : null
      if (category && ahead) {
        scene.showCanvas(category, focal)
        // The canvas arrives showing what the saved answers keep, rather than the whole catalogue
        // regrouping once the page is on screen.
        scene.setTargets(category, ahead.targets, focal)
      } else scene.showBands()
      const mine = ++ticket
      void runPageExit(kind, ahead?.finder ?? null).then(() => {
        if (mine !== ticket) return
        if (!category) return navigate({ to: '/$lang', params: { lang: locale } })
        return navigate({
          to: '/$lang/$category',
          params: { lang: locale, category: categorySlugs[category][locale] },
          search: journey,
        })
      })
    },
    [navigate, locale, catalogs],
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

/** How the scene brings this page in (`intro` on the first paint, server render included). */
export function useArrival(target: SceneTarget): Arrival {
  const [arrival] = useState(() => (hydrated ? scene.arrivalTo(target) : 'intro'))
  return arrival
}

/** The viewport, once known on the client (null while rendering on the server or hydrating). */
export function useViewport(): Viewport | null {
  const [viewport, setViewport] = useState<Viewport | null>(null)
  useIsoLayoutEffect(() => {
    const fit = () => setViewport(readViewport())
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
