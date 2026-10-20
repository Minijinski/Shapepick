import {
  ANY,
  type Category,
  type ChoiceStep,
  histogram,
  type Locale,
  readChoice,
} from '@choose/catalog'
import { useRef, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { button, optionTile } from 'styled-system/recipes'
import { messages as m } from '~/i18n/messages'
import { gsap, prefersReducedMotion, SplitText, useGSAP } from '../motion/gsap'
import { motion } from '../motion/tokens'
import { BudgetControl } from './BudgetControl'
import { hasVisual, OptionVisual } from './OptionVisual'
import { type Finder, toggled } from './useFinder'

// The question panel. One question at a time; tiles carry a live count, picked tiles a tick, and
// a tile that would leave nothing says which earlier answer blocks it.
//
// Every question gets the same panel: same height, same header, same footer. The tiles share the
// space between (many make two rows, more scroll), the budget fills it with its price histogram,
// and the help opens over it, so the panel never moves under the visitor's pointer from one
// question to the next. A question whose tiles fit on one row keeps tiles of the same height
// and spends the room above them on its explanation instead.

const panel = css({
  position: 'relative',
  bg: 'surface.raised',
  borderRadius: 'panel',
  borderWidth: '1px',
  borderColor: 'line',
  boxShadow: 'panel',
  p: { base: '4', md: '5' },
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  h: { base: 'clamp(19rem, 46dvh, 25rem)', md: 'clamp(20.5rem, 45dvh, 23.5rem)' },
  overflow: 'hidden',
})

const body = css({
  position: 'relative',
  flex: '1',
  minH: '0',
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
})

/** Columns of the tile grid on a wide console: up to this many tiles make a single row. */
const WIDE_COLUMNS = 5

const tileGrid = css({
  border: '0',
  // The padding is room for what overhangs a tile (the tick, the focus ring), which the scroll
  // box would otherwise cut; the negative margin keeps the tiles aligned with the header.
  m: '-2',
  p: '2',
  minW: '0',
  flex: '1',
  minH: '0',
  display: 'grid',
  gridTemplateColumns: { base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
  gridAutoRows: { base: 'minmax(4.75rem, 1fr)', md: 'minmax(6.25rem, 1fr)' },
  gap: '2.5',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarWidth: 'thin',
  // A single row keeps the height of a two-row question's tiles, at the foot of the panel.
  '&[data-one-row]': {
    gridAutoRows: { md: 'minmax(5.5rem, 7rem)' },
    alignContent: { md: 'end' },
  },
})

const lead = css({
  display: { base: 'none', md: 'block' },
  flexShrink: '0',
  maxW: '46rem',
  fontSize: 'sm',
  color: 'ink.muted',
  lineHeight: '1.55',
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

export function Console({
  finder,
  category,
  locale,
  enterDelay = 0,
}: {
  finder: Finder
  category: Category
  locale: Locale
  /** Seconds before the first question plays in, while the console itself rises. */
  enterDelay?: number
}) {
  const { step, counts, draft } = finder
  const root = useRef<HTMLElement>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const leaving = useRef(false)
  const first = useRef(true)

  useGSAP(
    () => {
      leaving.current = false
      setHelpOpen(false)
      const delay = first.current ? enterDelay : 0
      first.current = false
      if (prefersReducedMotion() || !root.current) return
      const split = SplitText.create('[data-title]', { type: 'words,chars', mask: 'words' })
      gsap.from(split.chars, {
        yPercent: 110,
        duration: motion.base,
        ease: motion.ease,
        stagger: 0.012,
        delay,
      })
      gsap.from('[data-tile], [data-budget], [data-lead]', {
        opacity: 0,
        y: 14,
        duration: motion.base,
        ease: motion.ease,
        stagger: motion.stagger,
        delay: delay + 0.08,
      })
      return () => split.revert()
    },
    { dependencies: [step?.key, finder.answers], scope: root },
  )

  /**
   * Plays the tiles out, then runs the navigation. A timer backs the animation up: in a hidden tab
   * the browser pauses animation frames, and an answer must never wait on one.
   */
  const leave = (then: () => void) => {
    if (leaving.current) return
    leaving.current = true
    if (prefersReducedMotion() || document.hidden) return then()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      then()
    }
    const parts = '[data-tile], [data-budget], [data-title], [data-lead]'
    gsap.to(root.current?.querySelectorAll(parts) ?? [], {
      opacity: 0,
      y: -10,
      duration: motion.fast,
      ease: motion.easeIn,
      stagger: 0.015,
      onComplete: finish,
    })
    window.setTimeout(finish, (motion.fast + 0.2) * 1000)
  }

  if (!step) return null
  const total = finder.matching
  const picked = step.kind === 'range' ? undefined : readChoice(step as ChoiceStep<unknown>, draft)
  const pickedIds = new Set(picked && picked !== ANY ? picked : [])
  const isMulti = step.kind === 'multi' || step.kind === 'musts'
  const base = counts?.base ?? 0

  const options =
    step.kind === 'range'
      ? []
      : step.options.filter((o) => {
          // Must-haves every remaining item already has (or that nothing could add) are noise.
          if (step.kind !== 'musts' || pickedIds.has(o.id)) return true
          const c = counts?.counts[o.id] ?? 0
          return c > 0 && c < base
        })

  const anyTile = !step.required && step.kind !== 'range'
  const oneRow = step.kind !== 'range' && options.length + (anyTile ? 1 : 0) <= WIDE_COLUMNS
  // Above a single row of tiles the explanation fits in the panel: no need for the help button.
  const explained = oneRow && !!step.help
  const visual = hasVisual(category, step.key)
  const bins =
    step.kind === 'range' ? histogram(finder.def, finder.items, finder.answers, step.key, 32) : []

  return (
    <section ref={root} className={panel} aria-labelledby="step-title">
      <div
        data-console-part
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          flexShrink: '0',
          // Room for a title on two lines on phones, so the header never changes height.
          minH: { base: '3.25rem', md: '2.5rem' },
        })}
      >
        <button
          type="button"
          className={iconButton}
          onClick={finder.back}
          disabled={!finder.canGoBack}
          aria-label={m.back[locale]}
        >
          <Icon d="M5 12h14M5 12l6 6M5 12l6-6" />
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={finder.reset}
          aria-label={m.reset[locale]}
        >
          <Icon d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-4v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
        </button>
        <span
          className={css({
            fontFamily: 'mono',
            fontSize: 'xs',
            color: 'ink.faint',
            ml: '1',
            fontVariantNumeric: 'tabular-nums',
          })}
        >
          {String(finder.position).padStart(2, '0')} /{' '}
          {String(finder.asked.length).padStart(2, '0')}
        </span>
        <h2
          id="step-title"
          data-title
          key={step.key}
          className={css({
            flex: '1',
            fontSize: { base: 'xl', md: '2xl' },
            fontWeight: '600',
            letterSpacing: '-0.03em',
            lineHeight: '1.1',
            ml: '2',
          })}
        >
          {step.title[locale]}
        </h2>
        {step.help && (
          <button
            type="button"
            className={cx(iconButton, explained && css({ md: { display: 'none' } }))}
            aria-expanded={helpOpen}
            aria-label={m.help[locale]}
            onClick={() => setHelpOpen((v) => !v)}
          >
            <Icon d="M12 17v-5m0-4h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
          </button>
        )}
      </div>

      <div data-console-part className={body}>
        {step.kind === 'range' ? (
          <div data-budget className={css({ flex: '1', minH: '0' })}>
            <BudgetControl
              step={step as never}
              draft={draft}
              onDraft={finder.setDraft}
              bins={bins}
              locale={locale}
              labels={{
                min: m.budgetMin[locale],
                max: m.budgetMax[locale],
                noLimit: m.noLimit[locale],
              }}
            />
          </div>
        ) : (
          <>
            {explained && (
              <p id="step-lead" data-lead className={lead}>
                {step.help?.[locale]}
              </p>
            )}
            <fieldset
              aria-labelledby="step-title"
              aria-describedby={explained ? 'step-lead' : undefined}
              className={tileGrid}
              data-one-row={oneRow || undefined}
            >
              {options.map((option) => {
                const selected = pickedIds.has(option.id)
                const count = counts?.counts[option.id] ?? 0
                const dead = count === 0 && !selected && !step.weightOnly
                const blocker = dead ? finder.blockerOf(option.id) : null
                const tile = optionTile()
                return (
                  <div
                    key={option.id}
                    data-tile
                    className={css({ position: 'relative', display: 'grid' })}
                  >
                    <button
                      type="button"
                      className={tile.root}
                      aria-pressed={isMulti ? selected : undefined}
                      aria-disabled={dead || undefined}
                      onPointerEnter={() => !dead && finder.setHovered(option.id)}
                      onPointerLeave={() => finder.setHovered(null)}
                      onFocus={() => !dead && finder.setHovered(option.id)}
                      onBlur={() => finder.setHovered(null)}
                      onClick={() => {
                        if (dead) return
                        if (isMulti) finder.setDraft(toggled(step, draft, option.id))
                        else leave(() => finder.commit(option.id))
                      }}
                    >
                      {visual && (
                        <span className={tile.visual}>
                          <OptionVisual
                            category={category}
                            stepKey={step.key}
                            optionId={option.id}
                          />
                        </span>
                      )}
                      <span
                        className={css({ display: 'grid', gap: '1', pr: { base: '7', md: '0' } })}
                      >
                        <span className={tile.label}>{option.label[locale]}</span>
                        {option.hint && !dead && (
                          <span className={tile.hint}>{option.hint[locale]}</span>
                        )}
                        {dead && (
                          <span className={tile.blocked}>
                            {blocker
                              ? `${m.blockedBy[locale]} ${blocker.label}`
                              : m.noMatch[locale]}
                          </span>
                        )}
                      </span>
                      {!step.weightOnly && !dead && (
                        <span className={tile.count}>{String(count).padStart(3, '0')}</span>
                      )}
                      {selected && (
                        <span className={tile.tick} aria-hidden>
                          <svg
                            aria-hidden
                            viewBox="0 0 24 24"
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                        </span>
                      )}
                    </button>
                    {blocker && (
                      <button
                        type="button"
                        onClick={() => finder.goTo(blocker.key)}
                        className={css({
                          position: 'absolute',
                          right: '2.5',
                          bottom: '2.5',
                          fontSize: '2xs',
                          fontFamily: 'mono',
                          color: 'signal',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px',
                          cursor: 'pointer',
                        })}
                      >
                        {m.change[locale]} →
                      </button>
                    )}
                  </div>
                )
              })}
              {anyTile && (
                <div data-tile className={css({ display: 'grid' })}>
                  <button
                    type="button"
                    className={cx(
                      optionTile().root,
                      css({ borderStyle: 'dashed', bg: 'transparent' }),
                    )}
                    onClick={() => leave(() => finder.commit(ANY))}
                  >
                    <span className={css({ display: 'grid', gap: '1' })}>
                      <span className={optionTile().label}>
                        {step.kind === 'musts' ? m.noMustHaves[locale] : m.noPreference[locale]}
                      </span>
                      <span className={optionTile().hint}>{m.noPreferenceHint[locale]}</span>
                    </span>
                  </button>
                </div>
              )}
            </fieldset>
          </>
        )}
        {helpOpen && step.help && (
          <div
            className={css({
              position: 'absolute',
              inset: '0',
              zIndex: '2',
              display: 'grid',
              alignContent: 'start',
              justifyItems: 'start',
              gap: '3',
              p: { base: '3', md: '4' },
              bg: 'surface.raised/95',
              backdropFilter: 'blur(10px)',
              borderRadius: 'card',
              borderWidth: '1px',
              borderColor: 'line',
              overflowY: 'auto',
              animation: 'fadeUp 0.35s token(easings.signal) backwards',
              _motionReduce: { animation: 'none' },
            })}
          >
            <p
              className={css({
                fontSize: { base: 'sm', md: 'md' },
                color: 'ink.soft',
                lineHeight: '1.6',
                maxW: '3xl',
              })}
            >
              {step.help[locale]}
            </p>
            <button
              type="button"
              className={button({ tone: 'line', size: 'sm' })}
              onClick={() => setHelpOpen(false)}
            >
              {m.gotIt[locale]}
            </button>
          </div>
        )}
      </div>

      <div
        data-console-part
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '2',
          flexShrink: '0',
          minH: '11',
        })}
      >
        {total > 0 && (
          <button
            type="button"
            className={button({ tone: 'ghost', size: 'sm' })}
            onClick={() => leave(finder.showResults)}
          >
            {m.seeResults(total, locale)} →
          </button>
        )}
        {(isMulti || step.kind === 'range') && (
          <button
            type="button"
            className={button({ tone: 'ink', size: 'md' })}
            disabled={step.kind !== 'range' && pickedIds.size === 0}
            onClick={() => leave(() => finder.commit(draft ? draft : ANY))}
          >
            {m.continue[locale]}
          </button>
        )}
      </div>
    </section>
  )
}
