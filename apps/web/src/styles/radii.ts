// Corner radii, in px, shared by the Panda tokens (panda.config.ts) and the canvas (features/scene),
// so a panel drawn on the canvas and one laid out in the page round their corners alike. Three
// shapes only: panels, the cards and tiles inside or beside them, and pills for controls.

export const radii = {
  /** Large surfaces: the console, the results, the product sheet, the home panels and plates. */
  panel: 22,
  /** Cards, tiles and rows: inside a panel, stacked beside one, or floating over the canvas. */
  card: 14,
} as const
