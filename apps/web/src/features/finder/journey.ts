import type { Category } from '@choose/catalog'
import type { FinderSearch } from './useFinder'

// Each category remembers where the visitor left its questionnaire, so switching to monitors and
// back to keyboards resumes the keyboard answers, and a link from the catalogue's pages takes the
// visitor back there. Browser storage only: a convenience, never required (private windows and
// blocked storage simply start afresh). A module of its own, so that the catalogue's pages read it
// without the scene.

const journeyKey = (category: Category) => `choose-a-device:journey:${category}`

export function saveJourney(category: Category, search: FinderSearch) {
  try {
    localStorage.setItem(journeyKey(category), JSON.stringify(search))
  } catch {}
}

export function loadJourney(category: Category): FinderSearch {
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
