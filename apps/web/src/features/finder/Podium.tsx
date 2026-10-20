import type { CatalogItem, Locale, Ranked } from '@choose/catalog'
import { useLayoutEffect, useRef } from 'react'
import { css, cx } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { Flip, gsap, prefersReducedMotion } from '../motion/gsap'
import { motion } from '../motion/tokens'
import { ProductGlyph } from '../product/glyphs'
import { formatPrice } from '../product/specs'

// The three best matches for the answers so far. When the ranking changes, GSAP Flip moves each
// card from where it was to where it now belongs, so a product visibly climbs or drops.

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

export function Podium({
  top,
  locale,
  layout = 'column',
}: {
  top: Ranked<CatalogItem>[]
  locale: Locale
  layout?: 'column' | 'row'
}) {
  const root = useRef<HTMLOListElement>(null)
  const state = useRef<Flip.FlipState | null>(null)
  const signature = top.map((r) => r.item.slug).join('|')

  useIsoLayoutEffect(() => {
    const cards = root.current?.querySelectorAll('[data-flip-id]')
    if (!cards) return
    if (state.current && !prefersReducedMotion()) {
      Flip.from(state.current, {
        targets: cards,
        duration: motion.base + 0.1,
        ease: motion.ease,
        absolute: true,
        scale: false,
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: motion.base, ease: motion.ease },
          ),
        onLeave: (els) => gsap.to(els, { opacity: 0, duration: motion.fast }),
      })
    }
    state.current = Flip.getState(cards)
  }, [signature])

  return (
    <ol
      ref={root}
      className={css({
        display: 'flex',
        flexDirection: layout === 'column' ? 'column' : 'row',
        gap: '2.5',
        overflowX: layout === 'row' ? 'auto' : undefined,
        scrollbarWidth: 'none',
      })}
    >
      {top.map((entry, i) => (
        <li
          key={entry.item.slug}
          data-flip-id={entry.item.slug}
          className={cx(
            css({
              display: 'grid',
              gridTemplateColumns: { base: '52px 1fr', md: '72px 1fr' },
              alignItems: 'center',
              gap: '3',
              p: '3',
              bg: 'surface.raised/80',
              backdropFilter: 'blur(8px)',
              borderRadius: 'lg',
              borderWidth: '1px',
              borderColor: i === 0 ? 'signal' : 'line',
              minW: layout === 'row' ? '56' : undefined,
              flexShrink: '0',
            }),
          )}
        >
          <div
            className={css({ display: 'grid', placeItems: 'center', h: { base: '9', md: '12' } })}
          >
            <ProductGlyph
              item={entry.item}
              className={css({ maxH: { base: '9', md: '12' }, maxW: '100%', w: '100%', h: 'auto' })}
            />
          </div>
          <div className={css({ minW: '0', display: 'grid', gap: '0.5' })}>
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                gap: '2',
                fontFamily: 'mono',
                fontSize: '2xs',
                color: 'ink.faint',
              })}
            >
              <span className={css({ color: i === 0 ? 'signal' : 'ink.muted' })}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                {Math.round(entry.score * 100)}% {m.match[locale]}
              </span>
            </div>
            <span
              className={css({
                fontWeight: '600',
                fontSize: 'sm',
                lineHeight: '1.2',
                truncate: true,
              })}
            >
              {entry.item.brand.name} {entry.item.name}
            </span>
            <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'ink.muted' })}>
              {formatPrice(entry.item.priceEur, locale)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
