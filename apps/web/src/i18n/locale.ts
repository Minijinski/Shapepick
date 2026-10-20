import { baseLocale, isLocale, type Locale } from '@choose/catalog'
import { useParams } from '@tanstack/react-router'

/** The locale of the current page, read from the `$lang` path segment. */
export function useLocale(): Locale {
  const { lang } = useParams({ strict: false }) as { lang?: string }
  return isLocale(lang) ? lang : baseLocale
}

/** Picks the preferred supported locale from an Accept-Language header. */
export function negotiateLocale(header: string | null | undefined): Locale {
  for (const part of (header ?? '').split(',')) {
    const tag = part.split(';')[0]?.trim().slice(0, 2).toLowerCase()
    if (isLocale(tag)) return tag
  }
  return baseLocale
}
