import { css } from 'styled-system/css'

// The site's mark, drawn like the favicon (public/favicon.svg): an s cut out of an ink tile with
// two corners cut at 45°, its first stroke ending in the signal orange. Its 32 grid lands on whole
// pixels at 16 and 32 px.
export function Logo({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={css({ flexShrink: '0' })}
    >
      <path d="M6 0H32V26L26 32H0V6Z" className={css({ fill: 'ink' })} />
      <path
        d="M8 10L12 6H24V10H12V14H22L24 16V22L20 26H8V22H20V18H10L8 16Z"
        className={css({ fill: 'paper' })}
      />
      <path d="M20 6H24V10H20Z" className={css({ fill: 'signal' })} />
    </svg>
  )
}
