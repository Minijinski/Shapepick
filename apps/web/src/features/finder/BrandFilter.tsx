import type { Locale } from '@choose/catalog'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { messages as m } from '~/i18n/messages'
import { Sheet } from './Sheet'

// The brands, beside the counter: a chip that says which brands the finder shows (every one until
// told otherwise) and opens a list of them, A to Z, each with how many of its products the other
// answers leave. Unticking a brand hides it, "Only" (beside the count, under the pointer) keeps one
// alone, "Show all" undoes it all; each change applies at once, the canvas and the counter follow.
// A brand under the pointer rings its products on the canvas. On a phone the list opens in a sheet
// from the bottom of the screen rather than hanging from the chip.

type Option = { id: string; name: string; count: number }

type Props = {
  options: Option[]
  /** Brands shown; null: every brand. */
  selected: Set<string> | null
  open: boolean
  locale: Locale
  onOpenChange: (open: boolean) => void
  onChange: (ids: string[] | null) => void
  onHover: (id: string | null) => void
}

/** Past this many brands the list gets a search field. */
const SEARCH_FROM = 8
/**
 * What the chip said as its page went, and when (ms). Switching categories the chip stays where it
 * is: if the next category's says something else (brands set aside in one of them), its words fade
 * in rather than replace the last ones at once. Past `HANDOFF_MS`, a chip is a new one.
 */
let lastSaid: { words: string; at: number } | null = null
const HANDOFF_MS = 1000
/** Room the list keeps from the edge of the screen (px). */
const EDGE = 16

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

const chip = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1.5',
  h: '7',
  pl: '2.5',
  pr: '2',
  borderRadius: 'pill',
  fontSize: 'xs',
  whiteSpace: 'nowrap',
  bg: 'surface/80',
  backdropFilter: 'blur(8px)',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'line.strong',
  color: 'ink',
  cursor: 'pointer',
  pointerEvents: 'auto',
  transition: 'border-color 160ms, background 160ms',
  _hover: { borderColor: 'ink' },
  _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
  // Some brands set aside: the chip says so in ink.
  '&[data-filtered]': { borderStyle: 'solid', borderColor: 'ink', bg: 'surface.raised' },
  '&[aria-expanded=true]': { borderStyle: 'solid', borderColor: 'ink' },
})

const caption = css({
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'ink.faint',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

const arrive = css({
  '&[data-arrive]': { animation: 'fadeIn 0.45s ease 0.05s backwards' },
  _motionReduce: { '&[data-arrive]': { animation: 'none' } },
})

const panel = css({
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: '0',
  zIndex: '30',
  display: 'grid',
  gridTemplateRows: 'auto auto minmax(0, 1fr)',
  w: 'min(19rem, calc(100vw - 2rem))',
  maxH: 'min(26rem, 56dvh)',
  bg: 'surface.raised/96',
  backdropFilter: 'blur(14px)',
  borderWidth: '1px',
  borderColor: 'line',
  borderRadius: 'card',
  boxShadow: 'panel',
  pointerEvents: 'auto',
  animation: 'fadeUp 0.28s token(easings.signal) backwards',
  _motionReduce: { animation: 'none' },
})

const row = css({
  position: 'relative',
  display: 'grid',
  // Name, "Only", count: "Only" keeps its own column, so it never covers the count, nor the count
  // its click.
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  alignItems: 'center',
  gap: '2.5',
  h: { base: '11', md: '9' },
  px: '3',
  borderRadius: '8px',
  fontSize: 'sm',
  _hover: { bg: 'ink/4' },
  '&:has(input:focus-visible)': { outline: '2px solid', outlineColor: 'signal' },
  '&[data-empty]': { color: 'ink.faint' },
  '&:is(:hover, :focus-within) [data-only]': { opacity: 1, pointerEvents: 'auto' },
  // No pointer to hover with (a phone): "Only" stays in view.
  '@media (hover: none)': { '& [data-only]': { opacity: 1, pointerEvents: 'auto' } },
})

/** A square tick box, ink when ticked. */
const box = css({
  appearance: 'none',
  display: 'grid',
  placeItems: 'center',
  w: '4',
  h: '4',
  m: '0',
  borderRadius: '4px',
  borderWidth: '1.5px',
  borderColor: 'line.strong',
  bg: 'surface.raised',
  cursor: 'pointer',
  transition: 'background 140ms, border-color 140ms',
  _checked: {
    bg: 'ink',
    borderColor: 'ink',
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23F3F1EC' stroke-width='3.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12l5 5 9-10'/%3E%3C/svg%3E\")",
    backgroundSize: '11px',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  },
  _focusVisible: { outline: 'none' },
  _disabled: { cursor: 'not-allowed', opacity: 0.5 },
})

const only = css({
  // A taller target than its line of text, within the row.
  alignSelf: 'stretch',
  display: 'grid',
  placeItems: 'center',
  px: '1',
  fontFamily: 'mono',
  fontSize: '2xs',
  color: 'signal',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  borderRadius: '6px',
  cursor: 'pointer',
  opacity: 0,
  pointerEvents: 'none',
  transition: 'opacity 140ms',
  _focusVisible: { opacity: 1, outline: '2px solid', outlineColor: 'signal' },
})

/** A phone's screen, where the list opens in a sheet (false while rendering on the server). */
function usePhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 47.99rem)')
    const update = () => setPhone(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return phone
}

/** What the chip says: every brand, one, a few, or every one but a few. */
function summary(options: Option[], selected: Set<string> | null, locale: Locale) {
  if (!selected) return m.allBrands[locale]
  const kept = options.filter((o) => selected.has(o.id))
  const left = options.filter((o) => !selected.has(o.id))
  if (kept.length === 1 && kept[0]) return kept[0].name
  if (kept.length <= left.length) return m.brandCount(kept.length, locale)
  if (left.length === 1 && left[0]) return m.allBut(left[0].name, locale)
  return m.allBut(m.brandCount(left.length, locale), locale)
}

export function BrandFilter({
  options,
  selected,
  open,
  locale,
  onOpenChange,
  onChange,
  onHover,
}: Props) {
  const root = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  /** How far left the list moves to stay on a narrow screen. */
  const [shift, setShift] = useState(0)
  const listId = useId()
  const shown = selected?.size ?? options.length
  const phone = usePhone()
  const said = summary(options, selected, locale)
  const saidNow = useRef(said)
  saidNow.current = said
  // Taking over from the last category's chip, which said something else: the words fade in.
  const [arriving] = useState(
    () =>
      typeof window !== 'undefined' &&
      lastSaid != null &&
      performance.now() - lastSaid.at < HANDOFF_MS &&
      lastSaid.words !== said,
  )
  useEffect(
    () => () => {
      lastSaid = { words: saidNow.current, at: performance.now() }
    },
    [],
  )

  // Escape or a press anywhere else folds the list away; the pointer leaves its brand behind. A
  // phone's sheet folds away on its own.
  useEffect(() => {
    if (!open || phone) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onOpenChange(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onOpenChange(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', key)
    }
  }, [open, phone, onOpenChange])
  // It hangs from the chip, moved left as much as a narrow screen needs.
  useIsoLayoutEffect(() => {
    const el = list.current
    const from = root.current?.getBoundingClientRect().left
    if (!open || !el || from == null) return
    setShift(Math.min(0, window.innerWidth - EDGE - (from + el.offsetWidth)))
  }, [open])
  useEffect(() => {
    // Not under a finger: the keyboard would come up over the list before anyone asked for it.
    if (open) {
      if (!window.matchMedia('(pointer: coarse)').matches)
        search.current?.focus({ preventScroll: true })
    } else {
      setQuery('')
      onHover(null)
    }
  }, [open, onHover])

  const toggle = (id: string) => {
    const kept = new Set(selected ?? options.map((o) => o.id))
    if (kept.has(id)) kept.delete(id)
    else kept.add(id)
    if (!kept.size) return
    onChange(
      kept.size === options.length ? null : options.filter((o) => kept.has(o.id)).map((o) => o.id),
    )
  }

  const needle = query.trim().toLowerCase()
  const listed = needle ? options.filter((o) => o.name.toLowerCase().includes(needle)) : options

  // The list's head: how many brands show, and the way back to all of them.
  const head = (
    <div className={css({ display: 'flex', alignItems: 'baseline', gap: '2' })}>
      <span className={caption}>{m.brands[locale]}</span>
      <span className={cx(caption, css({ color: 'ink.muted' }))}>
        {m.brandsShown(shown, options.length, locale)}
      </span>
      <button
        type="button"
        disabled={!selected}
        onClick={() => onChange(null)}
        className={css({
          ml: 'auto',
          fontSize: 'xs',
          fontWeight: '550',
          cursor: 'pointer',
          _hover: { textDecoration: 'underline' },
          _disabled: { color: 'ink.faint', cursor: 'default', textDecoration: 'none' },
          _focusVisible: { outline: '2px solid', outlineColor: 'signal' },
        })}
      >
        {m.showAllBrands[locale]}
      </button>
    </div>
  )
  const searchField =
    options.length >= SEARCH_FROM ? (
      <div className={css({ px: '3', pb: '2' })}>
        <input
          ref={search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={m.findBrand[locale]}
          aria-label={m.findBrand[locale]}
          className={css({
            w: '100%',
            h: { base: '10', md: '8' },
            px: '3',
            borderRadius: 'pill',
            borderWidth: '1px',
            borderColor: 'line',
            bg: 'surface',
            // 16 px on a phone: a smaller field makes iOS zoom the page in on focus.
            fontSize: { base: 'md', md: 'sm' },
            outline: 'none',
            _focus: { borderColor: 'ink' },
            _placeholder: { color: 'ink.faint' },
          })}
        />
      </div>
    ) : (
      <span />
    )
  const brandList = (
    <ul
      aria-label={m.brands[locale]}
      className={css({
        minH: '0',
        // In a phone's sheet, the sheet itself scrolls.
        overflowY: { base: 'visible', md: 'auto' },
        overscrollBehavior: 'contain',
        scrollbarWidth: 'thin',
        px: '1.5',
        pb: '1.5',
      })}
    >
      {listed.map((o) => {
        const checked = !selected || selected.has(o.id)
        const last = checked && shown === 1
        return (
          <li
            key={o.id}
            className={row}
            data-empty={o.count === 0 ? '' : undefined}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(o.id)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(null)}
          >
            <label
              className={css({
                alignSelf: 'stretch',
                display: 'flex',
                alignItems: 'center',
                gap: '2.5',
                minW: '0',
                cursor: 'pointer',
              })}
            >
              <input
                type="checkbox"
                className={box}
                checked={checked}
                disabled={last}
                onChange={() => toggle(o.id)}
              />
              <span className={css({ truncate: true })}>{o.name}</span>
            </label>
            <button
              type="button"
              data-only
              className={only}
              aria-label={m.onlyBrandOf(o.name, locale)}
              onClick={() => onChange([o.id])}
            >
              {m.onlyBrand[locale]}
            </button>
            <span
              className={css({
                fontFamily: 'mono',
                fontSize: '2xs',
                color: 'ink.faint',
                fontVariantNumeric: 'tabular-nums',
              })}
            >
              {String(o.count).padStart(3, '0')}
            </span>
          </li>
        )
      })}
      {!listed.length && (
        <li className={css({ px: '3', py: '2', fontSize: 'sm', color: 'ink.muted' })}>
          {m.noBrandFound[locale]}
        </li>
      )}
    </ul>
  )

  return (
    <span ref={root} className={css({ position: 'relative', display: 'inline-flex', gap: '1' })}>
      <button
        ref={trigger}
        type="button"
        className={chip}
        data-filtered={selected ? '' : undefined}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => onOpenChange(!open)}
      >
        <span className={caption}>{m.brands[locale]}</span>
        <span data-arrive={arriving || undefined} className={arrive}>
          {said}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={css({
            color: 'ink.muted',
            transition: 'transform 200ms',
            '[aria-expanded=true] > &': { transform: 'rotate(180deg)' },
          })}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {selected && (
        <button
          type="button"
          aria-label={m.allBrandsAgain[locale]}
          title={m.allBrandsAgain[locale]}
          onClick={() => onChange(null)}
          className={css({
            display: 'grid',
            placeItems: 'center',
            w: '7',
            h: '7',
            _coarse: { w: '9', h: '9' },
            borderRadius: 'full',
            color: 'ink.muted',
            cursor: 'pointer',
            pointerEvents: 'auto',
            _hover: { color: 'ink', bg: 'ink/6' },
            _focusVisible: { outline: '2px solid', outlineColor: 'signal' },
          })}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}

      {open && !phone && (
        <div ref={list} id={listId} data-keep-clear className={panel} style={{ left: shift }}>
          <div className={css({ px: '4', pt: '3.5', pb: '2' })}>{head}</div>
          {searchField}
          {brandList}
        </div>
      )}
      {open && phone && (
        <Sheet label={m.brands[locale]} title={head} onClose={() => onOpenChange(false)}>
          <div id={listId} className={css({ pt: '1' })}>
            {searchField}
            {brandList}
          </div>
        </Sheet>
      )}
    </span>
  )
}
