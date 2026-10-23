import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { createPortal } from 'react-dom'
import { css, cx } from 'styled-system/css'
import { button } from 'styled-system/recipes'
import { useLocale } from '~/i18n/locale'
import { messages as m } from '~/i18n/messages'
import { gsap, prefersReducedMotion } from '../motion/gsap'

// A sheet that rises from the bottom of a phone's screen over the page, for what a phone has no
// room to show beside it: the journey, the brands. Its handle can be pulled down to fold it away,
// as can Escape, the backdrop and its close button; focus moves into it, and back to whatever had
// it once it is gone. Clear of the iPhone's home indicator.

/** How far (px) the handle must be pulled, or how fast (px/ms), for the sheet to fold away. */
const PULL = { distance: 80, speed: 0.5 }

/**
 * Pulling a sheet down by its handle: it follows the finger, then folds away (`close`) or settles
 * back. Returns the handle's pointer-down handler.
 */
export function useSheetDrag(panel: RefObject<HTMLElement | null>, close: () => void) {
  return useCallback(
    (e: ReactPointerEvent) => {
      const el = panel.current
      if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return
      const start = { y: e.clientY, t: performance.now() }
      let last = { y: e.clientY, t: start.t }
      let speed = 0
      const move = (ev: PointerEvent) => {
        const dy = Math.max(0, ev.clientY - start.y)
        const now = performance.now()
        speed = (ev.clientY - last.y) / Math.max(8, now - last.t)
        last = { y: ev.clientY, t: now }
        el.style.transition = 'none'
        el.style.translate = `0 ${dy}px`
      }
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        const dy = Math.max(0, ev.clientY - start.y)
        el.style.transition = ''
        if (dy > PULL.distance || (dy > 12 && speed > PULL.speed)) close()
        else el.style.translate = ''
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [panel, close],
  )
}

/**
 * Folds a sheet away (down and out, its backdrop fading), then calls `then`. A timer backs the
 * animation up: in a hidden tab the browser pauses animation frames.
 */
export function foldAway(
  panel: HTMLElement | null,
  backdrop: HTMLElement | null,
  then: () => void,
  wide = false,
) {
  if (!panel || prefersReducedMotion() || document.hidden) return then()
  let done = false
  const finish = () => {
    if (done) return
    done = true
    then()
  }
  gsap.set([panel, backdrop], { animation: 'none' })
  gsap.to(panel, {
    ...(wide ? { x: 48 } : { y: 80 }),
    opacity: 0,
    duration: 0.28,
    ease: 'power3.in',
    onComplete: finish,
  })
  if (backdrop) gsap.to(backdrop, { opacity: 0, duration: 0.28 })
  window.setTimeout(finish, 480)
}

const backdropStyle = css({
  position: 'fixed',
  inset: '0',
  zIndex: '40',
  bg: 'rgba(243, 241, 236, 0.55)',
  backdropFilter: 'blur(2px)',
  animation: 'fadeIn 0.3s ease backwards',
  _motionReduce: { animation: 'none' },
})

const panelStyle = css({
  position: 'fixed',
  zIndex: '41',
  left: 'max(0.5rem, env(safe-area-inset-left))',
  right: 'max(0.5rem, env(safe-area-inset-right))',
  bottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
  maxH: '85dvh',
  display: 'flex',
  flexDirection: 'column',
  bg: 'surface.raised',
  borderRadius: 'panel',
  borderWidth: '1px',
  borderColor: 'line',
  boxShadow: '0 1px 0 rgba(20,20,20,0.04), 0 40px 90px -30px rgba(20,20,20,0.4)',
  overflow: 'hidden',
  outline: 'none',
  transition: 'translate 320ms token(easings.signal)',
  animation: 'sheetUp 0.5s token(easings.signal) backwards',
  _motionReduce: { animation: 'none', transition: 'none' },
})

/** The handle and the title: a press there and a pull down folds the sheet away. */
const grip = css({
  flexShrink: '0',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: '2',
  pt: '5',
  pb: '2',
  pl: '5',
  pr: '3',
  touchAction: 'none',
  cursor: 'grab',
  position: 'relative',
  _before: {
    content: '""',
    position: 'absolute',
    top: '2',
    left: '50%',
    w: '9',
    h: '1',
    ml: '-4.5',
    borderRadius: 'full',
    bg: 'line',
  },
})

export function Sheet({
  title,
  label,
  onClose,
  children,
}: {
  /** What heads the sheet, beside its close button. */
  title: ReactNode
  /** Its name, for screen readers. */
  label: string
  onClose: () => void
  /** What it holds; given `fold`, a choice made in it can fold the sheet away as it applies. */
  children: ReactNode | ((fold: () => void) => ReactNode)
}) {
  const locale = useLocale()
  const panel = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const closing = useRef(false)

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    foldAway(panel.current, backdrop.current, onClose)
  }, [onClose])
  const pull = useSheetDrag(panel, close)

  // Focus moves into the sheet and back to whatever had it once the sheet is gone.
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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <div ref={backdrop} aria-hidden onClick={close} className={backdropStyle} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={panelStyle}
      >
        <div className={grip} onPointerDown={pull}>
          <div className={css({ minW: '0' })}>{title}</div>
          <button
            type="button"
            className={cx(button({ tone: 'ghost', size: 'icon' }), css({ color: 'ink.muted' }))}
            aria-label={m.close[locale]}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={close}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div
          className={css({
            flex: '1',
            minH: '0',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            scrollbarWidth: 'thin',
          })}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      </div>
    </>,
    document.body,
  )
}
