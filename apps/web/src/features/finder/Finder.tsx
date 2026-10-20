import type { CatalogItem, Category, Locale } from '@choose/catalog'
import { useEffect, useRef } from 'react'
import { css } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { DataCloud } from '../cloud/DataCloud'
import { AnswerRail } from './AnswerRail'
import { Console } from './Console'
import { LiveCounter } from './LiveCounter'
import { Podium } from './Podium'
import { ResultsView } from './ResultsView'
import { type FinderSearch, useFinder } from './useFinder'

// The stage: the live counter and answer rail top-left, the data cloud filling the free space,
// the podium on the right, the question console docked at the bottom. At the end, the console
// gives way to the results.

type Props = { category: Category; items: CatalogItem[]; search: FinderSearch; locale: Locale }

export function Finder({ category, items, search, locale }: Props) {
  const finder = useFinder(category, items, search, locale)
  const stage = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const done = finder.step == null

  // The cloud fills whatever the docked panel leaves free; the panel's height changes per question.
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

  return (
    <main
      ref={stage}
      className={css({
        position: 'relative',
        h: '100dvh',
        minH: '560px',
        overflow: 'hidden',
        '--dock-h': '320px',
        bgImage: 'radial-gradient(circle at 1px 1px, token(colors.grey.200) 1px, transparent 0)',
        bgSize: '28px 28px',
      })}
    >
      <h1 className={css({ srOnly: true })}>{m.category[category][locale]}</h1>

      <div
        aria-hidden
        className={css({
          position: 'absolute',
          top: { base: '40', md: '16' },
          left: '0',
          right: '0',
          bottom: 'calc(var(--dock-h) + 24px)',
          transition: 'bottom 400ms token(easings.signal), opacity 600ms',
          '&[data-done]': { opacity: 0 },
        })}
        data-done={done || undefined}
      >
        <DataCloud layout={finder.cloud.layout} layoutKey={finder.cloud.key} />
      </div>

      <div
        className={css({
          position: 'absolute',
          top: { base: '16', md: '20' },
          left: { base: '4', md: '8' },
          right: { base: '4', lg: '96' },
          display: 'grid',
          gap: '3',
          '&[data-done]': { right: { base: '4', md: '8' } },
        })}
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
          className={css({
            position: 'absolute',
            top: '24',
            right: '8',
            w: '72',
            display: { base: 'none', lg: 'block' },
          })}
        >
          <Podium top={finder.ranked.slice(0, 3)} locale={locale} />
        </aside>
      )}

      <div
        ref={dock}
        className={css({
          position: 'absolute',
          bottom: { base: '3', md: '6' },
          left: '50%',
          transform: 'translateX(-50%)',
          w: { base: 'calc(100% - 24px)', md: 'min(960px, calc(100% - 48px))' },
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: '3',
        })}
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
          <Console finder={finder} category={category} locale={locale} />
        )}
      </div>
    </main>
  )
}
