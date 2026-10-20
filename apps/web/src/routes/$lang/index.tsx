import { type Category, categories, categorySlugs, type Locale } from '@choose/catalog'
import { createFileRoute, getRouteApi, Link } from '@tanstack/react-router'
import { type CSSProperties, type MouseEvent, useEffect, useMemo, useRef } from 'react'
import { css, cx } from 'styled-system/css'
import { gsap, prefersReducedMotion } from '~/features/motion/gsap'
import { scene } from '~/features/scene/controller'
import {
  bandQuads,
  clipPathOf,
  edgeAt,
  frameOf,
  type Quad,
  type Viewport,
} from '~/features/scene/geometry'
import {
  isPlainClick,
  useEnterDelay,
  usePageExit,
  useSceneNavigation,
  useViewport,
} from '~/features/scene/navigation'
import { messages as m } from '~/i18n/messages'

// The home page: the scene draws one tilted panel per category behind a single line of copy.
// Each panel is a link laid over its drawing with the same shape, so hover, focus, a click and a
// middle click all behave like the link they are. Picking a panel opens it over the others into
// that category's canvas.

export const Route = createFileRoute('/$lang/')({
  head: ({ params }) => {
    const lang = params.lang as Locale
    return {
      meta: [
        { title: `choose-a-device · ${m.homeKicker[lang]}` },
        { name: 'description', content: m.homeLead[lang] },
      ],
      links: [
        { rel: 'canonical', href: `/${lang}` },
        { rel: 'alternate', hrefLang: 'fr', href: '/fr' },
        { rel: 'alternate', hrefLang: 'en', href: '/en' },
      ],
    }
  },
  component: Home,
})

const layout = getRouteApi('/$lang')

const word = css({
  display: 'inline-block',
  animation: 'wordUp 1s token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
})
const fade = css({
  animation: 'fadeUp 0.9s token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
})

function Home() {
  const { catalogs } = layout.useLoaderData()
  const locale = Route.useParams().lang as Locale
  const viewport = useViewport()
  const quads = useMemo(
    () => (viewport ? bandQuads(viewport, categories.length) : null),
    [viewport],
  )
  const open = useSceneNavigation()
  const root = useRef<HTMLElement>(null)
  const opening = useRef(false)
  // Back from a category, the copy comes in while the panel is still settling into its slot.
  const delay = useEnterDelay({ mode: 'bands' }, 0.55, 0.15)

  useEffect(() => {
    scene.showBands()
    // A pointer already resting on a panel when the scene settles (back from a category) never
    // sends an enter event: hand it over now.
    return scene.whenSettled(() => {
      const hovered = root.current?.querySelector<HTMLElement>('[data-band]:hover')
      if (hovered) scene.hoverBand(hovered.dataset.band as Category)
    })
  }, [])

  usePageExit(
    () =>
      new Promise<void>((resolve) => {
        const el = root.current
        if (!el || prefersReducedMotion()) return resolve()
        const words = el.querySelectorAll('[data-word]')
        const fades = el.querySelectorAll('[data-fade]')
        gsap.set([...words, ...fades], { animation: 'none' })
        gsap
          .timeline({ onComplete: resolve, defaults: { ease: 'power3.in' } })
          .to(words, { yPercent: -110, duration: 0.42, stagger: 0.018 }, 0)
          .to(fades, { opacity: 0, y: -10, duration: 0.3 }, 0)
          .to(el.querySelectorAll('[data-band-label]'), { opacity: 0, duration: 0.22 }, 0)
      }),
  )

  const pick = (category: Category, e: MouseEvent) => {
    if (!isPlainClick(e)) return
    e.preventDefault()
    if (opening.current) return
    opening.current = true
    // A keyboard "click" has no position: the panel then opens from its centre.
    open(category, e.detail === 0 ? undefined : { x: e.clientX, y: e.clientY })
  }

  let index = 0
  const lines = m.homeTitle[locale].split('\n')

  return (
    <main
      ref={root}
      className={css({ position: 'relative', h: '100dvh', minH: '520px', overflow: 'hidden' })}
    >
      <nav aria-label={m.worlds[locale]} className={css({ position: 'absolute', inset: '0' })}>
        {categories.map((category, i) => (
          <BandLink
            key={category}
            category={category}
            index={i}
            quad={quads?.[i] ?? null}
            viewport={viewport}
            count={catalogs[category].length}
            locale={locale}
            onPick={pick}
          />
        ))}
      </nav>

      <div
        className={css({
          position: 'absolute',
          inset: '0',
          display: 'grid',
          placeItems: 'center',
          px: '6',
          pointerEvents: 'none',
        })}
      >
        <div
          className={css({
            position: 'relative',
            display: 'grid',
            justifyItems: 'center',
            gap: { base: '4', md: '5' },
            textAlign: 'center',
            maxW: '5xl',
            // Its own stacking context, so the halo below stays above the canvas.
            isolation: 'isolate',
          })}
        >
          {/* A frosted paper halo keeps the line legible over the products drifting behind it. */}
          <span
            data-fade
            aria-hidden
            className={cx(
              fade,
              css({
                position: 'absolute',
                inset: '-34% -18%',
                zIndex: '-1',
                background:
                  'radial-gradient(closest-side, rgba(243,241,236,0.9), rgba(243,241,236,0.72) 58%, rgba(243,241,236,0))',
                backdropFilter: 'blur(8px)',
                maskImage: 'radial-gradient(closest-side, #000 62%, transparent)',
                WebkitMaskImage: 'radial-gradient(closest-side, #000 62%, transparent)',
              }),
            )}
            style={{ animationDelay: `${delay}s` }}
          />
          <p
            data-fade
            className={cx(
              fade,
              css({
                fontFamily: 'mono',
                fontSize: 'xs',
                color: 'ink.muted',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }),
            )}
            style={{ animationDelay: `${delay}s` }}
          >
            <span className={css({ color: 'signal' })}>●</span> {m.homeKicker[locale]}
          </p>
          <h1
            className={css({
              fontSize: 'display',
              fontWeight: '650',
              letterSpacing: '-0.055em',
              lineHeight: '0.95',
            })}
          >
            {lines.map((line, l) => (
              <span key={line} className={css({ display: 'block' })}>
                {l > 0 && ' '}
                {line.split(' ').map((w, j) => {
                  const i = index++
                  return (
                    <span key={`${w}-${i}`}>
                      {j > 0 && ' '}
                      <span
                        className={css({
                          display: 'inline-block',
                          overflow: 'hidden',
                          verticalAlign: 'top',
                          pb: '0.08em',
                          mb: '-0.08em',
                        })}
                      >
                        <span
                          data-word
                          className={word}
                          style={{ animationDelay: `${delay + 0.08 + i * 0.05}s` }}
                        >
                          {w}
                        </span>
                      </span>
                    </span>
                  )
                })}
              </span>
            ))}
          </h1>
          <p
            data-fade
            className={cx(
              fade,
              css({
                fontSize: { base: 'md', md: 'lg' },
                color: 'ink.muted',
                maxW: '34rem',
                lineHeight: '1.5',
              }),
            )}
            style={{ animationDelay: `${delay + 0.45}s` }}
          >
            {m.homeSub[locale]}
          </p>
          <p
            data-fade
            className={cx(fade, css({ fontFamily: 'mono', fontSize: '2xs', color: 'ink.faint' }))}
            style={{ animationDelay: `${delay + 0.6}s` }}
          >
            {m.demoData[locale]}
          </p>
        </div>
      </div>
    </main>
  )
}

// ---- One panel ----------------------------------------------------------------------------------

const label = css({
  position: 'absolute',
  display: 'grid',
  gap: '1.5',
  w: 'max-content',
  maxW: '30rem',
  pointerEvents: 'none',
  '& > *': { ml: 'calc(var(--rise) * var(--slope))' },
})
// Revealed by hovering or focusing the panel; always shown where there is no hover.
const reveal = css({
  transition: 'transform 700ms token(easings.signal), opacity 500ms',
  '@media (hover: hover)': {
    _groupHover: { transform: 'translateY(0)', opacity: 1 },
    _groupFocusVisible: { transform: 'translateY(0)', opacity: 1 },
  },
  '@media (hover: none)': { transform: 'translateY(0)', opacity: 1 },
})

function BandLink({
  category,
  index,
  quad,
  viewport,
  count,
  locale,
  onPick,
}: {
  category: Category
  index: number
  quad: Quad | null
  viewport: Viewport | null
  count: number
  locale: Locale
  onPick: (category: Category, e: MouseEvent) => void
}) {
  // Before the viewport is known (server, hydration) the panels are plain columns.
  const linkStyle: CSSProperties = quad
    ? { clipPath: clipPathOf(quad) }
    : {
        left: `${(index / categories.length) * 100}%`,
        right: 'auto',
        width: `${100 / categories.length}%`,
      }
  let labelStyle: CSSProperties = { left: 24, bottom: 24 }
  if (quad && viewport) {
    const pad = frameOf(viewport).gutter + 18
    const bottom = quad[3].y - pad
    labelStyle = {
      left: edgeAt(quad, 'left', bottom) + pad,
      bottom: viewport.h - bottom,
      // The lines step along the panel's slanted edge.
      ['--slope' as string]: (quad[0].x - quad[3].x) / (quad[3].y - quad[0].y),
    }
  }

  return (
    <Link
      to="/$lang/$category"
      params={{ lang: locale, category: categorySlugs[category][locale] }}
      data-band={category}
      className={cx(
        'group',
        css({
          position: 'absolute',
          inset: '0',
          display: 'block',
          outline: 'none',
          WebkitTapHighlightColor: 'transparent',
        }),
      )}
      style={linkStyle}
      onPointerEnter={() => scene.hoverBand(category)}
      onPointerLeave={() => scene.hoverBand(null)}
      onFocus={() => scene.hoverBand(category)}
      onBlur={() => scene.hoverBand(null)}
      onClick={(e) => onPick(category, e)}
    >
      <span
        data-band-label
        className={label}
        style={{ '--slope': 0, ...labelStyle } as CSSProperties}
      >
        <span
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: { base: '2', md: '3' },
            fontFamily: 'mono',
            fontSize: { base: '2xs', md: 'xs' },
            color: 'ink.muted',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          })}
          style={{ '--rise': '96px' } as CSSProperties}
        >
          <span className={css({ color: 'signal' })}>{String(index + 1).padStart(2, '0')}</span>
          <span
            aria-hidden
            className={css({
              display: 'block',
              w: { base: '5', md: '16' },
              h: '1px',
              bg: 'ink',
              transformOrigin: 'left center',
              transform: 'scaleX(0.25)',
              transition: 'transform 700ms token(easings.signal)',
              '@media (hover: hover)': {
                _groupHover: { transform: 'scaleX(1)' },
                _groupFocusVisible: { transform: 'scaleX(1)' },
              },
              '@media (hover: none)': { transform: 'scaleX(1)' },
            })}
          />
          <span>
            {String(count).padStart(3, '0')} {m.models[locale]}
          </span>
        </span>
        <span
          className={css({ display: 'block', overflow: 'hidden', pb: '0.06em' })}
          style={{ '--rise': '40px' } as CSSProperties}
        >
          <span
            className={cx(
              reveal,
              css({
                display: 'block',
                fontSize: { base: '3xl', md: '5xl' },
                fontWeight: '650',
                letterSpacing: '-0.045em',
                lineHeight: '1',
                transform: 'translateY(105%)',
              }),
            )}
          >
            {m.category[category][locale]}
          </span>
        </span>
        <span
          className={cx(
            reveal,
            css({
              display: 'flex',
              alignItems: 'baseline',
              gap: '4',
              fontSize: 'sm',
              color: 'ink.muted',
              opacity: 0,
              transform: 'translateY(8px)',
              transitionDelay: '60ms',
            }),
          )}
          style={{ '--rise': '6px' } as CSSProperties}
        >
          <span className={css({ display: { base: 'none', md: 'inline' } })}>
            {m.categoryPitch[category][locale]}
          </span>
          <span className={css({ fontWeight: '600', color: 'ink' })}>{m.explore[locale]} →</span>
        </span>
      </span>
    </Link>
  )
}
