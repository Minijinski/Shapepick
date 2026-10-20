import { type Category, categoryFromSlug, categorySlugs, locales } from '@choose/catalog'
import { Link, useLocation, useParams } from '@tanstack/react-router'
import type { MouseEvent } from 'react'
import { css, cx } from 'styled-system/css'
import { isPlainClick, useSceneNavigation } from '~/features/scene/navigation'
import { useLocale } from '~/i18n/locale'
import { messages as m } from '~/i18n/messages'

const categoryList: Category[] = ['keyboard', 'monitor']

const link = css({
  fontSize: 'sm',
  color: 'ink.muted',
  px: '3',
  h: '8',
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 'full',
  transition: 'color 160ms, background 160ms',
  _hover: { color: 'ink' },
  '&[data-status=active]': {
    color: 'ink',
    bg: 'surface.raised',
    boxShadow: '0 0 0 1px token(colors.line)',
  },
})

export function SiteHeader() {
  const locale = useLocale()
  const params = useParams({ strict: false }) as { category?: string }
  const { searchStr } = useLocation()
  const current = params.category ? categoryFromSlug(params.category, locale) : null
  // Plain clicks go through the scene (the panel opens or folds back); modified clicks stay links.
  const sceneTo = useSceneNavigation()
  const via = (category: Category | null) => (e: MouseEvent) => {
    if (!isPlainClick(e)) return
    e.preventDefault()
    sceneTo(category)
  }

  return (
    <header
      className={css({
        position: 'fixed',
        insetInline: '0',
        top: '0',
        zIndex: '20',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '4',
        h: '16',
        px: { base: '4', md: '8' },
        pointerEvents: 'none',
        '& > *': { pointerEvents: 'auto' },
      })}
    >
      <Link
        to="/$lang"
        params={{ lang: locale }}
        onClick={via(null)}
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
      </Link>

      <nav className={css({ display: { base: 'none', sm: 'flex' }, gap: '1' })}>
        {categoryList.map((category) => (
          <Link
            key={category}
            to="/$lang/$category"
            params={{ lang: locale, category: categorySlugs[category][locale] }}
            onClick={via(category)}
            className={link}
          >
            {m.category[category][locale]}
          </Link>
        ))}
      </nav>

      <nav
        aria-label={m.language[locale]}
        className={css({ justifySelf: 'end', display: 'flex', gap: '1' })}
      >
        {locales.map((other) => (
          <a
            key={other}
            href={current ? `/${other}/${categorySlugs[current][other]}${searchStr}` : `/${other}`}
            hrefLang={other}
            data-status={other === locale ? 'active' : undefined}
            className={cx(
              link,
              css({ fontFamily: 'mono', textTransform: 'uppercase', fontSize: 'xs' }),
            )}
          >
            {other}
          </a>
        ))}
      </nav>
    </header>
  )
}
