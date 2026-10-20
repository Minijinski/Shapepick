import type { Locale } from '@choose/catalog'
import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { css, cx } from 'styled-system/css'
import { button } from 'styled-system/recipes'
import { messages as m } from '~/i18n/messages'
import { gsap, prefersReducedMotion } from '../motion/gsap'
import { AnnotatedHero } from '../product/AnnotatedHero'
import { Match } from '../product/Match'
import { MatchBreakdown } from '../product/MatchBreakdown'
import { formatPrice, sheetSpecs } from '../product/specs'
import type { ProductSheet } from './useFinder'

// One product's sheet, opened from wherever a product shows: the canvas, the podium, the results.
// It reads like the results' best match (annotated drawing, strengths, caveats), says what its match
// is made of, adds the full spec sheet, and ends where buying will happen. A side panel on wide screens, a bottom sheet on
// phones; Escape, the backdrop and the close button fold it away, the arrows step through the
// ranking.

type Props = {
  sheet: ProductSheet
  /** The use the visitor picked, which the match is measured against. */
  use: string | null
  locale: Locale
  /** Place among the kept products, for stepping through them; null for a ruled-out product. */
  position: { index: number; total: number } | null
  onStep: (delta: -1 | 1) => void
  onClose: () => void
}

const sectionLabel = css({
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

const iconButton = cx(button({ tone: 'ghost', size: 'icon' }), css({ color: 'ink.muted' }))

const Icon = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
)

export function ProductDrawer({ sheet, use, locale, position, onStep, onClose }: Props) {
  const panel = useRef<HTMLElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const { item } = sheet

  /** Plays the sheet out, then closes it. A timer backs the animation up in a hidden tab. */
  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    const el = panel.current
    if (!el || prefersReducedMotion() || document.hidden) return onClose()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onClose()
    }
    const wide = window.matchMedia('(min-width: 48rem)').matches
    gsap.set([el, backdrop.current], { animation: 'none' })
    gsap.to(el, {
      ...(wide ? { x: 48 } : { y: 80 }),
      opacity: 0,
      duration: 0.28,
      ease: 'power3.in',
      onComplete: finish,
    })
    gsap.to(backdrop.current, { opacity: 0, duration: 0.28 })
    window.setTimeout(finish, 480)
  }, [onClose])

  // Focus moves into the sheet and back to whatever had it once the sheet closes.
  useEffect(() => {
    const previous = document.activeElement
    panel.current?.focus({ preventScroll: true })
    return () => {
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (position && e.key === 'ArrowLeft') onStep(-1)
      else if (position && e.key === 'ArrowRight') onStep(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, onStep, position])

  // A new product starts at the top of the sheet.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the slug is the trigger
  useEffect(() => {
    panel.current?.querySelector('[data-sheet-scroll]')?.scrollTo({ top: 0 })
  }, [item.slug])

  if (typeof document === 'undefined') return null
  const kept = sheet.rank != null

  return createPortal(
    <>
      <div
        ref={backdrop}
        aria-hidden
        onClick={close}
        className={css({
          position: 'fixed',
          inset: '0',
          zIndex: '40',
          bg: 'rgba(243, 241, 236, 0.55)',
          backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.3s ease backwards',
          _motionReduce: { animation: 'none' },
        })}
      />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        className={css({
          position: 'fixed',
          zIndex: '41',
          left: { base: '2', md: 'auto' },
          right: { base: '2', md: '3' },
          top: { base: 'auto', md: '3' },
          bottom: { base: '2', md: '3' },
          w: { md: 'min(34rem, calc(100vw - 1.5rem))' },
          maxH: { base: '88dvh', md: 'none' },
          display: 'flex',
          flexDirection: 'column',
          bg: 'surface.raised',
          borderRadius: 'panel',
          borderWidth: '1px',
          borderColor: 'line',
          boxShadow: '0 1px 0 rgba(20,20,20,0.04), 0 40px 90px -30px rgba(20,20,20,0.4)',
          overflow: 'hidden',
          outline: 'none',
          animation: {
            base: 'sheetUp 0.5s token(easings.signal) backwards',
            md: 'sheetIn 0.55s token(easings.signal) backwards',
          },
          _motionReduce: { animation: 'none' },
        })}
      >
        <header
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            flexShrink: '0',
            h: '14',
            pl: '5',
            pr: '3',
            borderBottomWidth: '1px',
            borderColor: 'line',
          })}
        >
          <span
            className={cx(sectionLabel, css({ flex: '1', minW: '0', truncate: true }))}
            aria-live="polite"
          >
            {kept ? (
              <span className={css({ color: sheet.rank === 0 ? 'signal' : 'ink.muted' })}>
                {String((sheet.rank ?? 0) + 1).padStart(2, '0')}
              </span>
            ) : !sheet.ruledOut ? null : sheet.excludedBy ? (
              `${m.ruledOutBy[locale]} · ${sheet.excludedBy}`
            ) : (
              m.ruledOut[locale]
            )}
          </span>
          {position && (
            <span className={css({ display: 'flex', alignItems: 'center', gap: '1' })}>
              <button
                type="button"
                className={iconButton}
                aria-label={m.previous[locale]}
                disabled={position.index === 0}
                onClick={() => onStep(-1)}
              >
                <Icon d="M15 6l-6 6 6 6" />
              </button>
              <span
                className={css({
                  fontFamily: 'mono',
                  fontSize: 'xs',
                  color: 'ink.faint',
                  fontVariantNumeric: 'tabular-nums',
                })}
              >
                {String(position.index + 1).padStart(2, '0')} /{' '}
                {String(position.total).padStart(2, '0')}
              </span>
              <button
                type="button"
                className={iconButton}
                aria-label={m.next[locale]}
                disabled={position.index >= position.total - 1}
                onClick={() => onStep(1)}
              >
                <Icon d="M9 6l6 6-6 6" />
              </button>
            </span>
          )}
          <button type="button" className={iconButton} aria-label={m.close[locale]} onClick={close}>
            <Icon d="M6 6l12 12M18 6L6 18" />
          </button>
        </header>

        <div
          data-sheet-scroll
          className={css({
            flex: '1',
            minH: '0',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            scrollbarWidth: 'thin',
          })}
        >
          <div
            key={item.slug}
            className={css({
              display: 'grid',
              gap: '6',
              p: { base: '4', md: '5' },
              animation: 'fadeUp 0.45s token(easings.signal) backwards',
              _motionReduce: { animation: 'none' },
            })}
          >
            <div className={css({ display: 'grid', gap: '3' })}>
              <h2
                id="sheet-title"
                className={css({
                  fontSize: { base: '2xl', md: '3xl' },
                  fontWeight: '650',
                  letterSpacing: '-0.04em',
                  lineHeight: '1.05',
                })}
              >
                <span className={css({ color: 'ink.muted', fontWeight: '500' })}>
                  {item.brand.name}
                </span>{' '}
                {item.name}
              </h2>
              {item.tagline && (
                <p className={css({ color: 'ink.muted', lineHeight: '1.45' })}>
                  {item.tagline[locale]}
                </p>
              )}
              <div
                className={css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '3',
                })}
              >
                <span className={css({ display: 'grid', gap: '0.5' })}>
                  <span className={sectionLabel}>{m.listPrice[locale]}</span>
                  <span className={css({ fontFamily: 'mono', fontSize: '2xl', lineHeight: '1' })}>
                    {formatPrice(item.priceEur, locale)}
                  </span>
                </span>
                {sheet.score != null && (
                  <Match score={sheet.score} locale={locale} accent={sheet.rank === 0} />
                )}
              </div>
              {sheet.fit != null && sheet.met != null && (
                <MatchBreakdown fit={sheet.fit} met={sheet.met} use={use} locale={locale} />
              )}
            </div>

            {/* The drawing on the canvas's dotted paper. */}
            <div
              className={css({
                p: '4',
                borderRadius: 'card',
                borderWidth: '1px',
                borderColor: 'line',
                bg: 'paper',
                backgroundImage: 'radial-gradient(#CFCBC2 1.1px, transparent 1.3px)',
                backgroundSize: '14px 14px',
              })}
            >
              <AnnotatedHero item={item} locale={locale} />
            </div>

            {(sheet.pros.length > 0 || sheet.cons.length > 0) && (
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' },
                  gap: '4',
                })}
              >
                {sheet.pros.length > 0 && (
                  <div className={css({ display: 'grid', gap: '2', alignContent: 'start' })}>
                    <h3 className={sectionLabel}>{m.strengths[locale]}</h3>
                    <ul className={css({ display: 'grid', gap: '1', fontSize: 'sm' })}>
                      {sheet.pros.map((p) => (
                        <li key={p.en}>+ {p[locale]}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {sheet.cons.length > 0 && (
                  <div className={css({ display: 'grid', gap: '2', alignContent: 'start' })}>
                    <h3 className={sectionLabel}>{m.caveats[locale]}</h3>
                    <ul
                      className={css({
                        display: 'grid',
                        gap: '1',
                        fontSize: 'sm',
                        color: 'ink.muted',
                      })}
                    >
                      {sheet.cons.map((c) => (
                        <li key={c.en}>– {c[locale]}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <section className={css({ display: 'grid', gap: '2' })}>
              <h3 className={sectionLabel}>{m.specSheet[locale]}</h3>
              <dl className={css({ display: 'grid' })}>
                {sheetSpecs(item, locale).map((spec) => (
                  <div
                    key={spec.label}
                    className={css({
                      display: 'grid',
                      gridTemplateColumns: '7.5rem 1fr',
                      gap: '3',
                      alignItems: 'baseline',
                      py: '2',
                      borderTopWidth: '1px',
                      borderColor: 'line',
                    })}
                  >
                    <dt className={sectionLabel}>{spec.label}</dt>
                    <dd className={css({ fontSize: 'sm', lineHeight: '1.4' })}>{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Where shop offers (and affiliate links) will go once prices are collected. */}
            <section className={css({ display: 'grid', gap: '2' })}>
              <h3 className={sectionLabel}>{m.whereToBuy[locale]}</h3>
              <p
                className={css({
                  p: '4',
                  borderRadius: 'card',
                  borderWidth: '1px',
                  borderStyle: 'dashed',
                  borderColor: 'line.strong',
                  fontSize: 'sm',
                  color: 'ink.muted',
                  lineHeight: '1.5',
                })}
              >
                {m.offersSoon[locale]}
              </p>
            </section>
          </div>
        </div>
      </aside>
    </>,
    document.body,
  )
}
