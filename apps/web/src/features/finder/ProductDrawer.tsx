import type { Locale } from '@choose/catalog'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { css, cx } from 'styled-system/css'
import { button } from 'styled-system/recipes'
import { messages as m } from '~/i18n/messages'
import { gsap, prefersReducedMotion } from '../motion/gsap'
import { AmazonLink } from '../product/AmazonLink'
import { KeyFigures } from '../product/KeyFigures'
import { MatchBreakdown } from '../product/MatchBreakdown'
import { ProductHero } from '../product/ProductHero'
import { amazonLink } from '../product/shops'
import { formatPrice, sheetSpecs } from '../product/specs'
import type { ProductSheet } from './useFinder'

// One product's sheet, opened from wherever a product shows: the canvas, the podium, the results.
// It reads like the results' best match (the product and its key specs, strengths, caveats), says
// what its match is made of and adds the full spec sheet. Where to buy it sits on the line of its
// price, and once that line has scrolled away a bar slides up at the foot of the sheet with the
// price and the shop again. A side panel on wide screens, a bottom sheet on phones; Escape, the
// backdrop and the close button fold it away, the arrows step through the ranking. Its text can be
// selected and copied (a name, a spec), unlike the rest of the site, where a press and drag
// browses the canvas.

type Props = {
  sheet: ProductSheet
  /** The use the visitor picked, which the match is measured against. */
  use: string | null
  /** The visitor's layout answer (azerty, ansi, iso), which the shop search follows. */
  layouts?: readonly string[]
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

/** The price and the shop again, at the foot of the sheet once the line of the price is gone. */
const buyBar = css({
  position: 'absolute',
  insetInline: '0',
  bottom: '0',
  zIndex: '1',
  display: 'flex',
  alignItems: 'center',
  gap: '3',
  minH: '18',
  px: { base: '4', md: '5' },
  py: '2.5',
  bg: 'surface.raised/90',
  backdropFilter: 'blur(12px)',
  borderTopWidth: '1px',
  borderColor: 'line',
  opacity: 0,
  transform: 'translateY(100%)',
  transition: 'transform 420ms token(easings.signal), opacity 260ms',
  '&[data-shown]': { opacity: 1, transform: 'translateY(0)' },
  _motionReduce: { transition: 'none' },
})

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

export function ProductDrawer({ sheet, use, layouts, locale, position, onStep, onClose }: Props) {
  const panel = useRef<HTMLElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const figures = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const { item } = sheet
  const amazon = amazonLink(item, locale, layouts)
  const [barShown, setBarShown] = useState(false)

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

  // The buying bar shows while the line of the price is scrolled away above the sheet's top (not
  // before the sheet has been scrolled: the line is in view then). Each product has its own line.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new product brings a new line
  useEffect(() => {
    const line = figures.current
    const scroller = panel.current?.querySelector('[data-sheet-scroll]')
    setBarShown(false)
    if (!line || !scroller) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        const top = entry.rootBounds?.top ?? 0
        setBarShown(!entry.isIntersecting && entry.boundingClientRect.top < top)
      },
      { root: scroller },
    )
    observer.observe(line)
    return () => observer.disconnect()
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
            userSelect: 'text',
          })}
        >
          <div
            key={item.slug}
            className={cx(
              css({
                display: 'grid',
                gap: '6',
                p: { base: '4', md: '5' },
                animation: 'fadeUp 0.45s token(easings.signal) backwards',
                _motionReduce: { animation: 'none' },
              }),
              // Room at the end for the buying bar, which would otherwise cover the last lines (set
              // for md too, or the padding above would win there).
              css({ pb: { base: '24', md: '24' } }),
            )}
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
              <div ref={figures} className={css({ display: 'grid', gap: '2.5', mt: '1' })}>
                <KeyFigures
                  price={item.priceEur}
                  score={sheet.score}
                  accent={sheet.rank === 0}
                  locale={locale}
                  action={<AmazonLink item={item} locale={locale} layouts={layouts} />}
                />
                <p className={css({ fontSize: 'xs', color: 'ink.faint', lineHeight: '1.45' })}>
                  {amazon.direct ? m.amazonProduct[locale] : m.amazonQuery(amazon.query, locale)}
                  {amazon.affiliate && ` ${m.amazonNotice[locale]}`}
                </p>
              </div>
              {sheet.fit != null && sheet.met != null && (
                <MatchBreakdown fit={sheet.fit} met={sheet.met} use={use} locale={locale} />
              )}
            </div>

            {/* The product (its photo, or its drawing) on the canvas's dotted paper. */}
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
              <ProductHero item={item} locale={locale} />
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
          </div>
        </div>

        <div
          className={buyBar}
          data-shown={barShown || undefined}
          aria-hidden={!barShown || undefined}
          inert={!barShown || undefined}
        >
          <span className={css({ flex: '1', minW: '0', display: 'grid', gap: '0.5' })}>
            <span
              className={css({
                fontFamily: 'mono',
                fontSize: 'md',
                lineHeight: '1.1',
                fontVariantNumeric: 'tabular-nums',
              })}
            >
              {formatPrice(item.priceEur, locale)}
            </span>
            <span className={css({ fontSize: 'xs', color: 'ink.muted', truncate: true })}>
              {item.brand.name} {item.name}
            </span>
          </span>
          <AmazonLink item={item} locale={locale} layouts={layouts} />
        </div>
      </aside>
    </>,
    document.body,
  )
}
