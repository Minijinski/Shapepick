import { css, cx } from 'styled-system/css'
import type { SpecCell } from './specs'

// One spec as the results, the sheet and the popup show it: its main value (39", 3440×1440),
// then what qualifies it as small tags (21:9, 800R; 96 PPI) rather than one run of text. Stacked
// in the columns of a list row, where a tag that does not fit on the line is left out whole;
// inline in a card's table.

const value = css({
  minW: '0',
  fontSize: 'sm',
  fontWeight: '550',
  lineHeight: '1.25',
  color: 'ink',
  fontVariantNumeric: 'tabular-nums',
  truncate: true,
})

const tags = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1',
  minW: '0',
})

/** Stacked under its value, the tags keep to one line: the ones that would wrap are hidden. */
const oneLine = css({ h: '5', overflow: 'hidden' })

const tag = css({
  display: 'inline-flex',
  alignItems: 'center',
  h: '5',
  px: '1',
  borderRadius: 'sm',
  bg: 'ink/5',
  color: 'ink.muted',
  fontFamily: 'mono',
  fontSize: '2xs',
  lineHeight: '1',
  letterSpacing: '0',
  whiteSpace: 'nowrap',
})

const stacked = css({ display: 'flex', flexDirection: 'column', gap: '1', minW: '0' })
const inline = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: '2',
  rowGap: '1',
  minW: '0',
})

export function SpecValue({
  cell,
  layout = 'stack',
}: {
  cell: SpecCell
  /** Value over its tags (a list row's column), or value then tags on one line (a card). */
  layout?: 'stack' | 'inline'
}) {
  if (!cell.value && !cell.details.length) return <span className={value}>—</span>
  return (
    <span className={layout === 'stack' ? stacked : inline}>
      {cell.value && <span className={value}>{cell.value}</span>}
      {cell.details.length > 0 && (
        <span className={cx(tags, layout === 'stack' && oneLine)}>
          {cell.details.map((detail) => (
            <span key={detail} className={tag}>
              {detail}
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
