import { useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { gsap, prefersReducedMotion, useGSAP } from '../motion/gsap'
import { motion } from '../motion/tokens'
import { type CloudLayout, type DotState, hash01, VIEW } from './layout'

// The catalogue as a cloud of dots, one per product. React renders the first layout (so the
// server-side HTML already shows it); after that GSAP owns the positions and tweens every dot to
// its next place, which is what makes each answer visibly reorganise the catalogue.

const FILL: Record<DotState, string> = {
  out: '#C9C5BB',
  in: '#625E56',
  dim: '#BDB8AE',
  sel: '#141414',
  hot: '#FF5A1F',
}
const OPACITY: Record<DotState, number> = { out: 0.5, in: 0.9, dim: 0.75, sel: 1, hot: 1 }
const LABEL_FILL = {
  sel: '#141414',
  hot: '#FF5A1F',
  dim: '#A8A399',
  in: '#45423C',
  dead: '#C9C5BB',
} as const

export function DataCloud({ layout, layoutKey }: { layout: CloudLayout; layoutKey: string }) {
  const root = useRef<SVGSVGElement>(null)
  const dots = useRef(new Map<string, SVGCircleElement>())
  const rings = useRef<(SVGGElement | null)[]>([])
  const [initial] = useState(layout)
  const first = useRef(true)
  const lastKey = useRef(layoutKey)

  useGSAP(
    () => {
      const reduce = prefersReducedMotion() || first.current
      first.current = false
      // A new question moves the whole cloud; a hover or a pick within the question only recolours it.
      const moving = lastKey.current !== layoutKey
      lastKey.current = layoutKey
      const duration = moving ? motion.slow : motion.fast
      for (const dot of layout.dots) {
        const el = dots.current.get(dot.id)
        if (!el) continue
        const to = {
          attr: { cx: dot.x, cy: dot.y, r: dot.r },
          fill: FILL[dot.state],
          opacity: OPACITY[dot.state],
        }
        if (reduce) gsap.set(el, to)
        else
          gsap.to(el, {
            ...to,
            duration,
            ease: motion.ease,
            delay: moving ? hash01(dot.id) * 0.2 : 0,
            overwrite: 'auto',
          })
      }
      const top = layout.dots.filter((d) => d.rank != null && d.rank < 3 && d.state !== 'out')
      rings.current.forEach((ring, rank) => {
        if (!ring) return
        const dot = top.find((d) => d.rank === rank)
        const to = dot ? { x: dot.x, y: dot.y, opacity: 1 } : { opacity: 0 }
        if (reduce) gsap.set(ring, to)
        else
          gsap.to(ring, {
            ...to,
            duration,
            ease: motion.ease,
            delay: moving ? 0.1 + rank * 0.05 : 0,
            overwrite: 'auto',
          })
      })
    },
    { dependencies: [layout], scope: root },
  )

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      gsap.from('[data-cloud-label]', {
        opacity: 0,
        y: 8,
        duration: motion.base,
        ease: motion.ease,
        stagger: 0.03,
        delay: 0.25,
      })
    },
    { dependencies: [layoutKey], scope: root },
  )

  return (
    <svg
      ref={root}
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      className={css({ w: '100%', h: '100%', overflow: 'visible', userSelect: 'none' })}
    >
      {layout.baseline != null && (
        <line
          key={`base-${layoutKey}`}
          data-cloud-label
          x1={VIEW.w * 0.1}
          x2={VIEW.w * 0.9}
          y1={layout.baseline + 2}
          y2={layout.baseline + 2}
          stroke="#C9C5BB"
          strokeWidth={1}
        />
      )}
      {initial.dots.map((dot) => (
        <circle
          key={dot.id}
          ref={(el) => {
            if (el) dots.current.set(dot.id, el)
            else dots.current.delete(dot.id)
          }}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
          fill={FILL[dot.state]}
          opacity={OPACITY[dot.state]}
        />
      ))}
      {[0, 1, 2].map((rank) => {
        const dot = initial.dots.find((d) => d.rank === rank && d.state !== 'out')
        return (
          <g
            key={rank}
            ref={(el) => {
              rings.current[rank] = el
            }}
            transform={dot ? `translate(${dot.x} ${dot.y})` : undefined}
            opacity={dot ? 1 : 0}
          >
            <circle
              r={rank === 0 ? 13 : 11}
              fill="none"
              stroke={rank === 0 ? '#FF5A1F' : '#141414'}
              strokeWidth={rank === 0 ? 1.6 : 1}
            />
            <text
              x={rank === 0 ? 17 : 15}
              y={-9}
              fontFamily="var(--fonts-mono)"
              fontSize={11}
              fill={rank === 0 ? '#FF5A1F' : '#141414'}
            >
              {String(rank + 1).padStart(2, '0')}
            </text>
          </g>
        )
      })}
      {layout.labels.map((label) => (
        <g
          key={`${layoutKey}-${label.id}`}
          data-cloud-label
          transform={`translate(${label.x} ${label.y})`}
        >
          <text
            textAnchor="middle"
            fontSize={17}
            fontWeight={600}
            letterSpacing="-0.01em"
            fill={LABEL_FILL[label.tone]}
            style={{ transition: 'fill 200ms' }}
            textDecoration={label.tone === 'dead' ? 'line-through' : undefined}
          >
            {label.text}
          </text>
          <text
            y={19}
            textAnchor="middle"
            fontFamily="var(--fonts-mono)"
            fontSize={12}
            fill={label.tone === 'hot' ? '#FF5A1F' : '#858076'}
            style={{ transition: 'fill 200ms' }}
          >
            {String(label.count).padStart(3, '0')}
          </text>
        </g>
      ))}
      {layout.ticks.map((tick) => (
        <text
          key={`${layoutKey}-${tick.text}`}
          data-cloud-label
          x={tick.x}
          y={(layout.baseline ?? 0) + 22}
          textAnchor="middle"
          fontFamily="var(--fonts-mono)"
          fontSize={11}
          fill="#858076"
        >
          {tick.text}
        </text>
      ))}
    </svg>
  )
}
