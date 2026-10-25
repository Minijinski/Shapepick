import { defineConfig, defineRecipe, defineSlotRecipe } from "@pandacss/dev";
import { radii } from "./src/styles/radii";

// "Labo clair": paper, ink, technical greys and a single signal orange used sparingly (selection,
// the live counter, the top match). Numbers, units and labels are set in mono.

const button = defineRecipe({
  className: "button",
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "2",
    fontWeight: "550",
    letterSpacing: "-0.01em",
    borderRadius: "pill",
    cursor: "pointer",
    transition:
      "background 160ms, color 160ms, border-color 160ms, transform 160ms",
    _active: { transform: "scale(0.98)" },
    _disabled: { opacity: 0.4, cursor: "not-allowed" },
    _focusVisible: {
      outline: "2px solid",
      outlineColor: "signal",
      outlineOffset: "2px",
    },
  },
  variants: {
    tone: {
      ink: { bg: "ink", color: "paper", _hover: { bg: "ink.soft" } },
      ghost: { bg: "transparent", color: "ink", _hover: { bg: "ink/6" } },
      line: {
        bg: "transparent",
        color: "ink",
        borderWidth: "1px",
        borderColor: "line.strong",
        _hover: { borderColor: "ink" },
      },
      // An answer that keeps everything ("No preference"): dashed like a question still ahead on
      // the journey bar, drawn in full under the pointer.
      dashed: {
        bg: "transparent",
        color: "ink",
        borderWidth: "1px",
        borderStyle: "dashed",
        borderColor: "line.strong",
        _hover: { borderStyle: "solid", borderColor: "ink" },
      },
    },
    size: {
      sm: { h: "8", px: "3", fontSize: "sm" },
      md: { h: "11", px: "5", fontSize: "md" },
      // A finger needs a larger target than a pointer.
      icon: { h: "9", w: "9", p: "0", _coarse: { h: "10", w: "10" } },
    },
  },
  defaultVariants: { tone: "ink", size: "md" },
});

const optionTile = defineSlotRecipe({
  className: "option-tile",
  slots: ["root", "label", "hint", "count", "tick", "blocked", "change"],
  base: {
    // A phone lists the answers one per row: the words (name and hint), then the picture and the
    // count at the end. Wider, a tile: the words at the top, the count in its bottom corner.
    root: {
      position: "relative",
      display: "flex",
      flexDirection: { base: "row", md: "column" },
      alignItems: { base: "center", md: "flex-start" },
      justifyContent: { base: "flex-start", md: "space-between" },
      gap: { base: "3", md: "1.5" },
      minH: { base: "13", md: "20" },
      p: "3",
      textAlign: "left",
      bg: "surface",
      borderRadius: "card",
      borderWidth: "1px",
      borderColor: "line",
      cursor: "pointer",
      transition: "border-color 160ms, background 160ms, box-shadow 160ms",
      _hover: { borderColor: "line.strong", bg: "surface.raised" },
      _focusVisible: {
        outline: "2px solid",
        outlineColor: "signal",
        outlineOffset: "2px",
      },
      "&[aria-pressed=true]": {
        borderColor: "ink",
        boxShadow: "inset 0 0 0 1px token(colors.ink)",
      },
      // A tile that would leave nothing: a block rather than a button, it only says why.
      "&[aria-disabled=true], &[data-dead]": {
        cursor: "help",
        bg: "transparent",
        borderStyle: "dashed",
        color: "ink.faint",
      },
    },
    label: {
      fontWeight: "600",
      fontSize: { base: "sm", md: "0.9375rem" },
      lineHeight: "1.2",
      letterSpacing: "-0.01em",
    },
    hint: {
      display: "block",
      fontSize: "xs",
      color: "ink.muted",
      lineHeight: "1.25",
      // A phone's row grows with its hint. A tile holds two lines without growing, the count at
      // the end of the last one.
      lineClamp: { base: "none", md: "2" },
      pr: { base: "0", md: "7" },
    },
    count: {
      position: { base: "static", md: "absolute" },
      order: { base: "2", md: "0" },
      flexShrink: "0",
      ml: { base: "auto", md: "0" },
      bottom: { md: "3" },
      right: { md: "3" },
      fontFamily: "mono",
      fontSize: "2xs",
      color: "ink.faint",
      fontVariantNumeric: "tabular-nums",
    },
    tick: {
      position: "absolute",
      top: "-2",
      right: "-2",
      w: "5",
      h: "5",
      borderRadius: "full",
      bg: "signal",
      color: "white",
      display: "grid",
      placeItems: "center",
    },
    // What blocks a dead tile, then the way back to that question: one line when the tile is
    // wide enough, the link wraps below when it is not (the tile's row grows).
    blocked: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      columnGap: "2",
      rowGap: "0.5",
      fontSize: "2xs",
      color: "ink.muted",
      fontFamily: "mono",
      lineHeight: "1.35",
    },
    change: {
      ml: "auto",
      fontFamily: "mono",
      fontSize: "2xs",
      color: "signal",
      textDecoration: "underline",
      textUnderlineOffset: "3px",
      borderRadius: "pill",
      cursor: "pointer",
      _focusVisible: {
        outline: "2px solid",
        outlineColor: "signal",
        outlineOffset: "2px",
      },
    },
  },
});

const chip = defineRecipe({
  className: "chip",
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "1.5",
    h: "7",
    px: "2.5",
    borderRadius: "pill",
    fontSize: "xs",
    whiteSpace: "nowrap",
    bg: "surface",
    borderWidth: "1px",
    borderColor: "line",
    color: "ink",
    cursor: "pointer",
    transition: "border-color 160ms",
    _hover: { borderColor: "ink" },
  },
});

export default defineConfig({
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],
  preflight: true,
  include: ["./src/**/*.{ts,tsx}"],
  exclude: ["./src/paraglide/**"],
  outdir: "styled-system",
  jsxFramework: "react",
  strictTokens: false,
  conditions: {
    extend: {
      // Hover styles only where something can hover: on a touch screen, `:hover` sticks to
      // whatever was tapped last (a tile stays lit, a button stays dark).
      hover: {
        "@media (hover: hover)": { "&:is(:hover, [data-hover])": "@slot" },
      },
      groupHover: {
        "@media (hover: hover)": {
          ".group:is(:hover, [data-hover]) &": "@slot",
        },
      },
      /** A finger rather than a mouse: larger targets. */
      coarse: "@media (pointer: coarse)",
      /** A phone on its side, or any screen this short: the finder compacts. */
      short: "@media (max-height: 30rem)",
      /**
       * A screen wide and tall enough for the home's tilted slats; narrower or shorter, rows
       * (features/scene/geometry.ts, `bandsInRows`).
       */
      slats: "@media (min-width: 48rem) and (min-height: 30.01rem)",
    },
  },
  globalCss: {
    html: {
      bg: "paper",
      color: "ink",
      fontFamily: "sans",
      WebkitFontSmoothing: "antialiased",
      textRendering: "optimizeLegibility",
    },
    // An app surface, not a document: a press-and-drag browses the canvas, it never selects text
    // or picks up a link or a drawing.
    body: {
      bg: "paper",
      minH: "100dvh",
      overflowX: "hidden",
      userSelect: "none",
    },
    "input, textarea, select, [contenteditable]": { userSelect: "text" },
    "a, img, svg": { WebkitUserDrag: "none" },
    "::selection": { bg: "signal", color: "white" },
    "button, [role=button]": { WebkitTapHighlightColor: "transparent" },
  },
  theme: {
    extend: {
      tokens: {
        colors: {
          paper: { value: "#F3F1EC" },
          ink: { value: "#141414" },
          signal: { value: "#FF5A1F" },
          white: { value: "#FFFFFF" },
          grey: {
            50: { value: "#F8F7F4" },
            100: { value: "#ECEAE4" },
            200: { value: "#DEDBD3" },
            300: { value: "#C9C5BB" },
            400: { value: "#A8A399" },
            500: { value: "#858076" },
            600: { value: "#625E56" },
            700: { value: "#45423C" },
          },
        },
        fonts: {
          sans: {
            value:
              "'Hubot Sans Variable', 'Hubot Sans', ui-sans-serif, system-ui, sans-serif",
          },
          mono: {
            value:
              "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'SF Mono', monospace",
          },
        },
        fontSizes: {
          "2xs": { value: "0.6875rem" },
          display: { value: "clamp(3rem, 2rem + 5vw, 6.5rem)" },
        },
        // Three corner shapes for the whole site (src/styles/radii.ts, shared with the canvas).
        radii: {
          panel: { value: `${radii.panel}px` },
          card: { value: `${radii.card}px` },
          pill: { value: "9999px" },
        },
        easings: {
          signal: { value: "cubic-bezier(0.22, 1, 0.36, 1)" },
        },
      },
      // Entrances run in CSS so they start with the server HTML (no flash before hydration).
      // They fill backwards only: once played, GSAP is free to animate the same elements out.
      keyframes: {
        // A whole line plus half an em below its slot: accents and overhangs stay hidden too.
        wordUp: {
          from: { transform: "translateY(calc(100% + 0.5em))" },
          to: { transform: "translateY(0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-28px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(40px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        // The question console rises like a lid hinged on its bottom edge.
        dockRise: {
          from: {
            opacity: "0",
            transform:
              "perspective(1400px) translateY(110px) rotateX(42deg) scale(0.94)",
            filter: "blur(12px)",
          },
          "55%": { opacity: "1", filter: "blur(0px)" },
          to: {
            opacity: "1",
            transform:
              "perspective(1400px) translateY(0) rotateX(0deg) scale(1)",
            filter: "blur(0px)",
          },
        },
        cardIn: {
          from: { opacity: "0", transform: "translateY(6px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        // The match ring fills from empty when it appears (`--ring` = its circumference).
        ringDraw: { from: { strokeDashoffset: "var(--ring)" } },
        // The best match shows once what hovering it does: its drawing lifts, its price makes way
        // for "View details" (Podium).
        hintLift: {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "30%, 70%": { transform: "translateY(-3px) scale(1.06)" },
        },
        hintOut: {
          "0%, 100%": { transform: "translateY(0)" },
          "25%, 75%": { transform: "translateY(-115%)" },
        },
        hintIn: {
          "0%, 100%": { transform: "translateY(115%)" },
          "25%, 75%": { transform: "translateY(0)" },
        },
        nudge: {
          "0%, 60%, 100%": { transform: "translateX(0)" },
          "30%": { transform: "translateX(3px)" },
        },
        // The product sheet slides in from the right edge, or up from the bottom on phones.
        sheetIn: {
          from: { opacity: "0", transform: "translateX(48px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        sheetUp: {
          from: { opacity: "0", transform: "translateY(80px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        lineDraw: {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      semanticTokens: {
        colors: {
          surface: {
            DEFAULT: { value: "{colors.grey.50}" },
            raised: { value: "{colors.white}" },
          },
          line: {
            DEFAULT: { value: "{colors.grey.200}" },
            strong: { value: "{colors.grey.400}" },
          },
          ink: {
            soft: { value: "{colors.grey.700}" },
            muted: { value: "{colors.grey.600}" },
            faint: { value: "{colors.grey.400}" },
          },
        },
        shadows: {
          panel: {
            value:
              "0 1px 0 rgba(20,20,20,0.04), 0 24px 60px -24px rgba(20,20,20,0.22)",
          },
        },
      },
      recipes: { button, chip },
      slotRecipes: { optionTile },
    },
  },
});
