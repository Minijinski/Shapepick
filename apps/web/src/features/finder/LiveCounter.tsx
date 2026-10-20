import { useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { gsap, prefersReducedMotion, useGSAP } from '../motion/gsap'
import { motion } from '../motion/tokens'

// The signature readout: how many products are left, ticking down with every answer. React
// renders the first value (server HTML), GSAP rolls the digits after that.

const digits = (n: number) => {
  const s = String(Math.max(0, Math.round(n))).padStart(4, '0')
  return `${s.slice(0, 1)} ${s.slice(1)}`
}

type Props = {
  value: number
  total: number
  label: string
  preview: number | null
  previewLabel: string
  ofLabel: string
}

export function LiveCounter({ value, total, label, preview, previewLabel, ofLabel }: Props) {
  const number = useRef<HTMLSpanElement>(null)
  const [initial] = useState(value)
  const shown = useRef({ v: value })

  useGSAP(
    () => {
      const el = number.current
      if (!el) return
      if (prefersReducedMotion()) {
        shown.current.v = value
        el.textContent = digits(value)
        return
      }
      gsap.to(shown.current, {
        v: value,
        duration: motion.slow,
        ease: motion.ease,
        overwrite: true,
        onUpdate: () => {
          el.textContent = digits(shown.current.v)
        },
      })
    },
    { dependencies: [value] },
  )

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
      <div className={css({ display: 'flex', alignItems: 'baseline', gap: '3' })}>
        <span
          ref={number}
          aria-live="polite"
          className={css({
            fontFamily: 'mono',
            fontSize: { base: '4xl', md: '6xl' },
            lineHeight: '0.9',
            letterSpacing: '-0.04em',
            fontVariantNumeric: 'tabular-nums',
            color: value === 0 ? 'ink.faint' : 'ink',
          })}
        >
          {digits(initial)}
        </span>
        <span className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'ink.faint' })}>
          {ofLabel} {total}
        </span>
      </div>
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '3',
          fontSize: 'sm',
          color: 'ink.muted',
          minH: '5',
        })}
      >
        <span>{label}</span>
        {preview != null && preview !== value && (
          <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'signal' })}>
            → {preview} {previewLabel}
          </span>
        )}
      </div>
    </div>
  )
}
