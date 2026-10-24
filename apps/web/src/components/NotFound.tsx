import { Link } from '@tanstack/react-router'
import { css } from 'styled-system/css'
import { SITE } from '~/site'

export function NotFound() {
  return (
    <main className={css({ minH: '100dvh', display: 'grid', placeItems: 'center', p: '6' })}>
      <div className={css({ textAlign: 'center' })}>
        <p className={css({ fontFamily: 'mono', fontSize: 'display', lineHeight: '1' })}>404</p>
        <Link to="/" className={css({ textDecoration: 'underline', textUnderlineOffset: '4px' })}>
          {SITE.name}
        </Link>
      </div>
    </main>
  )
}
