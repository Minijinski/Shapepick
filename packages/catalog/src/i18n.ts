export const locales = ['fr', 'en'] as const
export type Locale = (typeof locales)[number]
export const baseLocale: Locale = 'fr'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (locales as readonly string[]).includes(value)

/** A string in every supported locale. Catalog content (questions, options) carries its own copy. */
export type Text = Record<Locale, string>

export const text = (fr: string, en: string = fr): Text => ({ fr, en })
