import type { CatalogItem, Locale, Ranked } from '@choose/catalog'
import { useRef } from 'react'
import { css } from 'styled-system/css'
import { button } from 'styled-system/recipes'
import { messages as m } from '~/i18n/messages'
import { gsap, prefersReducedMotion, useGSAP } from '../motion/gsap'
import { motion } from '../motion/tokens'
import { ProductGlyph } from '../product/glyphs'
import { formatPrice, keySpecs } from '../product/specs'

// The end of the questionnaire: the best match annotated like a spec drawing, the next two beside
// it, every other match in a list below. Leader lines draw themselves in when the view opens.

type Props = {
  ranked: Ranked<CatalogItem>[]
  locale: Locale
  onEdit: () => void
  onReset: () => void
}

const Match = ({ score, locale }: { score: number; locale: Locale }) => (
  <span
    className={css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2',
      fontFamily: 'mono',
      fontSize: 'xs',
      color: 'ink.muted',
    })}
  >
    <span
      className={css({
        position: 'relative',
        w: '12',
        h: '1',
        bg: 'line',
        borderRadius: 'full',
        overflow: 'hidden',
      })}
    >
      <span
        className={css({
          position: 'absolute',
          insetBlock: '0',
          left: '0',
          bg: 'ink',
          borderRadius: 'full',
        })}
        style={{ width: `${Math.round(score * 100)}%` }}
      />
    </span>
    {Math.round(score * 100)}% {m.match[locale]}
  </span>
)

function AnnotatedHero({ entry, locale }: { entry: Ranked<CatalogItem>; locale: Locale }) {
  const specs = keySpecs(entry.item, locale)
  // Anchor points on the drawing (in % of its box) and the side their callout sits on.
  const anchors = [
    { x: 24, y: 30, side: 'left' },
    { x: 34, y: 74, side: 'left' },
    { x: 76, y: 26, side: 'right' },
    { x: 66, y: 70, side: 'right' },
  ] as const
  const callout = (side: 'left' | 'right') =>
    specs.map((spec, i) => {
      const a = anchors[i]
      if (!a || a.side !== side) return null
      return (
        <figcaption
          key={spec.label}
          data-callout
          className={css({
            position: 'absolute',
            insetInline: '0',
            display: 'grid',
            gap: '0.5',
            fontSize: 'sm',
            transform: 'translateY(-100%)',
            pb: '1.5',
          })}
          style={{ top: `${a.y - 8}%`, textAlign: side === 'left' ? 'left' : 'right' }}
        >
          <span
            className={css({
              fontFamily: 'mono',
              fontSize: '2xs',
              color: 'ink.faint',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            })}
          >
            {spec.label}
          </span>
          <span className={css({ fontWeight: '600', lineHeight: '1.25' })}>{spec.value}</span>
        </figcaption>
      )
    })
  const column = css({ position: 'relative', display: { base: 'none', md: 'block' } })

  return (
    <div className={css({ display: 'grid', gap: '4' })}>
      <figure
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', md: '11rem 1fr 11rem' },
          h: { base: '44', md: '64' },
        })}
      >
        <div className={column}>{callout('left')}</div>
        <div className={css({ position: 'relative' })}>
          <div
            className={css({
              position: 'absolute',
              inset: '0',
              display: 'grid',
              placeItems: 'center',
              p: '4',
            })}
          >
            <ProductGlyph item={entry.item} className={css({ w: '100%', h: '100%' })} />
          </div>
          {/* Percent coordinates without a viewBox keep the strokes one pixel wide at any size. */}
          <svg
            className={css({
              position: 'absolute',
              inset: '0',
              w: '100%',
              h: '100%',
              overflow: 'visible',
              display: { base: 'none', md: 'block' },
            })}
            aria-hidden
          >
            {specs.map((spec, i) => {
              const a = anchors[i]
              if (!a) return null
              const elbow = a.side === 'left' ? a.x - 6 : a.x + 6
              const edge = a.side === 'left' ? 0 : 100
              return (
                <g key={spec.label} stroke="#141414" strokeWidth={1}>
                  <line
                    data-leader
                    pathLength={1}
                    strokeDasharray={1}
                    x1={`${a.x}%`}
                    y1={`${a.y}%`}
                    x2={`${elbow}%`}
                    y2={`${a.y - 8}%`}
                  />
                  <line
                    data-leader
                    pathLength={1}
                    strokeDasharray={1}
                    x1={`${elbow}%`}
                    y1={`${a.y - 8}%`}
                    x2={`${edge}%`}
                    y2={`${a.y - 8}%`}
                  />
                </g>
              )
            })}
          </svg>
          {specs.map((spec, i) => {
            const a = anchors[i]
            return a ? (
              <span
                key={spec.label}
                data-leader-dot
                className={css({
                  position: 'absolute',
                  w: '2',
                  h: '2',
                  ml: '-1',
                  mt: '-1',
                  borderRadius: 'full',
                  bg: 'signal',
                  display: { base: 'none', md: 'block' },
                })}
                style={{ left: `${a.x}%`, top: `${a.y}%` }}
              />
            ) : null
          })}
        </div>
        <div className={column}>{callout('right')}</div>
      </figure>
      <dl
        className={css({
          display: { base: 'grid', md: 'none' },
          gridTemplateColumns: 'auto 1fr',
          columnGap: '3',
          rowGap: '1',
          fontSize: 'sm',
        })}
      >
        {specs.map((s) => (
          <div key={s.label} className={css({ display: 'contents' })}>
            <dt className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'ink.faint' })}>
              {s.label}
            </dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function ResultsView({ ranked, locale, onEdit, onReset }: Props) {
  const root = useRef<HTMLElement>(null)
  const [first, ...others] = ranked
  const runnersUp = others.slice(0, 2)
  const rest = others.slice(2)

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const tl = gsap.timeline({ defaults: { ease: motion.ease } })
      tl.from(root.current, { yPercent: 18, opacity: 0, duration: motion.slow })
      tl.from('[data-leader-dot]', { scale: 0, duration: motion.base, stagger: 0.08 }, '-=0.4')
      tl.from(
        '[data-leader]',
        { attr: { 'stroke-dashoffset': 1 }, duration: motion.base, ease: 'none', stagger: 0.12 },
        '<0.1',
      )
      tl.from('[data-callout]', { opacity: 0, y: 6, duration: motion.base, stagger: 0.08 }, '<0.2')
      tl.from('[data-result]', { opacity: 0, y: 12, duration: motion.base, stagger: 0.04 }, '<0.1')
    },
    { scope: root },
  )

  return (
    <section
      ref={root}
      aria-labelledby="results-title"
      className={css({
        bg: 'surface.raised',
        borderRadius: 'xl',
        borderWidth: '1px',
        borderColor: 'line',
        boxShadow: 'panel',
        maxH: 'calc(100dvh - 230px)',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      })}
    >
      <header
        className={css({
          position: 'sticky',
          top: '0',
          zIndex: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '3',
          px: { base: '4', md: '6' },
          py: '4',
          bg: 'surface.raised/90',
          backdropFilter: 'blur(10px)',
          borderBottomWidth: '1px',
          borderColor: 'line',
        })}
      >
        <h2
          id="results-title"
          className={css({
            fontSize: { base: 'xl', md: '2xl' },
            fontWeight: '600',
            letterSpacing: '-0.03em',
          })}
        >
          {m.resultsTitle[locale]}
        </h2>
        <div className={css({ display: 'flex', gap: '2' })}>
          <button type="button" className={button({ tone: 'line', size: 'sm' })} onClick={onEdit}>
            {m.editAnswers[locale]}
          </button>
          <button type="button" className={button({ tone: 'ghost', size: 'sm' })} onClick={onReset}>
            {m.reset[locale]}
          </button>
        </div>
      </header>

      {!first ? (
        <p className={css({ p: '8', color: 'ink.muted' })}>{m.resultsEmpty[locale]}</p>
      ) : (
        <div className={css({ p: { base: '4', md: '6' }, display: 'grid', gap: '8' })}>
          <article className={css({ display: 'grid', gap: '4' })}>
            <div
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '3',
              })}
            >
              <div>
                <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'signal' })}>
                  01
                </span>
                <h3
                  className={css({
                    fontSize: { base: '2xl', md: '4xl' },
                    fontWeight: '650',
                    letterSpacing: '-0.04em',
                    lineHeight: '1',
                  })}
                >
                  <span className={css({ color: 'ink.muted', fontWeight: '500' })}>
                    {first.item.brand.name}
                  </span>{' '}
                  {first.item.name}
                </h3>
                {first.item.tagline && (
                  <p className={css({ mt: '2', color: 'ink.muted' })}>
                    {first.item.tagline[locale]}
                  </p>
                )}
              </div>
              <div className={css({ display: 'grid', justifyItems: 'end', gap: '1' })}>
                <span className={css({ fontFamily: 'mono', fontSize: '2xl' })}>
                  {formatPrice(first.item.priceEur, locale)}
                </span>
                <Match score={first.score} locale={locale} />
              </div>
            </div>
            <AnnotatedHero entry={first} locale={locale} />
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: { base: '1fr', md: '1fr 1fr' },
                gap: '4',
              })}
            >
              {first.pros.length > 0 && (
                <div>
                  <h4
                    className={css({
                      fontFamily: 'mono',
                      fontSize: '2xs',
                      color: 'ink.faint',
                      textTransform: 'uppercase',
                      mb: '2',
                    })}
                  >
                    {m.strengths[locale]}
                  </h4>
                  <ul className={css({ display: 'grid', gap: '1', fontSize: 'sm' })}>
                    {first.pros.map((p) => (
                      <li key={p.en}>+ {p[locale]}</li>
                    ))}
                  </ul>
                </div>
              )}
              {first.cons.length > 0 && (
                <div>
                  <h4
                    className={css({
                      fontFamily: 'mono',
                      fontSize: '2xs',
                      color: 'ink.faint',
                      textTransform: 'uppercase',
                      mb: '2',
                    })}
                  >
                    {m.caveats[locale]}
                  </h4>
                  <ul
                    className={css({
                      display: 'grid',
                      gap: '1',
                      fontSize: 'sm',
                      color: 'ink.muted',
                    })}
                  >
                    {first.cons.map((c) => (
                      <li key={c.en}>– {c[locale]}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </article>

          {runnersUp.length > 0 && (
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: { base: '1fr', md: '1fr 1fr' },
                gap: '3',
              })}
            >
              {runnersUp.map((entry, i) => (
                <article
                  key={entry.item.slug}
                  data-result
                  className={css({
                    display: 'grid',
                    gap: '3',
                    p: '4',
                    borderRadius: 'lg',
                    borderWidth: '1px',
                    borderColor: 'line',
                    bg: 'surface',
                  })}
                >
                  <div
                    className={css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: 'mono',
                      fontSize: 'xs',
                      color: 'ink.faint',
                    })}
                  >
                    <span>{String(i + 2).padStart(2, '0')}</span>
                    <Match score={entry.score} locale={locale} />
                  </div>
                  <div className={css({ h: '24', display: 'grid', placeItems: 'center' })}>
                    <ProductGlyph
                      item={entry.item}
                      className={css({ maxH: '24', w: '80%', h: 'auto' })}
                    />
                  </div>
                  <div
                    className={css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '3',
                    })}
                  >
                    <h3 className={css({ fontWeight: '600', letterSpacing: '-0.02em' })}>
                      <span className={css({ color: 'ink.muted', fontWeight: '500' })}>
                        {entry.item.brand.name}
                      </span>{' '}
                      {entry.item.name}
                    </h3>
                    <span className={css({ fontFamily: 'mono', fontSize: 'sm' })}>
                      {formatPrice(entry.item.priceEur, locale)}
                    </span>
                  </div>
                  <dl
                    className={css({
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      columnGap: '3',
                      rowGap: '1',
                      fontSize: 'xs',
                    })}
                  >
                    {keySpecs(entry.item, locale).map((s) => (
                      <div key={s.label} className={css({ display: 'contents' })}>
                        <dt className={css({ fontFamily: 'mono', color: 'ink.faint' })}>
                          {s.label}
                        </dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className={css({ display: 'grid', gap: '2' })}>
              <h4
                className={css({
                  fontFamily: 'mono',
                  fontSize: '2xs',
                  color: 'ink.faint',
                  textTransform: 'uppercase',
                })}
              >
                {m.allResults[locale]} · {rest.length}
              </h4>
              <ol className={css({ display: 'grid' })}>
                {rest.map((entry, i) => (
                  <li
                    key={entry.item.slug}
                    data-result
                    className={css({
                      display: 'grid',
                      gridTemplateColumns: {
                        base: '28px 56px 1fr auto',
                        md: '28px 72px 1.2fr 2fr auto',
                      },
                      alignItems: 'center',
                      gap: '3',
                      py: '3',
                      borderTopWidth: '1px',
                      borderColor: 'line',
                    })}
                  >
                    <span
                      className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'ink.faint' })}
                    >
                      {String(i + 4).padStart(2, '0')}
                    </span>
                    <ProductGlyph
                      item={entry.item}
                      className={css({ h: '8', w: 'auto', maxW: '72px' })}
                    />
                    <span className={css({ fontWeight: '600', fontSize: 'sm' })}>
                      <span className={css({ color: 'ink.muted', fontWeight: '500' })}>
                        {entry.item.brand.name}
                      </span>{' '}
                      {entry.item.name}
                    </span>
                    <span
                      className={css({
                        display: { base: 'none', md: 'block' },
                        fontSize: 'xs',
                        color: 'ink.muted',
                        truncate: true,
                      })}
                    >
                      {keySpecs(entry.item, locale)
                        .map((s) => s.value)
                        .join(' · ')}
                    </span>
                    <span className={css({ display: 'grid', justifyItems: 'end', gap: '0.5' })}>
                      <span className={css({ fontFamily: 'mono', fontSize: 'sm' })}>
                        {formatPrice(entry.item.priceEur, locale)}
                      </span>
                      <span
                        className={css({ fontFamily: 'mono', fontSize: '2xs', color: 'ink.faint' })}
                      >
                        {Math.round(entry.score * 100)}%
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
