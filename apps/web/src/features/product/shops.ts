import type { CatalogItem, Locale } from '@choose/catalog'

// Where a product can be bought. For now one shop, Amazon.fr: the product page when the data gives
// its ASIN (the AZERTY version when the model has one), otherwise a search for the model. ASINs are
// read from search-engine results, never from Amazon itself, which is not crawled. The partner tag
// makes these links affiliate ones; the product sheet and the results then show the notice Amazon
// requires.

/** Amazon Partenaires tracking ID: the account's store ID. Empty, the links are plain ones. */
export const AMAZON_PARTNER_TAG: string = 'niji0a-21'

/**
 * The Amazon.fr link of a product. Its ASIN, unless the visitor asked for another layout than the
 * AZERTY version it points to; otherwise a search for brand and model, plus "AZERTY" for a French
 * visitor when the board comes in that layout and the visitor's layout answer (if any) includes it.
 * A monitor is searched by its maker's reference when it has one (LS27FG602SUXEN, 27GX790A-B):
 * sellers list it under that code more surely than under the range's name.
 */
export function amazonLink(item: CatalogItem, locale: Locale, layouts?: readonly string[]) {
  const french = item.category === 'keyboard' && item.variants.some((v) => v.layout === 'iso_fr')
  const wantsAzerty = !layouts?.length || layouts.includes('azerty')
  const reference =
    item.category === 'monitor' && item.modelNumber && !/\s/.test(item.modelNumber)
      ? item.modelNumber
      : item.name
  const named = reference.toLowerCase().startsWith(item.brand.name.toLowerCase())
    ? reference
    : `${item.brand.name} ${reference}`
  const azerty = locale === 'fr' && french && wantsAzerty
  const query = `${named.replace(/[()]/g, ' ')}${azerty ? ' AZERTY' : ''}`
    .replace(/\s+/g, ' ')
    .trim()
  const direct = item.amazonAsin != null && (!french || wantsAzerty)
  const url = new URL(
    direct ? `https://www.amazon.fr/dp/${item.amazonAsin}` : 'https://www.amazon.fr/s',
  )
  if (!direct) url.searchParams.set('k', query)
  if (AMAZON_PARTNER_TAG) url.searchParams.set('tag', AMAZON_PARTNER_TAG)
  return { query, direct, url: url.toString(), affiliate: AMAZON_PARTNER_TAG !== '' }
}
