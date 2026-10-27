import type { CatalogItem, Locale } from '@choose/catalog'

// Where a product can be bought: Amazon.fr for a visitor in France and the countries it serves as
// its own (overseas France, Belgium, Luxembourg, Monaco), Amazon.com anywhere else. On Amazon.fr,
// the product page when the data gives its ASIN (the AZERTY version when the model has one),
// otherwise a search for the model; on Amazon.com always a search, since the ASINs are Amazon.fr's.
// ASINs are read from search-engine results, never from Amazon itself, which is not crawled. The
// partner tags make these links affiliate ones; the product sheet and the results then show the
// notice Amazon requires.

/** Amazon Partenaires tracking ID: the account's store ID. Empty, the links are plain ones. */
export const AMAZON_PARTNER_TAG: string = 'niji0a-21'
/** Amazon.com Associates tracking ID. Empty, every visitor goes to Amazon.fr. */
export const AMAZON_US_TAG: string = 'niji08-20'

/** The Amazon a visitor is sent to. */
export const STORES = ['amazon.fr', 'amazon.com'] as const
export type Store = (typeof STORES)[number]

/** The time zones of the countries Amazon.fr serves as its own: France, overseas France included,
 * Belgium, Luxembourg, Monaco. */
const SERVED_BY_FR = new Set([
  'Europe/Paris',
  'Europe/Monaco',
  'Europe/Brussels',
  'Europe/Luxembourg',
  'Indian/Reunion',
  'Indian/Mayotte',
  'Indian/Kerguelen',
  'America/Guadeloupe',
  'America/Martinique',
  'America/Cayenne',
  'America/Marigot',
  'America/St_Barthelemy',
  'America/Miquelon',
  'Pacific/Noumea',
  'Pacific/Tahiti',
  'Pacific/Marquesas',
  'Pacific/Gambier',
  'Pacific/Wallis',
])

/**
 * The Amazon for a visitor, from their device's time zone: no request, nothing kept. A browser
 * that hides it (UTC, as privacy modes report) falls back on the page's language.
 */
export function storeOf(timeZone: string | undefined, locale: Locale): Store {
  if (!AMAZON_US_TAG) return 'amazon.fr'
  if (!timeZone || timeZone === 'UTC' || timeZone.startsWith('Etc/'))
    return locale === 'fr' ? 'amazon.fr' : 'amazon.com'
  return SERVED_BY_FR.has(timeZone) ? 'amazon.fr' : 'amazon.com'
}

/**
 * The Amazon link of a product. On Amazon.fr, its ASIN, unless the visitor asked for another layout
 * than the AZERTY version it points to; otherwise a search for brand and model, plus "AZERTY" for a
 * French visitor when the board comes in that layout and the visitor's layout answer (if any)
 * includes it. A monitor is searched by its maker's reference when it has one (LS27FG602SUXEN,
 * 27GX790A-B): sellers list it under that code more surely than under the range's name.
 */
export function amazonLink(
  item: CatalogItem,
  locale: Locale,
  layouts?: readonly string[],
  store: Store = 'amazon.fr',
) {
  const us = store === 'amazon.com'
  const french = item.category === 'keyboard' && item.variants.some((v) => v.layout === 'iso_fr')
  const wantsAzerty = !layouts?.length || layouts.includes('azerty')
  const reference =
    item.category === 'monitor' && item.modelNumber && !/\s/.test(item.modelNumber)
      ? item.modelNumber
      : item.name
  const named = reference.toLowerCase().startsWith(item.brand.name.toLowerCase())
    ? reference
    : `${item.brand.name} ${reference}`
  const azerty = !us && locale === 'fr' && french && wantsAzerty
  const query = `${named.replace(/[()]/g, ' ')}${azerty ? ' AZERTY' : ''}`
    .replace(/\s+/g, ' ')
    .trim()
  const direct = !us && item.amazonAsin != null && (!french || wantsAzerty)
  const url = new URL(
    direct ? `https://www.amazon.fr/dp/${item.amazonAsin}` : `https://www.${store}/s`,
  )
  if (!direct) url.searchParams.set('k', query)
  const tag = us ? AMAZON_US_TAG : AMAZON_PARTNER_TAG
  if (tag) url.searchParams.set('tag', tag)
  return { store, query, direct, url: url.toString(), affiliate: tag !== '' }
}
