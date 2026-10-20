import { defineConfig, defineRecipe, defineSlotRecipe } from '@pandacss/dev'

// "Labo clair": paper, ink, technical greys and a single signal orange used sparingly (selection,
// the live counter, the top match). Numbers, units and labels are set in mono.

const button = defineRecipe({
  className: 'button',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    fontWeight: '550',
    letterSpacing: '-0.01em',
    borderRadius: 'full',
    cursor: 'pointer',
    transition: 'background 160ms, color 160ms, transform 160ms',
    _active: { transform: 'scale(0.98)' },
    _disabled: { opacity: 0.4, cursor: 'not-allowed' },
    _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
  },
  variants: {
    tone: {
      ink: { bg: 'ink', color: 'paper', _hover: { bg: 'ink.soft' } },
      ghost: { bg: 'transparent', color: 'ink', _hover: { bg: 'ink/6' } },
      line: {
        bg: 'transparent',
        color: 'ink',
        borderWidth: '1px',
        borderColor: 'line.strong',
        _hover: { borderColor: 'ink' },
      },
    },
    size: {
      sm: { h: '8', px: '3', fontSize: 'sm' },
      md: { h: '11', px: '5', fontSize: 'md' },
      icon: { h: '9', w: '9', p: '0' },
    },
  },
  defaultVariants: { tone: 'ink', size: 'md' },
})

const optionTile = defineSlotRecipe({
  className: 'option-tile',
  slots: ['root', 'visual', 'label', 'hint', 'count', 'tick', 'blocked'],
  base: {
    root: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '1.5',
      minH: { base: '16', md: '20' },
      p: '3',
      textAlign: 'left',
      bg: 'surface',
      borderRadius: 'lg',
      borderWidth: '1px',
      borderColor: 'line',
      cursor: 'pointer',
      transition: 'border-color 160ms, background 160ms, box-shadow 160ms',
      _hover: { borderColor: 'line.strong', bg: 'surface.raised' },
      _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
      '&[aria-pressed=true]': {
        borderColor: 'ink',
        boxShadow: 'inset 0 0 0 1px token(colors.ink)',
      },
      '&[aria-disabled=true]': {
        cursor: 'help',
        bg: 'transparent',
        borderStyle: 'dashed',
        color: 'ink.faint',
      },
    },
    visual: {
      color: 'ink.muted',
      h: { base: '7', md: '8' },
      w: '100%',
      display: 'flex',
      alignItems: 'flex-end',
    },
    label: {
      fontWeight: '600',
      fontSize: { base: 'sm', md: '0.9375rem' },
      lineHeight: '1.2',
      letterSpacing: '-0.01em',
    },
    hint: {
      display: { base: 'none', md: 'block' },
      fontSize: 'xs',
      color: 'ink.muted',
      lineHeight: '1.25',
      // One line, always: the console keeps the same height whatever the options say. The count
      // sits at the end of this line.
      truncate: true,
      pr: '7',
    },
    count: {
      position: 'absolute',
      bottom: '3',
      right: '3',
      fontFamily: 'mono',
      fontSize: '2xs',
      color: 'ink.faint',
      fontVariantNumeric: 'tabular-nums',
    },
    tick: {
      position: 'absolute',
      top: '-2',
      right: '-2',
      w: '5',
      h: '5',
      borderRadius: 'full',
      bg: 'signal',
      color: 'white',
      display: 'grid',
      placeItems: 'center',
    },
    blocked: { fontSize: '2xs', color: 'ink.muted', fontFamily: 'mono', lineHeight: '1.35' },
  },
})

const chip = defineRecipe({
  className: 'chip',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1.5',
    h: '7',
    px: '2.5',
    borderRadius: 'full',
    fontSize: 'xs',
    whiteSpace: 'nowrap',
    bg: 'surface',
    borderWidth: '1px',
    borderColor: 'line',
    color: 'ink',
    cursor: 'pointer',
    transition: 'border-color 160ms',
    _hover: { borderColor: 'ink' },
  },
})

export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda'],
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: ['./src/paraglide/**'],
  outdir: 'styled-system',
  jsxFramework: 'react',
  strictTokens: false,
  globalCss: {
    html: {
      bg: 'paper',
      color: 'ink',
      fontFamily: 'sans',
      WebkitFontSmoothing: 'antialiased',
      textRendering: 'optimizeLegibility',
    },
    body: { bg: 'paper', minH: '100dvh', overflowX: 'hidden' },
    '::selection': { bg: 'signal', color: 'white' },
    'button, [role=button]': { WebkitTapHighlightColor: 'transparent' },
  },
  theme: {
    extend: {
      tokens: {
        colors: {
          paper: { value: '#F3F1EC' },
          ink: { value: '#141414' },
          signal: { value: '#FF5A1F' },
          white: { value: '#FFFFFF' },
          grey: {
            50: { value: '#F8F7F4' },
            100: { value: '#ECEAE4' },
            200: { value: '#DEDBD3' },
            300: { value: '#C9C5BB' },
            400: { value: '#A8A399' },
            500: { value: '#858076' },
            600: { value: '#625E56' },
            700: { value: '#45423C' },
          },
        },
        fonts: {
          sans: {
            value: "'Inter Tight Variable', 'Inter Tight', ui-sans-serif, system-ui, sans-serif",
          },
          mono: {
            value: "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'SF Mono', monospace",
          },
        },
        fontSizes: {
          '2xs': { value: '0.6875rem' },
          display: { value: 'clamp(3rem, 2rem + 5vw, 6.5rem)' },
        },
        radii: { lg: { value: '14px' }, xl: { value: '22px' } },
        easings: {
          signal: { value: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        },
      },
      // Entrances run in CSS so they start with the server HTML (no flash before hydration).
      // They fill backwards only: once played, GSAP is free to animate the same elements out.
      keyframes: {
        wordUp: { from: { transform: 'translateY(105%)' }, to: { transform: 'translateY(0)' } },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-28px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(40px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        // The question console rises like a lid hinged on its bottom edge.
        dockRise: {
          from: {
            opacity: '0',
            transform: 'perspective(1400px) translateY(110px) rotateX(42deg) scale(0.94)',
            filter: 'blur(12px)',
          },
          '55%': { opacity: '1', filter: 'blur(0px)' },
          to: {
            opacity: '1',
            transform: 'perspective(1400px) translateY(0) rotateX(0deg) scale(1)',
            filter: 'blur(0px)',
          },
        },
        cardIn: {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        lineDraw: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
      },
      semanticTokens: {
        colors: {
          surface: { DEFAULT: { value: '{colors.grey.50}' }, raised: { value: '{colors.white}' } },
          line: { DEFAULT: { value: '{colors.grey.200}' }, strong: { value: '{colors.grey.400}' } },
          ink: {
            soft: { value: '{colors.grey.700}' },
            muted: { value: '{colors.grey.600}' },
            faint: { value: '{colors.grey.400}' },
          },
        },
        shadows: {
          panel: { value: '0 1px 0 rgba(20,20,20,0.04), 0 24px 60px -24px rgba(20,20,20,0.22)' },
        },
      },
      recipes: { button, chip },
      slotRecipes: { optionTile },
    },
  },
})
