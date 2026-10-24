import { type Locale, locales, text } from '@choose/catalog'
import { type ReactNode, useEffect } from 'react'
import { css, cx } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { legalPaths } from './legal'

// The legal notice and privacy page, one per language (routes/$lang_.mentions-legales.tsx,
// routes/$lang_.legal.tsx), each route holding its own text: who publishes the site, who hosts it,
// what it keeps of a visit. A plain document beside the finder rather than a page of it: outside
// the locale's layout, it loads no catalogue, no canvas and no preloader, and the links between it
// and the rest of the site are ordinary ones.

/** When the text last changed, shown at its top. */
export const UPDATED = '2026-10-24'

/**
 * Who publishes the site and directs its publication. Affiliate links (features/product/shops.ts)
 * make the site a paid activity: the law then asks for a name, an address and a phone number
 * (LCEN, art. 1-1, I), and the registration number when there is one (SIREN). `null` is for a
 * site that earns nothing, whose private publisher may leave it to the host (art. 1-1, II).
 */
export const PUBLISHER: {
  name: string
  address: string
  phone: string
  registration?: string
} | null = {
  name: 'Eddy Despagne',
  address: '821 route de Saint-Léon, 24110 Saint-Astier, France',
  phone: '+262 693 77 36 83',
}

/** Where to write: questions, corrections, requests about data. */
export const CONTACT = 'contact@shapepick.com'

/** The site's host, and the database's, as the law asks to name them (addresses from their sites). */
export const HOST = {
  name: 'Netlify, Inc.',
  address: '101 2nd Street, San Francisco, CA 94105',
  url: 'https://www.netlify.com',
}
export const DATABASE = {
  name: 'Neon (Databricks, Inc.)',
  address: '160 Spear Street, San Francisco, CA 94105',
  url: 'https://neon.com',
}

/** How long our own click log is kept, in months. */
export const KEPT = { clicks: 25 }

const copy = {
  updated: text('Version du', 'Updated'),
  back: text('Revenir au site', 'Back to the site'),
}

const day = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`))

/** The page's gutter, the site header's: clear of a phone's notch and rounded corners. */
const gutter = css({
  pl: { base: 'max(1rem, env(safe-area-inset-left))', md: 'max(2rem, env(safe-area-inset-left))' },
  pr: {
    base: 'max(1rem, env(safe-area-inset-right))',
    md: 'max(2rem, env(safe-area-inset-right))',
  },
})

/** A document's width: the sections' labels at the left, their text beside them. */
const column = css({ w: '100%', maxW: '72rem', mx: 'auto' })

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

/** The site header's two ends: the name back to the site, the page in the other language. */
function LegalHeader({ locale }: { locale: Locale }) {
  return (
    <header
      className={cx(
        gutter,
        css({
          boxSizing: 'content-box',
          h: '16',
          pt: 'env(safe-area-inset-top)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4',
        }),
      )}
    >
      <a
        href={`/${locale}`}
        className={css({ display: 'inline-flex', alignItems: 'center', gap: '2.5' })}
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
      <nav aria-label={m.language[locale]} className={css({ display: 'flex', gap: '1' })}>
        {locales.map((other) => (
          <a
            key={other}
            href={legalPaths[other]}
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

type Props = {
  locale: Locale
  title: string
  /** What the page is about, under its title, if it needs saying. */
  lead?: ReactNode
  /** The short version, as tags under the title. */
  facts: readonly string[]
  /** Its sections (`LegalSection`). */
  children: ReactNode
}

export function LegalPage({ locale, title, lead, facts, children }: Props) {
  // The root marks every page of a locale as held under the preloader, and only the locale's layout
  // lifts the hold: this page has neither, and nothing of it waits.
  useEffect(() => document.documentElement.removeAttribute('data-loading'), [])
  return (
    // A document, unlike the rest of the site: its text can be selected and copied.
    <div
      className={css({ userSelect: 'text', minH: '100dvh', display: 'flex', flexDir: 'column' })}
    >
      <LegalHeader locale={locale} />
      <main className={cx(gutter, css({ flex: '1' }))}>
        <div className={column}>
          <header
            className={css({
              display: 'grid',
              justifyItems: 'start',
              gap: { base: '4', md: '5' },
              pt: { base: '10', md: '16' },
              pb: { base: '10', md: '16' },
            })}
          >
            <p
              className={css({
                fontFamily: 'mono',
                fontSize: 'xs',
                color: 'ink.muted',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              })}
            >
              <span aria-hidden className={css({ color: 'signal' })}>
                ●
              </span>{' '}
              {copy.updated[locale]} <time dateTime={UPDATED}>{day(UPDATED, locale)}</time>
            </p>
            <h1
              className={css({
                maxW: '18ch',
                fontSize: {
                  base: 'clamp(2rem, 1.1rem + 4.2vw, 2.75rem)',
                  md: 'clamp(2.75rem, 1.4rem + 3.2vw, 4.25rem)',
                },
                fontWeight: '650',
                letterSpacing: '-0.035em',
                lineHeight: '1.04',
                textWrap: 'balance',
              })}
            >
              {title}
            </h1>
            {lead && (
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
            )}
            <ul className={css({ display: 'flex', flexWrap: 'wrap', gap: '2', mt: '1' })}>
              {facts.map((fact) => (
                <li
                  key={fact}
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2',
                    h: '7',
                    px: '3',
                    borderRadius: 'pill',
                    borderWidth: '1px',
                    borderColor: 'line',
                    bg: 'surface',
                    fontSize: 'xs',
                    color: 'ink.soft',
                    whiteSpace: 'nowrap',
                  })}
                >
                  <span
                    aria-hidden
                    className={css({ w: '1.5', h: '1.5', borderRadius: 'full', bg: 'ink' })}
                  />
                  {fact}
                </li>
              ))}
            </ul>
          </header>
          <div className={css({ borderBottomWidth: '1px', borderColor: 'line' })}>{children}</div>
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
          <span>
            {m.siteName[locale]} · {UPDATED.slice(0, 4)}
          </span>
          <a
            href={`/${locale}`}
            className={css({
              color: 'ink.muted',
              transition: 'color 160ms',
              _hover: { color: 'ink' },
            })}
          >
            ← {copy.back[locale]}
          </a>
        </div>
      </footer>
    </div>
  )
}

/** One part of the page: its number and title at the left (above it on a phone), its text. */
export function LegalSection({
  id,
  n,
  title,
  children,
}: {
  id: string
  n: number
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={css({
        display: 'grid',
        gridTemplateColumns: { base: 'minmax(0, 1fr)', md: '15rem minmax(0, 1fr)' },
        columnGap: '10',
        rowGap: '4',
        py: { base: '7', md: '9' },
        borderTopWidth: '1px',
        borderColor: 'line',
      })}
    >
      <h2
        id={`${id}-title`}
        className={css({
          display: 'flex',
          alignItems: 'baseline',
          gap: '3',
          fontSize: { base: 'lg', md: 'xl' },
          fontWeight: '600',
          letterSpacing: '-0.02em',
          lineHeight: '1.2',
        })}
      >
        <span
          className={css({
            fontFamily: 'mono',
            fontSize: 'xs',
            fontWeight: '400',
            letterSpacing: '0',
            color: 'ink.faint',
            fontVariantNumeric: 'tabular-nums',
          })}
        >
          {String(n).padStart(2, '0')}
        </span>
        {title}
      </h2>
      <div
        className={css({
          display: 'grid',
          alignContent: 'start',
          gap: '4',
          maxW: '42rem',
          fontSize: { base: '0.9375rem', md: 'md' },
          lineHeight: '1.6',
          color: 'ink.soft',
          textWrap: 'pretty',
          '& a': {
            color: 'ink',
            textDecoration: 'underline',
            textDecorationColor: 'token(colors.line.strong)',
            textUnderlineOffset: '3px',
            transition: 'text-decoration-color 160ms',
            _hover: { textDecorationColor: 'ink' },
          },
          '& strong': { color: 'ink', fontWeight: '600' },
        })}
      >
        {children}
      </div>
    </section>
  )
}

/** What a section states, label and value, as a product's spec sheet lists them. */
export function LegalFacts({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    // Closed by a rule of its own only when text follows: at the end of a section, the next
    // section's rule closes it.
    <dl
      className={css({
        display: 'grid',
        '&:not(:last-child) > :last-child': { borderBottomWidth: '1px' },
      })}
    >
      {rows.map(([label, value]) => (
        <div
          key={label}
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: 'minmax(0, 1fr)', sm: '9.5rem minmax(0, 1fr)' },
            columnGap: '4',
            rowGap: '1',
            alignItems: 'baseline',
            py: '2.5',
            borderTopWidth: '1px',
            borderColor: 'line',
          })}
        >
          <dt
            className={css({
              fontFamily: 'mono',
              fontSize: '2xs',
              color: 'ink.faint',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            })}
          >
            {label}
          </dt>
          <dd className={css({ fontSize: 'sm', lineHeight: '1.5', color: 'ink' })}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
