import type { Category, Locale, Text } from '@choose/catalog'
import { css } from 'styled-system/css'
import { formatAmount, formatPrice } from '~/features/product/specs'
import { messages as m } from '~/i18n/messages'
import { cataloguePaths, categoryPaths, collectionPaths, productPaths } from '~/seo'
import type { CatalogueRow, IndexPage } from '~/server/catalogue'
import {
  CatalogueSection,
  CatalogueShell,
  CollectionChip,
  caption,
  chips,
  primaryAction,
  questionsOf,
} from './CataloguePage'
import { type Collection, type CollectionGroup, collections } from './collections'

// A category's catalogue: every product, brand by brand, A to Z, each a link to its sheet; its
// collections first, by what they keep (size, keys, layout…). The page search engines find every
// product from, and a visitor who knows the name of the model they want.

const groups: CollectionGroup[] = [
  'use',
  'size',
  'keys',
  'panel',
  'layout',
  'link',
  'feature',
  'price',
]

/** A product's line: its name and price, its specs under them. The whole line opens its sheet. */
const row = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'baseline',
  columnGap: '4',
  rowGap: '0.5',
  py: '2.5',
  px: '2',
  mx: '-2',
  borderRadius: '8px',
  transition: 'background 160ms',
  _hover: { bg: 'surface' },
  _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '-2px' },
})

/**
 * A group of collections: on a phone, one line that scrolls sideways and fades out at the screen's
 * edge, so that the brands are not far below; wider, the chips wrap.
 */
const chipLine = css({
  display: 'flex',
  gap: '2',
  flexWrap: { base: 'nowrap', md: 'wrap' },
  overflowX: { base: 'auto', md: 'visible' },
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
  mx: { base: '-4', md: '0' },
  pl: { base: '4', md: '0' },
  pr: { base: '12', md: '0' },
  maskImage: { base: 'linear-gradient(to right, #000 calc(100% - 3rem), transparent)', md: 'none' },
})

const tag = css({
  display: 'inline-flex',
  alignItems: 'center',
  h: '4',
  px: '1',
  ml: '1.5',
  borderRadius: 'sm',
  bg: 'ink/5',
  color: 'ink.muted',
  fontFamily: 'mono',
  fontSize: '2xs',
  lineHeight: '1',
  verticalAlign: 'baseline',
  whiteSpace: 'nowrap',
})

function ProductRow({
  row: item,
  category,
  locale,
}: {
  row: CatalogueRow
  category: Category
  locale: Locale
}) {
  return (
    <li className={css({ breakInside: 'avoid', borderBottomWidth: '1px', borderColor: 'line' })}>
      <a href={productPaths(category, item.slug)[locale]} className={row}>
        <span className={css({ fontSize: 'sm', fontWeight: '600', lineHeight: '1.3' })}>
          {item.name}
        </span>
        <span
          className={css({
            fontFamily: 'mono',
            fontSize: 'xs',
            color: 'ink.muted',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          })}
        >
          {formatPrice(item.priceEur, locale)}
        </span>
        <span
          className={css({
            gridColumn: '1 / -1',
            fontSize: 'xs',
            lineHeight: '1.4',
            color: 'ink.muted',
          })}
        >
          {item.line}
          {item.tags.map((t) => (
            <span key={t} className={tag}>
              {t}
            </span>
          ))}
        </span>
      </a>
    </li>
  )
}

export function CatalogueIndex({
  category,
  locale,
  page,
}: {
  category: Category
  locale: Locale
  page: IndexPage
}) {
  const sizes = new Map(page.collections.map((c) => [c.id, c.size]))
  const living = collections[category].filter((c) => sizes.has(c.id))
  const grouped = groups
    .map((group) => ({ group, list: living.filter((c) => c.group === group) }))
    .filter(({ list }) => list.length > 0)
  const groupNames = m.collectionGroups[category] as Partial<Record<CollectionGroup, Text>>
  const name = m.category[category][locale]
  const chipOf = (c: Collection) => (
    <CollectionChip
      key={c.id}
      href={collectionPaths(c)[locale]}
      label={c.short[locale]}
      count={sizes.get(c.id) ?? 0}
    />
  )
  return (
    <CatalogueShell
      locale={locale}
      category={category}
      shown={page.shown}
      paths={cataloguePaths(category)}
      crumbs={[{ name, path: categoryPaths(category)[locale] }, { name: m.catalogue[locale] }]}
      title={m.catalogueTitle[category][locale]}
      lead={m.catalogueFacts(
        page.total,
        page.brands.length,
        formatAmount(page.prices[0], locale),
        formatAmount(page.prices[1], locale),
        locale,
      )}
      actions={
        <a href={categoryPaths(category)[locale]} className={primaryAction}>
          {m.chooseIn(questionsOf(category), locale)} →
        </a>
      }
    >
      {grouped.length > 0 && (
        <CatalogueSection id="selections" title={m.collections[locale]} aside={living.length}>
          <div className={css({ display: 'grid', gap: '4' })}>
            {grouped.map(({ group, list }) => (
              <div key={group} className={css({ display: 'grid', gap: '2' })}>
                <p className={caption}>{groupNames[group]?.[locale]}</p>
                <div className={chipLine}>{list.map(chipOf)}</div>
              </div>
            ))}
          </div>
        </CatalogueSection>
      )}
      <CatalogueSection id="marques" title={m.brands[locale]} aside={page.brands.length}>
        <div className={chips}>
          {page.brands.map((brand) => (
            <CollectionChip
              key={brand.slug}
              href={`#${brand.slug}`}
              label={brand.name}
              count={brand.rows.length}
            />
          ))}
        </div>
      </CatalogueSection>
      {page.brands.map((brand) => (
        <CatalogueSection
          key={brand.slug}
          id={brand.slug}
          title={brand.name}
          aside={`${brand.rows.length} ${m.models[locale]}`}
        >
          <ul
            className={css({
              columnCount: { base: 1, lg: 2 },
              columnGap: '10',
              // The first name in line with the brand's.
              mt: { md: '-2.5' },
            })}
          >
            {brand.rows.map((item) => (
              <ProductRow key={item.slug} row={item} category={category} locale={locale} />
            ))}
          </ul>
        </CatalogueSection>
      ))}
    </CatalogueShell>
  )
}
