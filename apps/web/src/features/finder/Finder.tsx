import type { CatalogItem, Category, Locale } from '@choose/catalog'
import { useEffect, useRef } from 'react'
import { css, cx } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { gsap, prefersReducedMotion } from '../motion/gsap'
import { scene } from '../scene/controller'
import { useEnterDelay, usePageExit } from '../scene/navigation'
import { AnswerRail } from './AnswerRail'
import { Console } from './Console'
import { LiveCounter } from './LiveCounter'
import { Podium } from './Podium'
import { ResultsView } from './ResultsView'
import { type FinderSearch, useFinder } from './useFinder'

// The finder over its category's canvas: the live counter and the answer rail top-left, the
// podium on the right, the question console docked at the bottom; at the end the console gives
// way to the results. The canvas itself is the layout's scene: the finder only tells it which
// products the answers keep, which ones the hovered option would keep, and the podium. Only the
// widgets take the pointer, so dragging anywhere else browses the canvas.

type Props = { category: Category; items: CatalogItem[]; search: FinderSearch; locale: Locale }

const enterLeft = css({
  animation: 'slideInLeft 0.9s token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
})
const enterRight = css({
  animation: 'slideInRight 1s token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
})
const enterDock = css({
  animation: 'dockRise 1.15s token(easings.signal) backwards',
  transformOrigin: '50% 100%',
  _motionReduce: { animation: 'none' },
})
const enterFade = css({
  animation: 'fadeUp 0.8s token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
})

export function Finder({ category, items, search, locale }: Props) {
  const finder = useFinder(category, items, search, locale)
  const stage = useRef<HTMLElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const done = finder.step == null
  // Coming from the home page, the chrome waits for the panel to finish opening.
  const delay = useEnterDelay({ mode: 'canvas', category }, 0.92, 0.1)

  useEffect(() => {
    scene.showCanvas(category)
  }, [category])

  // The canvas mirrors the answers; a new answer ripples out from the console.
  useEffect(() => {
    const box = dock.current?.getBoundingClientRect()
    scene.setTargets(
      category,
      { matching: finder.matchingIds, hot: finder.hotIds, ranks: finder.podiumRanks },
      box ? { x: box.left + box.width / 2, y: box.top + box.height / 3 } : undefined,
    )
  }, [category, finder.matchingIds, finder.hotIds, finder.podiumRanks])
  useEffect(() => {
    scene.setDetails(category, finder.details)
  }, [category, finder.details])
  useEffect(
    () => () => {
      // Back on the home page the panel shows every product again.
      scene.setTargets(category, null)
      scene.setDetails(category, null)
    },
    [category],
  )

  // The hint sits right above the console, whose height changes per question.
  useEffect(() => {
    const el = dock.current
    if (!el || !stage.current) return
    const observer = new ResizeObserver(([entry]) => {
      stage.current?.style.setProperty(
        '--dock-h',
        `${Math.round(entry?.contentRect.height ?? 0)}px`,
      )
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  usePageExit(
    () =>
      new Promise<void>((resolve) => {
        const el = stage.current
        if (!el || prefersReducedMotion()) return resolve()
        gsap.set(el.querySelectorAll('[data-enter]'), { animation: 'none' })
        gsap
          .timeline({ onComplete: resolve, defaults: { ease: 'power3.in' } })
          .to(
            el.querySelectorAll('[data-enter=dock]'),
            {
              y: 80,
              rotateX: 26,
              opacity: 0,
              transformPerspective: 1400,
              transformOrigin: '50% 100%',
              duration: 0.4,
            },
            0,
          )
          .to(
            el.querySelectorAll('[data-enter=hud], [data-enter=podium], [data-enter=hint]'),
            { opacity: 0, y: -10, duration: 0.3 },
            0,
          )
      }),
  )

  return (
    <main
      ref={stage}
      className={css({
        position: 'relative',
        h: '100dvh',
        minH: '560px',
        overflow: 'hidden',
        pointerEvents: 'none',
        '--dock-h': '320px',
      })}
    >
      <h1 className={css({ srOnly: true })}>{m.category[category][locale]}</h1>

      {/* The canvas fades into paper under the header and the counter, which stay legible. */}
      <div
        aria-hidden
        className={cx(
          enterFade,
          css({
            position: 'absolute',
            insetInline: '0',
            top: '0',
            h: { base: '48', md: '60' },
            background:
              'linear-gradient(to bottom, rgba(243,241,236,0.94) 35%, rgba(243,241,236,0.6) 70%, rgba(243,241,236,0))',
          }),
        )}
        style={{ animationDelay: `${delay}s` }}
      />

      <div
        data-enter="hud"
        className={cx(
          enterLeft,
          css({
            position: 'absolute',
            top: { base: '16', md: '20' },
            left: { base: '4', md: '8' },
            right: { base: '4', lg: '96' },
            display: 'grid',
            gap: '3',
            '&[data-done]': { right: { base: '4', md: '8' } },
          }),
        )}
        style={{ animationDelay: `${delay + 0.1}s` }}
        data-done={done || undefined}
      >
        <LiveCounter
          value={finder.matching}
          total={items.length}
          label={m.matching[category][locale]}
          preview={finder.preview}
          previewLabel={m.ifPicked[locale]}
          ofLabel={m.of[locale]}
        />
        <AnswerRail items={finder.rail} current={finder.currentKey} onPick={finder.goTo} />
      </div>

      {!done && (
        <aside
          data-enter="podium"
          className={cx(
            enterRight,
            css({
              position: 'absolute',
              top: '24',
              right: '8',
              w: '72',
              display: { base: 'none', lg: 'block' },
              pointerEvents: 'auto',
            }),
          )}
          style={{ animationDelay: `${delay + 0.2}s` }}
        >
          <Podium top={finder.ranked.slice(0, 3)} locale={locale} />
        </aside>
      )}

      {!done && (
        <p
          data-enter="hint"
          aria-hidden
          className={cx(
            enterFade,
            css({
              position: 'absolute',
              left: '50%',
              bottom: 'calc(var(--dock-h) + 40px)',
              transform: 'translateX(-50%)',
              fontFamily: 'mono',
              fontSize: '2xs',
              color: 'ink.muted',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              px: '3',
              py: '1.5',
              borderRadius: 'full',
              bg: 'paper/80',
              backdropFilter: 'blur(8px)',
              transition: 'bottom 400ms token(easings.signal)',
            }),
          )}
          style={{ animationDelay: `${delay + 0.5}s` }}
        >
          <span className={css({ '@media (hover: none)': { display: 'none' } })}>
            {m.canvasHint[locale]}
          </span>
          <span className={css({ '@media (hover: hover)': { display: 'none' } })}>
            {m.canvasHintTouch[locale]}
          </span>
        </p>
      )}

      <div
        ref={dock}
        className={css({
          position: 'absolute',
          bottom: { base: '3', md: '6' },
          left: '50%',
          transform: 'translateX(-50%)',
          w: { base: 'calc(100% - 24px)', md: 'min(960px, calc(100% - 48px))' },
        })}
      >
        <div
          data-enter="dock"
          className={cx(
            enterDock,
            css({
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: '3',
              pointerEvents: 'auto',
            }),
          )}
          style={{ animationDelay: `${delay}s` }}
        >
          {!done && (
            <div className={css({ display: { base: 'block', lg: 'none' } })}>
              <Podium top={finder.ranked.slice(0, 3)} locale={locale} layout="row" />
            </div>
          )}
          {done ? (
            <ResultsView
              ranked={finder.ranked}
              locale={locale}
              onEdit={finder.back}
              onReset={finder.reset}
            />
          ) : (
            <Console finder={finder} category={category} locale={locale} enterDelay={delay + 0.3} />
          )}
        </div>
      </div>
    </main>
  )
}
