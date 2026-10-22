import type { CatalogItem, Locale } from '@choose/catalog'

// Where a product can be bought. For now one shop, Amazon.fr, through a search for the model: the
// exact product page needs Amazon's Product Advertising API, which a Partner account only opens
// after its first sales, and the site itself is never crawled. The partner tag makes these links
// affiliate ones; the product sheet then shows the notice Amazon requires.

/** Amazon Partenaires tracking ID ("monsite-21"): empty until the account is approved. */
export const AMAZON_PARTNER_TAG = ''

/**
 * The Amazon.fr search for a product: brand and model, plus "AZERTY" for a French visitor when the
 * board comes in that layout and the visitor's layout answer (if any) includes it.
 */
export function amazonSearch(item: CatalogItem, locale: Locale, layouts?: readonly string[]) {
  const named = item.name.toLowerCase().startsWith(item.brand.name.toLowerCase())
    ? item.name
    : `${item.brand.name} ${item.name}`
  const azerty =
    locale === 'fr' &&
    item.category === 'keyboard' &&
    item.variants.some((v) => v.layout === 'iso_fr') &&
    (!layouts?.length || layouts.includes('azerty'))
  const query = `${named.replace(/[()]/g, ' ')}${azerty ? ' AZERTY' : ''}`
    .replace(/\s+/g, ' ')
    .trim()
  const url = new URL('https://www.amazon.fr/s')
  url.searchParams.set('k', query)
  if (AMAZON_PARTNER_TAG) url.searchParams.set('tag', AMAZON_PARTNER_TAG)
  return { query, url: url.toString(), affiliate: AMAZON_PARTNER_TAG !== '' }
}
