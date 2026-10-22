// Prices are indicative: the site does not follow promotions or day-to-day changes (shop offers
// will, later), and the catalogue is refreshed weekly with `pnpm ingest prices`. So a product's
// price is the typical regular price of its configurations: promotions ignored (the struck-through
// price wins), median across variants, rounded to 5 €. A variant keeps a price of its own only when
// it is clearly apart (10 % or more), like a wooden edition or a barebone-plus-keycaps bundle.

/** EU prices include VAT, US ones do not: median EUR/USD gap on the 2815 Keychron SKUs sold on both
 * keychron.com and keychron.fr (1.22, October 2026), rounded. Used for US-only shops. */
export const EUR_PER_USD = 1.2

export const roundPrice = (eur: number) => Math.max(5, Math.round(eur / 5) * 5)

export function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2
}

/** Typical product price and, per variant, its own price only where it stands apart. */
export function priceVariants<V extends { msrpEur?: number }>(variants: V[]) {
  const known = variants.map((v) => v.msrpEur).filter((p): p is number => !!p)
  if (!known.length) return { msrpEur: undefined, variants }
  const msrpEur = roundPrice(median(known))
  return {
    msrpEur,
    variants: variants.map((v) => {
      const own = v.msrpEur && roundPrice(v.msrpEur)
      return { ...v, msrpEur: own && Math.abs(own - msrpEur) / msrpEur >= 0.1 ? own : undefined }
    }),
  }
}
