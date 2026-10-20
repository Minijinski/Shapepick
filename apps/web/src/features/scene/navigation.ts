import { type Category, categorySlugs } from '@choose/catalog'
import { useNavigate } from '@tanstack/react-router'
import { type MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocale } from '~/i18n/locale'
import { scene } from './controller'
import type { Pt, Viewport } from './geometry'
import type { SceneTarget } from './renderer'

// Moving between the home page and a category is choreographed: the page on screen plays its
// exit, the scene starts its transition at the same moment, and the route changes once the old
// page is out of sight. The new page then enters when the scene is about to settle.

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Longest a page exit may hold a navigation. */
const EXIT_CAP_MS = 650

let exit: (() => Promise<void>) | null = null

/** Registers the exit animation of the page on screen. */
export function usePageExit(play: () => Promise<void>) {
  const latest = useRef(play)
  latest.current = play
  useEffect(() => {
    const run = () => latest.current()
    exit = run
    return () => {
      if (exit === run) exit = null
    }
  }, [])
}

function runPageExit() {
  const play = exit
  exit = null
  if (!play) return Promise.resolve()
  return Promise.race([
    play().catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, EXIT_CAP_MS)),
  ])
}

/** A plain left click: modified clicks keep their native meaning (new tab, new window). */
export const isPlainClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

/** Goes to a category (or home with null), through the scene transition. */
export function useSceneNavigation() {
  const navigate = useNavigate()
  const locale = useLocale()
  return useCallback(
    (category: Category | null, focal?: Pt) => {
      const go = () =>
        category
          ? navigate({
              to: '/$lang/$category',
              params: { lang: locale, category: categorySlugs[category][locale] },
            })
          : navigate({ to: '/$lang', params: { lang: locale } })
      const current = scene.current
      const already = category
        ? current?.mode === 'canvas' && current.category === category
        : current?.mode === 'bands'
      if (already) return void go()
      if (category) scene.showCanvas(category, focal)
      else scene.showBands()
      void runPageExit().then(go)
    },
    [navigate, locale],
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
