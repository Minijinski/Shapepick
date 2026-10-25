import type { CatalogItem, Locale } from '@choose/catalog'
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { css, cx } from 'styled-system/css'
import { button } from 'styled-system/recipes'
import { messages as m } from '~/i18n/messages'
import { Standings } from '../catalogue/Standings'
import { AmazonLink } from '../product/AmazonLink'
import { KeyFigures } from '../product/KeyFigures'
import { MatchBreakdown } from '../product/MatchBreakdown'
import { ProductHero } from '../product/ProductHero'
import { ProductPicture } from '../product/ProductPicture'
import { photoSrc } from '../product/photo'
import { AMAZON_PARTNER_TAG } from '../product/shops'
import { formatPrice, productKind, sheetSpecs } from '../product/specs'
import { ProductLink } from './ProductLink'
import { foldAway, useSheetDrag } from './Sheet'
import type { ProductSheet } from './useFinder'

// One product's sheet, opened from wherever a product shows: the canvas, the podium, the results,
// or straight from its own address (/fr/claviers/<slug>), the page's path saying which product is
// open. It reads like the results' best match (the product and its key specs, strengths, caveats),
// says what its match is made of and adds the full spec sheet, then the products most like it.
// Where to buy it sits on the line of its price, and once that line has scrolled away a bar slides
// up at the foot of the sheet with the price and the shop again. A side panel on wide screens, a
// bottom sheet on phones; Escape, the backdrop and the close button close it (the page then drops
// it from its path, and it folds away), the arrows step through the ranking. Rendered in the page
// rather than in a portal, so that the server sends it. Its text can be selected and copied (a
// name, a spec), unlike the rest of the site, where a press and drag browses the canvas.

type Props = {
  sheet: ProductSheet
  /** The products most like it, which it links to. */
  similar: CatalogItem[]
  /** Its category's catalogue, where its places in the collections are read. */
  catalogue: CatalogItem[]
  /** The use the visitor picked, which the match is measured against. */
  use: string | null
  /** The visitor's layout answer (azerty, ansi, iso), which the shop search follows. */
  layouts?: readonly string[]
  locale: Locale
  /** Place among the kept products, for stepping through them; null for a ruled-out product. */
  position: { index: number; total: number } | null
  /** The page has closed it: it folds away, then says it is gone. */
  leaving: boolean
  onStep: (delta: -1 | 1) => void
  onClose: () => void
  onGone: () => void
}

const sectionLabel = css({
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

const iconButton = cx(button({ tone: 'ghost', size: 'icon' }), css({ color: 'ink.muted' }))

/** The rank, which a phone shows once: in the steps beside it. */
const rankOnce = css({ display: { base: 'none', md: 'inline' } })

/**
 * Where a part of the sheet goes on a phone: the product's photo right under its name, then its
 * price and match, then the rest. Wider, in the order of the page.
 */
const onPhoneAt = {
  photo: css({ order: { base: '1', md: '0' } }),
  figures: css({ order: { base: '2', md: '0' } }),
  rest: css({ order: { base: '3', md: '0' } }),
}

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

/** A product like this one: its picture on the canvas's dotted paper, its name, its price. */
const similarCard = cx(
  'group',
  css({
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    h: '100%',
    borderRadius: 'card',
    borderWidth: '1px',
    borderColor: 'line',
    bg: 'surface',
    overflow: 'hidden',
    transition: 'border-color 160ms, background 160ms',
    _hover: { borderColor: 'line.strong', bg: 'surface.raised' },
    _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
  }),
)
const similarPicture = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gridTemplateRows: 'minmax(0, 1fr)',
  placeItems: 'center',
  h: { base: '20', md: '24' },
  p: '3',
  bg: 'paper',
  backgroundImage: 'radial-gradient(#CFCBC2 1.1px, transparent 1.3px)',
  backgroundSize: '14px 14px',
  borderBottomWidth: '1px',
  borderColor: 'line',
})
/** The picture lifts under the pointer: the card is something to open. */
const similarLift = css({
  w: '100%',
  h: '100%',
  transition: 'transform 450ms token(easings.signal)',
  _groupHover: { transform: 'translateY(-3px) scale(1.04)' },
  _groupFocusVisible: { transform: 'translateY(-3px) scale(1.04)' },
  _motionReduce: { transition: 'none' },
})

/** Text for an HTML attribute. */
const attribute = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The product's photo as a plain image, for readers that run no script (some search engines): the
 * page shows its drawing until the photo is cut out in the browser, which they would never see.
 */
function photoTag(item: CatalogItem) {
  if (!item.photo) return ''
  const width = Math.min(800, item.photo.width ?? 800)
  const height =
    item.photo.width && item.photo.height
      ? ` width="${width}" height="${Math.round((width * item.photo.height) / item.photo.width)}"`
      : ''
  const alt = `${item.brand.name} ${item.name}`
  return `<img src="${attribute(photoSrc(item.photo, width, true))}" alt="${attribute(alt)}"${height} loading="lazy" style="display:block;max-width:100%;height:auto;margin:0 auto">`
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

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

export function ProductDrawer({
  sheet,
  similar,
  catalogue,
  use,
  layouts,
  locale,
  position,
  leaving,
  onStep,
  onClose,
  onGone,
}: Props) {
  const panel = useRef<HTMLElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const figures = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const { item } = sheet
  const [barShown, setBarShown] = useState(false)

  /** Asks the page to close it, once: the page drops it from its path, and it folds away. */
  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    onClose()
  }, [onClose])
  // On a phone the sheet comes from the bottom: its head can be pulled down to fold it away.
  const pull = useSheetDrag(panel, close)
  const pullOnPhone = (e: ReactPointerEvent) => {
    if (window.matchMedia('(max-width: 47.99rem)').matches) pull(e)
  }

  // However it was closed (its button, Escape, Back), it plays out, then goes. A timer backs the
  // animation up in a hidden tab.
  useEffect(() => {
    if (!leaving) return
    closing.current = true
    const wide = window.matchMedia('(min-width: 48rem)').matches
    foldAway(panel.current, backdrop.current, onGone, wide)
  }, [leaving, onGone])

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
      if (closing.current) return
      if (e.key === 'Escape') close()
      else if (position && e.key === 'ArrowLeft') onStep(-1)
      else if (position && e.key === 'ArrowRight') onStep(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, onStep, position])

  // A new product starts at the top of the sheet; picked among the similar models, whose link
  // goes with the old product, it takes the focus back.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the slug is the trigger
  useEffect(() => {
    panel.current?.querySelector('[data-sheet-scroll]')?.scrollTo({ top: 0 })
    const focused = document.activeElement
    if (!focused || focused === document.body) panel.current?.focus({ preventScroll: true })
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

  const kept = sheet.rank != null

  // Inside the finder's page, which leaves the pointer to the canvas: the sheet takes it back.
  return (
    <>
      <div
        ref={backdrop}
        aria-hidden
        onClick={close}
        className={css({
          position: 'fixed',
          inset: '0',
          zIndex: '40',
          pointerEvents: 'auto',
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
          pointerEvents: 'auto',
          left: { base: 'max(0.5rem, env(safe-area-inset-left))', md: 'auto' },
          right: { base: 'max(0.5rem, env(safe-area-inset-right))', md: '3' },
          top: { base: 'auto', md: '3' },
          // Clear of the iPhone's home indicator.
          bottom: { base: 'calc(0.5rem + env(safe-area-inset-bottom))', md: '3' },
          transition: 'translate 320ms token(easings.signal)',
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
        {/* On a phone, its handle: pulled down, the sheet folds away. */}
        <header
          onPointerDown={pullOnPhone}
          className={css({
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            flexShrink: '0',
            h: '14',
            pl: '5',
            pr: '3',
            borderBottomWidth: '1px',
            borderColor: 'line',
            touchAction: { base: 'none', md: 'auto' },
            _before: {
              content: '""',
              display: { base: 'block', md: 'none' },
              position: 'absolute',
              top: '1.5',
              left: '50%',
              w: '9',
              h: '1',
              ml: '-4.5',
              borderRadius: 'full',
              bg: 'line',
            },
          })}
        >
          <span
            className={cx(sectionLabel, css({ flex: '1', minW: '0', truncate: true }))}
            aria-live="polite"
          >
            {kept ? (
              // A phone shows the rank once, in the steps beside it.
              <span
                className={cx(
                  css({ color: sheet.rank === 0 ? 'signal' : 'ink.muted' }),
                  position && rankOnce,
                )}
              >
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
            {/* The page's heading while the sheet is open, then what the product is. */}
            <div className={css({ display: 'grid', gap: '3' })}>
              <h1
                id="sheet-title"
                className={css({
                  fontSize: { base: '2xl', md: '3xl' },
                  fontWeight: '650',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.05',
                })}
              >
                <span className={css({ color: 'ink.muted', fontWeight: '500' })}>
                  {item.brand.name}
                </span>{' '}
                {item.name}
              </h1>
              <p className={css({ color: 'ink.muted', lineHeight: '1.45' })}>
                {item.tagline ? item.tagline[locale] : capitalized(productKind(item, locale))}
              </p>
            </div>
            {/* Right under the name, wider (the grid's gap, less the title block's). */}
            <div
              className={cx(
                onPhoneAt.figures,
                css({ display: 'grid', gap: '3', md: { mt: '-3' } }),
              )}
            >
              <div ref={figures} className={css({ display: 'grid', gap: '2.5', mt: '1' })}>
                <KeyFigures
                  price={item.priceEur}
                  score={sheet.score}
                  accent={sheet.rank === 0}
                  locale={locale}
                  action={
                    <AmazonLink item={item} locale={locale} layouts={layouts} placement="sheet" />
                  }
                />
                {/* The notice Amazon requires wherever its affiliate links are, word for word:
                    the button itself says whether it opens the model's page or a search. */}
                {AMAZON_PARTNER_TAG && (
                  <p className={css({ fontSize: 'xs', color: 'ink.faint', lineHeight: '1.45' })}>
                    {m.amazonNotice[locale]}
                  </p>
                )}
              </div>
              {sheet.fit != null && sheet.met != null && (
                <MatchBreakdown fit={sheet.fit} met={sheet.met} use={use} locale={locale} />
              )}
            </div>

            {/* The product (its photo, or its drawing) on the canvas's dotted paper. */}
            <div
              className={cx(
                onPhoneAt.photo,
                css({
                  p: '4',
                  borderRadius: 'card',
                  borderWidth: '1px',
                  borderColor: 'line',
                  bg: 'paper',
                  backgroundImage: 'radial-gradient(#CFCBC2 1.1px, transparent 1.3px)',
                  backgroundSize: '14px 14px',
                }),
              )}
            >
              {item.photo && (
                // biome-ignore lint/security/noDangerouslySetInnerHtml: our own tag, its text escaped
                <noscript dangerouslySetInnerHTML={{ __html: photoTag(item) }} />
              )}
              <ProductHero item={item} locale={locale} />
            </div>

            {(sheet.pros.length > 0 || sheet.cons.length > 0) && (
              <div
                className={cx(
                  onPhoneAt.rest,
                  css({
                    display: 'grid',
                    gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' },
                    gap: '4',
                  }),
                )}
              >
                {sheet.pros.length > 0 && (
                  <div className={css({ display: 'grid', gap: '2', alignContent: 'start' })}>
                    <h2 className={sectionLabel}>{m.strengths[locale]}</h2>
                    <ul className={css({ display: 'grid', gap: '1', fontSize: 'sm' })}>
                      {sheet.pros.map((p) => (
                        <li key={p.en}>+ {p[locale]}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {sheet.cons.length > 0 && (
                  <div className={css({ display: 'grid', gap: '2', alignContent: 'start' })}>
                    <h2 className={sectionLabel}>{m.caveats[locale]}</h2>
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

            <Standings item={item} items={catalogue} locale={locale} className={onPhoneAt.rest} />

            <section className={cx(onPhoneAt.rest, css({ display: 'grid', gap: '2' }))}>
              <h2 className={sectionLabel}>{m.specSheet[locale]}</h2>
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

            {/* The products most like it, two by two: each opens in this sheet, in its place. */}
            {similar.length > 0 && (
              <section className={cx(onPhoneAt.rest, css({ display: 'grid', gap: '2.5' }))}>
                <h2 className={sectionLabel}>{m.similarModels[locale]}</h2>
                <ul
                  className={css({
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '2.5',
                  })}
                >
                  {similar.map((other) => (
                    <li key={other.slug}>
                      <ProductLink slug={other.slug} swap className={similarCard}>
                        <span className={similarPicture}>
                          <span className={similarLift}>
                            <ProductPicture
                              item={other}
                              className={css({ w: '100%', h: '100%' })}
                            />
                          </span>
                        </span>
                        <span
                          className={css({
                            display: 'grid',
                            alignContent: 'start',
                            gap: '0.5',
                            px: '3',
                            pt: '2.5',
                            pb: '3',
                          })}
                        >
                          <span
                            className={css({
                              fontSize: '2xs',
                              lineHeight: '1.35',
                              color: 'ink.muted',
                              truncate: true,
                            })}
                          >
                            {other.brand.name}
                          </span>
                          <span
                            className={css({
                              fontSize: 'sm',
                              fontWeight: '600',
                              lineHeight: '1.25',
                              lineClamp: '2',
                            })}
                          >
                            {other.name}
                          </span>
                          <span
                            className={css({
                              mt: '1',
                              fontFamily: 'mono',
                              fontSize: 'xs',
                              color: 'ink.muted',
                            })}
                          >
                            {formatPrice(other.priceEur, locale)}
                          </span>
                        </span>
                      </ProductLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}
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
          <AmazonLink item={item} locale={locale} layouts={layouts} placement="sheet-bar" />
        </div>
      </aside>
    </>
  )
}
