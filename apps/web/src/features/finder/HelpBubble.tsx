import { type CSSProperties, type RefObject, useEffect, useRef } from 'react'
import { css } from 'styled-system/css'

// A question's explanation, out of the help button (ⓘ) and above the console, as tall as its text
// so it never scrolls. A popover: the browser lays it over everything (the dock's panel clips what
// overflows it) and folds it away on Escape or a press anywhere else, a tile included; the help
// button opens and closes it. Where a help defines terms ("**Mechanical**: …"), each term starts a
// line of a two-column list and the sentences before the first one introduce them. The bubble
// grows out of the button and fades back into it (styles.css, « Help bubble »).

type Props = {
  id: string
  /** The help in the visitor's language, its terms marked **like this**. */
  help: string
  /** The help button: the bubble's notch points at it. */
  anchor: RefObject<HTMLElement | null>
  onToggle: (open: boolean) => void
}

/** Room between the console and the bubble, and between the bubble and the screen's edges (px). */
const GAP = 12
const EDGE = 16
/** The bubble never climbs under the site header (px from the top). */
const TOP = 72
/** Its widest (px): 32rem, as in its styles. */
const WIDTH = 512

/** The help without its term marks, for screen readers. */
export const plainHelp = (help: string) => help.replace(/\*\*/g, '')

/** The help's introduction (what comes before its first term), then its terms and what they mean. */
export function helpParts(help: string) {
  const [intro = '', ...rest] = help.split(/\*\*(.+?)\*\*\s?:\s*/)
  const terms: { term: string; text: string }[] = []
  for (let i = 0; i + 1 < rest.length; i += 2) {
    terms.push({ term: rest[i] ?? '', text: (rest[i + 1] ?? '').trim() })
  }
  return { intro: intro.trim(), terms }
}

/**
 * Hangs the bubble above the console, its right edge on the console's (kept off the screen's
 * edges), its notch over the help button. Measured just before it opens and on resize: the bubble
 * grows upwards from there, so its own height is never needed.
 */
function place(bubble: HTMLElement, anchor: HTMLElement) {
  const frame = (anchor.closest('[data-dock-panel]') ?? anchor).getBoundingClientRect()
  const button = anchor.getBoundingClientRect()
  const vw = document.documentElement.clientWidth
  const width = Math.min(WIDTH, vw - 2 * EDGE)
  const right = Math.min(Math.max(EDGE - 4, vw - frame.right), vw - EDGE - width)
  const style = bubble.style
  style.setProperty('--bubble-right', `${right}px`)
  style.setProperty('--bubble-bottom', `${window.innerHeight - frame.top + GAP}px`)
  style.setProperty('--bubble-max-h', `${Math.max(160, frame.top - GAP - TOP)}px`)
  style.setProperty('--bubble-notch', `${vw - right - (button.left + button.width / 2)}px`)
}

const bubble = css({
  position: 'fixed',
  top: 'auto',
  left: 'auto',
  right: 'var(--bubble-right)',
  bottom: 'var(--bubble-bottom)',
  m: '0',
  p: '0',
  w: 'min(32rem, calc(100vw - 2rem))',
  overflow: 'visible',
  bg: 'surface.raised',
  color: 'ink',
  borderWidth: '1px',
  borderColor: 'line',
  borderRadius: 'card',
  boxShadow: 'panel',
  transformOrigin: 'calc(100% - var(--bubble-notch)) calc(100% + 6px)',
  // The notch, pointing down at the help button.
  _after: {
    content: '""',
    position: 'absolute',
    top: '100%',
    right: 'var(--bubble-notch)',
    w: '3',
    h: '3',
    mt: '-1.5',
    mr: '-1.5',
    bg: 'surface.raised',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderColor: 'line',
    transform: 'rotate(45deg)',
  },
})

/** What the bubble holds. It would only scroll on a screen too short for it. */
const body = css({
  display: 'grid',
  gap: '3',
  maxH: 'var(--bubble-max-h)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  p: { base: '4', md: '5' },
  borderRadius: 'inherit',
  fontSize: 'sm',
  lineHeight: '1.5',
})

const terms = css({
  display: 'grid',
  gridTemplateColumns: 'max-content minmax(0, 1fr)',
  columnGap: '4',
  rowGap: '2',
  m: '0',
})

export function HelpBubble({ id, help, anchor, onToggle }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const { intro, terms: list } = helpParts(help)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reposition = () => {
      if (anchor.current) place(el, anchor.current)
    }
    const before = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') reposition()
    }
    const toggled = (e: Event) => onToggle((e as ToggleEvent).newState === 'open')
    el.addEventListener('beforetoggle', before)
    el.addEventListener('toggle', toggled)
    window.addEventListener('resize', reposition)
    return () => {
      el.removeEventListener('beforetoggle', before)
      el.removeEventListener('toggle', toggled)
      window.removeEventListener('resize', reposition)
    }
  }, [anchor, onToggle])

  return (
    <div ref={root} id={id} popover="auto" data-help-bubble className={bubble}>
      <div className={body}>
        {intro && (
          <p data-line className={css({ color: 'ink.soft' })} style={{ '--i': 0 } as CSSProperties}>
            {intro}
          </p>
        )}
        {list.length > 0 && (
          <dl className={terms}>
            {list.map(({ term, text }, i) => (
              <div key={term} className={css({ display: 'contents' })}>
                <dt
                  data-line
                  className={css({ fontWeight: '600' })}
                  style={{ '--i': i + 1 } as CSSProperties}
                >
                  {term}
                </dt>
                <dd
                  data-line
                  className={css({ color: 'ink.soft' })}
                  style={{ '--i': i + 1 } as CSSProperties}
                >
                  {text}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}
