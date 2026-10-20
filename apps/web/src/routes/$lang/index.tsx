import { type Category, categorySlugs, type Locale } from '@choose/catalog'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { gsap, prefersReducedMotion, SplitText, useGSAP } from '~/features/motion/gsap'
import { motion } from '~/features/motion/tokens'
import { KeyboardGlyph, MonitorGlyph } from '~/features/product/glyphs'
import { messages as m } from '~/i18n/messages'
import { getCatalog } from '~/server/catalog'

export const Route = createFileRoute('/$lang/')({
  loader: async () => {
    const [keyboards, monitors] = await Promise.all([
      getCatalog({ data: 'keyboard' }),
      getCatalog({ data: 'monitor' }),
    ])
    return {
      counts: { keyboard: keyboards.items.length, monitor: monitors.items.length } satisfies Record<
        Category,
        number
      >,
    }
  },
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

const sizes = ['full', 'tkl', 'f75', 'f65', 'f60', 'alice'] as const
const formats = [
  { aspect: '16:9', diagonalIn: 24 },
  { aspect: '16:9', diagonalIn: 27 },
  { aspect: '21:9', diagonalIn: 34, curvatureR: 1800 },
  { aspect: '32:9', diagonalIn: 49, curvatureR: 1800 },
  { aspect: '16:9', diagonalIn: 32 },
] as const

/** The category glyph cycles through the shapes the questionnaire will ask about. */
function useCycle(length: number, every = 1800) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const id = setInterval(() => setIndex((i) => (i + 1) % length), every)
    return () => clearInterval(id)
  }, [length, every])
  return index
}

function CategoryCard({
  category,
  count,
  locale,
}: {
  category: Category
  count: number
  locale: Locale
}) {
  const index = useCycle(category === 'keyboard' ? sizes.length : formats.length)
  const glyph = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      gsap.fromTo(
        glyph.current,
        { opacity: 0, scale: 0.94 },
        { opacity: 1, scale: 1, duration: motion.base, ease: motion.ease },
      )
    },
    { dependencies: [index] },
  )
  const format = formats[index % formats.length] ?? formats[0]
  return (
    <Link
      to="/$lang/$category"
      params={{ lang: locale, category: categorySlugs[category][locale] }}
      data-card
      className={css({
        position: 'relative',
        display: 'grid',
        gridTemplateRows: '1fr auto',
        gap: '6',
        minH: { base: '64', md: '80' },
        p: { base: '5', md: '7' },
        bg: 'surface.raised',
        borderRadius: 'xl',
        borderWidth: '1px',
        borderColor: 'line',
        transition: 'transform 300ms token(easings.signal), box-shadow 300ms, border-color 300ms',
        _hover: { transform: 'translateY(-4px)', boxShadow: 'panel', borderColor: 'line.strong' },
        _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '3px' },
      })}
    >
      <div ref={glyph} className={css({ display: 'grid', placeItems: 'center', minH: '0' })}>
        {category === 'keyboard' ? (
          <KeyboardGlyph
            formFactor={sizes[index % sizes.length] ?? 'f75'}
            colorFamily="white"
            absolute
            className={css({ w: '100%', maxH: '40' })}
          />
        ) : (
          <MonitorGlyph
            absolute
            panel="qdoled"
            {...format}
            className={css({ w: '100%', maxH: '44' })}
          />
        )}
      </div>
      <div
        className={css({
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '4',
        })}
      >
        <div className={css({ display: 'grid', gap: '1' })}>
          <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'ink.faint' })}>
            {String(count).padStart(4, '0')} {m.models[locale]}
          </span>
          <span
            className={css({
              fontSize: { base: '3xl', md: '4xl' },
              fontWeight: '650',
              letterSpacing: '-0.04em',
              lineHeight: '1',
            })}
          >
            {m.category[category][locale]}
          </span>
          <span className={css({ color: 'ink.muted', fontSize: 'sm' })}>
            {m.categoryPitch[category][locale]}
          </span>
        </div>
        <span
          aria-hidden
          className={css({
            display: 'grid',
            placeItems: 'center',
            w: '12',
            h: '12',
            borderRadius: 'full',
            bg: 'ink',
            color: 'paper',
            fontSize: 'xl',
            flexShrink: '0',
          })}
        >
          →
        </span>
      </div>
    </Link>
  )
}

function Home() {
  const { counts } = Route.useLoaderData()
  const { lang } = Route.useParams()
  const locale = lang as Locale
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const split = SplitText.create('[data-hero-title]', { type: 'lines,words', mask: 'lines' })
      const tl = gsap.timeline({ defaults: { ease: motion.ease } })
      tl.from('[data-kicker]', { opacity: 0, y: 10, duration: motion.base })
        .from(split.words, { yPercent: 105, duration: motion.slow, stagger: 0.04 }, '<0.05')
        .from('[data-lead]', { opacity: 0, y: 12, duration: motion.base }, '<0.3')
        .from('[data-card]', { opacity: 0, y: 30, duration: motion.slow, stagger: 0.1 }, '<0.1')
      return () => split.revert()
    },
    { scope: root },
  )

  return (
    <main
      ref={root}
      className={css({
        minH: '100dvh',
        px: { base: '4', md: '8' },
        pt: { base: '24', md: '32' },
        pb: '12',
        bgImage: 'radial-gradient(circle at 1px 1px, token(colors.grey.200) 1px, transparent 0)',
        bgSize: '28px 28px',
      })}
    >
      <div
        className={css({ maxW: '6xl', mx: 'auto', display: 'grid', gap: { base: '10', md: '14' } })}
      >
        <div className={css({ display: 'grid', gap: '5', maxW: '4xl' })}>
          <p
            data-kicker
            className={css({
              fontFamily: 'mono',
              fontSize: 'xs',
              color: 'ink.muted',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            })}
          >
            <span className={css({ color: 'signal' })}>●</span> {m.homeKicker[locale]}
          </p>
          <h1
            data-hero-title
            className={css({
              fontSize: 'display',
              fontWeight: '650',
              letterSpacing: '-0.055em',
              lineHeight: '0.92',
              whiteSpace: 'pre-line',
            })}
          >
            {m.homeTitle[locale]}
          </h1>
          <p
            data-lead
            className={css({
              fontSize: { base: 'md', md: 'lg' },
              color: 'ink.muted',
              maxW: '2xl',
              lineHeight: '1.5',
            })}
          >
            {m.homeLead[locale]}
          </p>
        </div>
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: '1fr', md: '1fr 1fr' },
            gap: '4',
          })}
        >
          <CategoryCard category="keyboard" count={counts.keyboard} locale={locale} />
          <CategoryCard category="monitor" count={counts.monitor} locale={locale} />
        </div>
        <p className={css({ fontFamily: 'mono', fontSize: '2xs', color: 'ink.faint' })}>
          {m.demoData[locale]}
        </p>
      </div>
    </main>
  )
}
