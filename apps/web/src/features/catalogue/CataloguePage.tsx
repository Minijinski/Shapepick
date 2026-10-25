import {
  type Category,
  categorySlugs,
  finderOf,
  finders,
  type Locale,
  locales,
  stepOf,
} from '@choose/catalog'
import { type ReactNode, useEffect, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { button } from 'styled-system/recipes'
import { CategoryIcon } from '~/components/CategoryIcon'
import { loadJourney } from '~/features/finder/journey'
import { legalPaths } from '~/features/legal/legal'
import { messages as m } from '~/i18n/messages'
import { stringifySearch } from '~/search'
import { categoryPaths } from '~/seo'
import type { Collection } from './collections'

// The catalogue's pages, a document beside the finder as the legal page is: outside the locale's
// layout, they load no catalogue, no canvas and no preloader, and every link from them is an
// ordinary one. A category's index (every product, brand by brand) and its collections (the
// products a few answers keep, ranked) share the header, the heading and the foot of the page.

/** The page's gutter, the site header's: clear of a phone's notch and rounded corners. */
export const gutter = css({
  pl: { base: 'max(1rem, env(safe-area-inset-left))', md: 'max(2rem, env(safe-area-inset-left))' },
  pr: {
    base: 'max(1rem, env(safe-area-inset-right))',
    md: 'max(2rem, env(safe-area-inset-right))',
  },
})

/** A document's width, the legal page's. */
export const column = css({ w: '100%', maxW: '72rem', mx: 'auto' })

/**
 * What takes a link from these pages back into each category's finder where the visitor left it:
 * the answers it remembers (finder/journey.ts), as a query. Nothing on the server nor on the first
 * render, so the page served keeps plain links; the answers once it is in the browser. A product's
 * sheet reached so opens over that journey, its rank and match as the finder would give them.
 */
export function useJourneyQueries(categories: readonly Category[]) {
  const [queries, setQueries] = useState<Partial<Record<Category, string>>>({})
  const key = categories.join(',')
  useEffect(() => {
    const list = key.split(',') as Category[]
    setQueries(Object.fromEntries(list.map((c) => [c, stringifySearch(loadJourney(c))])))
  }, [key])
  return queries
}

/** A label in mono capitals, as the sheet and the results title their parts. */
export const caption = css({
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

const languageLink = css({
  display: 'inline-flex',
  alignItems: 'center',
  h: '8',
  px: '3',
  _coarse: { h: '10', px: '3.5' },
  borderRadius: 'pill',
  fontFamily: 'mono',
  fontSize: 'xs',
  textTransform: 'uppercase',
  color: 'ink.muted',
  transition: 'color 160ms, background 160ms',
  _hover: { color: 'ink' },
  '&[aria-current=page]': {
    color: 'ink',
    bg: 'surface.raised',
    boxShadow: '0 0 0 1px token(colors.line)',
  },
})

/** A category's finder, by its icon: the page's own on its disc, as in the site header. */
const categoryLink = css({
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  w: '9',
  h: '9',
  borderRadius: 'full',
  color: 'ink.muted',
  transition: 'color 160ms, background 160ms',
  _hover: { color: 'ink' },
  _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
  '&[data-picked]': {
    color: 'ink',
    bg: 'surface.raised',
    boxShadow: '0 0 0 1px token(colors.line)',
  },
})

function CatalogueHeader({
  locale,
  category,
  shown,
  paths,
}: {
  locale: Locale
  category: Category
  shown: readonly Category[]
  paths: Record<Locale, string>
}) {
  const journeys = useJourneyQueries(shown)
  return (
    <header
      className={cx(
        gutter,
        css({
          boxSizing: 'content-box',
          h: '16',
          pt: 'env(safe-area-inset-top)',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: '4',
        }),
      )}
    >
      <a
        href={`/${locale}`}
        className={css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2.5',
          justifySelf: 'start',
        })}
      >
        <span aria-hidden className={css({ w: '3', h: '3', borderRadius: 'full', bg: 'signal' })} />
        <span
          className={css({
            fontFamily: 'mono',
            fontSize: 'sm',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
          })}
        >
          {m.siteName[locale]}
        </span>
      </a>
      <nav
        aria-label={m.categories[locale]}
        className={css({ display: { base: 'none', sm: 'flex' }, gap: '1.5' })}
      >
        {shown.map((other) => (
          <a
            key={other}
            href={categoryPaths(other)[locale] + (journeys[other] ?? '')}
            aria-label={m.category[other][locale]}
            title={m.category[other][locale]}
            data-picked={other === category || undefined}
            className={categoryLink}
          >
            <CategoryIcon category={other} />
          </a>
        ))}
      </nav>
      <nav
        aria-label={m.language[locale]}
        className={css({ gridColumn: '3', justifySelf: 'end', display: 'flex', gap: '1' })}
      >
        {locales.map((other) => (
          <a
            key={other}
            href={paths[other]}
            hrefLang={other}
            lang={other}
            aria-current={other === locale ? 'page' : undefined}
            className={languageLink}
          >
            {other}
          </a>
        ))}
      </nav>
    </header>
  )
}

/** `finder`: the category's finder, which the link resumes where the visitor left it. */
type Crumb = { name: string; path?: string; finder?: boolean }

type ShellProps = {
  locale: Locale
  category: Category
  shown: readonly Category[]
  /** The page's path in each locale, which the language links lead to. */
  paths: Record<Locale, string>
  /** Where the page sits, from its category down to itself (the last, not a link). */
  crumbs: Crumb[]
  title: string
  /** The facts under the title, in a few words. */
  lead: ReactNode
  /** The page's buttons, under its lead. */
  actions?: ReactNode
  children: ReactNode
}

export function CatalogueShell({
  locale,
  category,
  shown,
  paths,
  crumbs,
  title,
  lead,
  actions,
  children,
}: ShellProps) {
  // The root marks every page of a locale as held under the preloader, and only the locale's
  // layout lifts the hold: this page has neither, and nothing of it waits.
  useEffect(() => document.documentElement.removeAttribute('data-loading'), [])
  const journey = useJourneyQueries([category])[category] ?? ''
  return (
    // A document, unlike the finder: its text can be selected and copied.
    <div
      className={css({ userSelect: 'text', minH: '100dvh', display: 'flex', flexDir: 'column' })}
    >
      <CatalogueHeader locale={locale} category={category} shown={shown} paths={paths} />
      <main className={cx(gutter, css({ flex: '1' }))}>
        <div className={column}>
          <header
            className={css({
              display: 'grid',
              justifyItems: 'start',
              gap: { base: '4', md: '5' },
              pt: { base: '8', md: '14' },
              pb: { base: '8', md: '12' },
            })}
          >
            <nav aria-label={m.catalogue[locale]}>
              <ol
                className={cx(
                  caption,
                  css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    columnGap: '2',
                    rowGap: '1',
                    color: 'ink.muted',
                    letterSpacing: '0.06em',
                  }),
                )}
              >
                <li aria-hidden className={css({ color: 'signal' })}>
                  ●
                </li>
                {crumbs.map((crumb, i) => (
                  <li
                    key={crumb.name}
                    className={css({ display: 'inline-flex', gap: '2', alignItems: 'center' })}
                  >
                    {i > 0 && (
                      <span aria-hidden className={css({ color: 'ink.faint' })}>
                        /
                      </span>
                    )}
                    {crumb.path ? (
                      <a
                        href={crumb.finder ? crumb.path + journey : crumb.path}
                        className={css({ transition: 'color 160ms', _hover: { color: 'ink' } })}
                      >
                        {crumb.name}
                      </a>
                    ) : (
                      <span aria-current="page" className={css({ color: 'ink.faint' })}>
                        {crumb.name}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            <h1
              className={css({
                // In em rather than ch: the same width before and after the web font arrives,
                // so a title keeps its lines (a width in ch follows the font's digits).
                maxW: '14em',
                fontSize: {
                  base: 'clamp(2rem, 1.1rem + 4.2vw, 2.75rem)',
                  md: 'clamp(2.75rem, 1.4rem + 3.2vw, 4.25rem)',
                },
                fontWeight: '650',
                letterSpacing: '-0.015em',
                lineHeight: '1.04',
                textWrap: 'balance',
              })}
            >
              {title}
            </h1>
            <p
              className={css({
                maxW: '38rem',
                fontSize: { base: 'md', md: 'lg' },
                lineHeight: '1.5',
                color: 'ink.muted',
                textWrap: 'pretty',
              })}
            >
              {lead}
            </p>
            {actions && (
              <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2', mt: '1' })}>
                {actions}
              </div>
            )}
          </header>
          {children}
        </div>
      </main>
      <footer className={gutter}>
        <div
          className={cx(
            column,
            css({
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '3',
              py: { base: '8', md: '10' },
              pb: { base: 'max(2rem, env(safe-area-inset-bottom))', md: '10' },
              fontFamily: 'mono',
              fontSize: '2xs',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'ink.faint',
            }),
          )}
        >
          <span>{m.siteName[locale]}</span>
          <a
            href={legalPaths[locale]}
            className={css({
              color: 'ink.muted',
              transition: 'color 160ms',
              _hover: { color: 'ink' },
            })}
          >
            {m.legal[locale]}
          </a>
        </div>
      </footer>
    </div>
  )
}

/** The page's main button: to the category's finder. */
export const primaryAction = cx(button({ tone: 'ink', size: 'md' }), css({ px: '5' }))
/** A quieter one beside it. */
export const secondaryAction = button({ tone: 'line', size: 'md' })

/** A part of the page: its title at the left (above it on a phone), its content beside it. */
export function CatalogueSection({
  id,
  title,
  aside,
  children,
}: {
  id: string
  title: ReactNode
  /** Under the title: a count, a note. */
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={css({
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', md: '13rem minmax(0, 1fr)' },
        columnGap: '10',
        rowGap: '3',
        py: { base: '6', md: '8' },
        borderTopWidth: '1px',
        borderColor: 'line',
        scrollMarginTop: '4',
      })}
    >
      <div className={css({ display: 'grid', alignContent: 'start', gap: '1' })}>
        <h2
          id={`${id}-title`}
          className={css({
            fontSize: { base: 'lg', md: 'xl' },
            fontWeight: '600',
            letterSpacing: '-0.01em',
            lineHeight: '1.2',
          })}
        >
          {title}
        </h2>
        {aside && <p className={caption}>{aside}</p>}
      </div>
      <div className={css({ minW: '0' })}>{children}</div>
    </section>
  )
}

/** A collection as a link: its short name and how many products it holds. */
const chip = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  h: '8',
  _coarse: { h: '10' },
  pl: '3',
  pr: '2.5',
  borderRadius: 'pill',
  borderWidth: '1px',
  borderColor: 'line',
  bg: 'surface',
  fontSize: 'sm',
  color: 'ink',
  whiteSpace: 'nowrap',
  transition: 'border-color 160ms, background 160ms',
  _hover: { borderColor: 'ink', bg: 'surface.raised' },
  _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
})

export function CollectionChip({
  href,
  label,
  count,
}: {
  href: string
  label: string
  count: number
}) {
  return (
    <a href={href} className={chip}>
      {label}
      <span
        className={css({
          fontFamily: 'mono',
          fontSize: '2xs',
          color: 'ink.faint',
          fontVariantNumeric: 'tabular-nums',
        })}
      >
        {count}
      </span>
    </a>
  )
}

/** The chips of several collections, wrapping. */
export const chips = css({ display: 'flex', flexWrap: 'wrap', gap: '2' })

/** The questions a category's finder asks. */
export const questionsOf = (category: Category) =>
  finders[category].steps.filter((step) => !step.aside).length

/**
 * The finder with a collection's answers already given, where its questions can narrow it down:
 * those the address can carry (one option of a single-answer question at most), and its use.
 */
export function finderLink(collection: Collection, locale: Locale) {
  const def = finderOf(collection.category)
  const answers: Record<string, string> = { ...collection.steer }
  if (collection.use) answers[def.profileStep] = collection.use
  for (const [key, ids] of Object.entries(collection.picks)) {
    const step = stepOf(def, key)
    if (step.kind !== 'single' || ids.length === 1) answers[key] = ids.join(',')
  }
  const query = Object.entries(answers)
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%2C/gi, ',')}`)
    .join('&')
  return `/${locale}/${categorySlugs[collection.category][locale]}${query ? `?${query}` : ''}`
}
