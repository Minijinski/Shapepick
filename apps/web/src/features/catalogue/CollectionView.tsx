import { type CatalogItem, finderOf, type Locale, stepOf } from '@choose/catalog'
import { css, cx } from 'styled-system/css'
import { ProductPicture } from '~/features/product/ProductPicture'
import { photoSrc } from '~/features/product/photo'
import { SpecValue } from '~/features/product/SpecValue'
import { formatAmount, formatPrice } from '~/features/product/specs'
import { messages as m } from '~/i18n/messages'
import { cataloguePaths, categoryPaths, collectionPaths, productPaths } from '~/seo'
import type { CollectionPage } from '~/server/catalogue'
import {
  CatalogueSection,
  CatalogueShell,
  CollectionChip,
  caption,
  chips,
  finderLink,
  primaryAction,
  secondaryAction,
  useJourneyQueries,
} from './CataloguePage'
import { type Collection, collections } from './collections'

// A collection's page: its products in the order the finder ranks them for the same answers, the
// first three with their pictures, the others in the results' columns, each a link to its sheet;
// then the collections beside it. The finder, its answers given, narrows it down further.

type Row = CollectionPage['rows'][number]

/**
 * The ranking it follows, in a few words: the use it ranks for and that use's own hint, or what the
 * overall one weighs. A use's own page (Pour jouer, Claw grip) is named after it already.
 */
function rankingOf(collection: Collection, locale: Locale) {
  const def = finderOf(collection.category)
  const [key, id] = collection.use
    ? [def.profileStep, collection.use]
    : (Object.entries(collection.steer ?? {})[0] ?? [])
  const option =
    key && id
      ? (() => {
          const step = stepOf(def, key)
          return step.kind === 'range' ? undefined : step.options.find((o) => o.id === id)
        })()
      : undefined
  const named = collection.group === 'use' ? collection.short : option?.label
  return option && named
    ? { title: `${m.ranking[locale]} · ${named[locale]}`, basis: option.hint?.[locale] }
    : { title: m.rankingDefault[locale], basis: m.rankingBasis[collection.category][locale] }
}

/** The product's photo as a plain image, for readers that run no script (some search engines). */
function NoScriptPhoto({ item }: { item: CatalogItem }) {
  if (!item.photo) return null
  const width = 480
  const attr = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<img src="${attr(photoSrc(item.photo, width, true))}" alt="${attr(`${item.brand.name} ${item.name}`)}" loading="lazy" style="display:block;max-width:100%;max-height:100%;margin:auto">`
  // biome-ignore lint/security/noDangerouslySetInnerHtml: our own tag, its text escaped
  return <noscript dangerouslySetInnerHTML={{ __html: html }} />
}

/** One of the first three: its picture on the canvas's dotted paper, its rank, name and price. */
function PodiumCard({
  item,
  row,
  rank,
  shared,
  locale,
  journey,
}: {
  item: CatalogItem
  row: Row
  rank: number
  shared: ReadonlySet<string>
  locale: Locale
  /** The visitor's answers in this category, as a query: the sheet opens over that journey. */
  journey: string
}) {
  return (
    <li>
      <a
        href={productPaths(item.category, item.slug)[locale] + journey}
        className={cx(
          'group',
          css({
            display: 'grid',
            // A phone puts the picture beside the name, a wider screen above it.
            gridTemplateColumns: { base: '8.5rem minmax(0, 1fr)', md: 'minmax(0, 1fr)' },
            gridTemplateRows: { base: 'auto', md: 'auto 1fr' },
            h: '100%',
            borderRadius: 'card',
            borderWidth: '1px',
            borderColor: 'line',
            bg: 'surface',
            overflow: 'hidden',
            transition: 'border-color 160ms, background 160ms',
            _hover: { borderColor: 'line.strong', bg: 'surface.raised' },
            _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '2px' },
          }),
        )}
      >
        <span
          className={css({
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gridTemplateRows: 'minmax(0, 1fr)',
            placeItems: 'center',
            h: { base: 'auto', md: '48' },
            minH: '28',
            p: { base: '3', md: '5' },
            pt: { base: '8', md: '5' },
            bg: 'paper',
            backgroundImage: 'radial-gradient(#CFCBC2 1.1px, transparent 1.3px)',
            backgroundSize: '14px 14px',
            borderColor: 'line',
            borderRightWidth: { base: '1px', md: '0' },
            borderBottomWidth: { base: '0', md: '1px' },
          })}
        >
          <span
            className={css({
              position: 'absolute',
              zIndex: '1',
              top: '2.5',
              left: '2.5',
              display: 'grid',
              placeItems: 'center',
              minW: '7',
              h: '5',
              px: '1.5',
              borderRadius: 'pill',
              bg: 'surface.raised',
              boxShadow: '0 0 0 1px token(colors.line)',
              fontFamily: 'mono',
              fontSize: 'xs',
              lineHeight: '1',
              color: rank === 1 ? 'signal' : 'ink.muted',
              fontVariantNumeric: 'tabular-nums',
            })}
          >
            {String(rank).padStart(2, '0')}
          </span>
          <span
            className={css({
              w: '100%',
              h: '100%',
              transition: 'transform 450ms token(easings.signal)',
              _groupHover: { transform: 'translateY(-3px) scale(1.03)' },
              _motionReduce: { transition: 'none' },
            })}
          >
            <NoScriptPhoto item={item} />
            <ProductPicture item={item} shadow="lg" className={css({ w: '100%', h: '100%' })} />
          </span>
        </span>
        <span
          className={css({
            display: 'grid',
            alignContent: 'start',
            gap: '1',
            p: { base: '3', md: '4' },
            minW: '0',
          })}
        >
          <span className={css({ fontSize: 'xs', color: 'ink.muted' })}>{item.brand.name}</span>
          <span
            className={css({
              fontSize: { base: 'md', md: 'lg' },
              fontWeight: '600',
              letterSpacing: '-0.02em',
              lineHeight: '1.2',
            })}
          >
            {item.name}
          </span>
          <span className={css({ fontSize: 'xs', lineHeight: '1.4', color: 'ink.muted' })}>
            {row.line}
            {row.tags
              .filter((t) => !shared.has(t))
              .map((t) => (
                <span key={t} className={tag}>
                  {t}
                </span>
              ))}
          </span>
          <span
            className={css({
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '3',
              mt: '2',
            })}
          >
            <span
              className={css({
                fontFamily: 'mono',
                fontSize: 'md',
                fontVariantNumeric: 'tabular-nums',
              })}
            >
              {formatPrice(item.priceEur, locale)}
            </span>
            <span
              className={css({
                display: { base: 'none', md: 'inline' },
                fontSize: 'xs',
                color: 'ink.muted',
                transition: 'color 160ms',
                _groupHover: { color: 'ink' },
              })}
            >
              {m.viewSheet[locale]} →
            </span>
          </span>
        </span>
      </a>
    </li>
  )
}

/** Rank, name, the four specs in the results' columns, price; on a phone, the specs in a line. */
const rowColumns = css({
  gridTemplateColumns: {
    base: '2rem minmax(0, 1fr) auto',
    md: '2rem minmax(0, 1.1fr) minmax(0, 2.6fr) 5.5rem',
  },
})
const specColumns = css({
  display: { base: 'none', md: 'grid' },
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  columnGap: '3',
  alignItems: 'center',
  minW: '0',
})
/** As many columns as there are specs printed. */
const gridOf = (columns: number[]) => ({
  gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))`,
})
/** What sets a product apart, beside its name: "AZERTY", "21:9", "Gaucher". */
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
  fontWeight: '400',
  lineHeight: '1',
  verticalAlign: 'text-bottom',
  whiteSpace: 'nowrap',
})

/** A spec as a column prints it: its value, else its first qualifier. */
const cellText = (cell: Row['cells'][number] | undefined) => cell?.value || cell?.details[0] || ''

function ListRow({
  row,
  rank,
  collection,
  columns,
  shared,
  locale,
  journey,
}: {
  row: Row
  rank: number
  collection: Collection
  /** The columns printed: those whose value changes from one product to the next. */
  columns: number[]
  /** Tags every product listed has (AZERTY, in "Magnétiques AZERTY"): not worth repeating. */
  shared: ReadonlySet<string>
  locale: Locale
  /** The visitor's answers in this category, as a query: the sheet opens over that journey. */
  journey: string
}) {
  const tags = row.tags.filter((t) => !shared.has(t))
  return (
    <li className={css({ borderTopWidth: '1px', borderColor: 'line' })}>
      <a
        href={productPaths(collection.category, row.slug)[locale] + journey}
        className={cx(
          rowColumns,
          css({
            display: 'grid',
            alignItems: 'center',
            gap: '3',
            minH: '14',
            py: '2',
            px: '2',
            mx: '-2',
            borderRadius: '8px',
            transition: 'background 160ms',
            _hover: { bg: 'surface' },
            _focusVisible: { outline: '2px solid', outlineColor: 'signal', outlineOffset: '-2px' },
          }),
        )}
      >
        <span
          className={css({
            fontFamily: 'mono',
            fontSize: 'xs',
            color: 'ink.faint',
            fontVariantNumeric: 'tabular-nums',
          })}
        >
          {String(rank).padStart(2, '0')}
        </span>
        <span className={css({ display: 'grid', minW: '0', lineHeight: '1.25' })}>
          <span className={css({ fontSize: '2xs', color: 'ink.muted', truncate: true })}>
            {row.brand}
          </span>
          <span className={css({ fontSize: 'sm', fontWeight: '600', overflowWrap: 'anywhere' })}>
            {row.name}
            {tags.map((t) => (
              <span key={t} className={tag}>
                {t}
              </span>
            ))}
          </span>
          <span
            className={css({
              display: { base: 'block', md: 'none' },
              mt: '0.5',
              fontSize: 'xs',
              color: 'ink.muted',
            })}
          >
            {columns
              .map((i) => cellText(row.cells[i]))
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className={specColumns} style={gridOf(columns)}>
          {columns.map((i) => {
            const cell = row.cells[i]
            if (!cell) return <span key={i}>—</span>
            // What the tags beside the name say is not said again under the value.
            const details = cell.details.filter((d) => !row.tags.includes(d))
            return <SpecValue key={cell.label} cell={{ ...cell, details }} />
          })}
        </span>
        <span
          className={css({
            justifySelf: 'end',
            fontFamily: 'mono',
            fontSize: 'sm',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          })}
        >
          {formatPrice(row.priceEur, locale)}
        </span>
      </a>
    </li>
  )
}

export function CollectionView({
  collection,
  locale,
  page,
}: {
  collection: Collection
  locale: Locale
  page: CollectionPage
}) {
  const { category } = collection
  const ranking = rankingOf(collection, locale)
  const journey = useJourneyQueries([category])[category] ?? ''
  const [first] = page.rows
  // A spec every product listed shares (the 75 % of "Claviers 75 % sans fil") says nothing in a
  // column: only those that change are printed.
  const varying = (first?.cells ?? []).flatMap((_, i) =>
    new Set(page.rows.map((row) => cellText(row.cells[i]))).size > 1 ? [i] : [],
  )
  const columns = varying.length ? varying : (first?.cells ?? []).map((_, i) => i)
  const shared = new Set(
    first?.tags.filter((t) => page.rows.every((row) => row.tags.includes(t))) ?? [],
  )
  const neighbours = page.neighbours.flatMap(({ id, size }) => {
    const other = collections[category].find((c) => c.id === id)
    return other ? [{ other, size }] : []
  })
  return (
    <CatalogueShell
      locale={locale}
      category={category}
      shown={page.shown}
      paths={collectionPaths(collection)}
      crumbs={[
        { name: m.category[category][locale], path: categoryPaths(category)[locale], finder: true },
        { name: m.catalogue[locale], path: cataloguePaths(category)[locale] },
        { name: collection.short[locale] },
      ]}
      title={collection.name[locale]}
      lead={m.catalogueFacts(
        page.total,
        page.brands,
        formatAmount(page.prices[0], locale),
        formatAmount(page.prices[1], locale),
        locale,
      )}
      actions={
        <>
          <a href={finderLink(collection, locale)} className={primaryAction}>
            {m.refine[locale]} →
          </a>
          <a href={cataloguePaths(category)[locale]} className={secondaryAction}>
            {m.everyModel[locale]}
          </a>
        </>
      }
    >
      <section
        aria-labelledby="ranking-title"
        className={css({ display: 'grid', gap: '5', pb: { base: '8', md: '10' } })}
      >
        <div
          className={css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            columnGap: '3',
            rowGap: '1',
          })}
        >
          <h2 id="ranking-title" className={cx(caption, css({ color: 'ink' }))}>
            {ranking.title}
          </h2>
          {ranking.basis && (
            <p className={css({ fontSize: 'xs', color: 'ink.muted' })}>{ranking.basis}</p>
          )}
        </div>
        <ol
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
            gap: { base: '2', md: '3' },
          })}
        >
          {page.podium.map((item, i) => {
            const row = page.rows[i]
            return row ? (
              <PodiumCard
                key={item.slug}
                item={item}
                row={row}
                rank={i + 1}
                shared={shared}
                locale={locale}
                journey={journey}
              />
            ) : null
          })}
        </ol>
        {page.rows.length > 3 && (
          <div className={css({ display: 'grid', gap: '1', mt: '3' })}>
            <div
              aria-hidden
              className={cx(
                rowColumns,
                css({ display: { base: 'none', md: 'grid' }, gap: '3', alignItems: 'end' }),
              )}
            >
              <span />
              <span className={caption}>{m.models[locale]}</span>
              <span className={specColumns} style={gridOf(columns)}>
                {columns.map((i) => (
                  <span key={i} className={cx(caption, css({ truncate: true }))}>
                    {first?.cells[i]?.label}
                  </span>
                ))}
              </span>
              <span className={cx(caption, css({ textAlign: 'right' }))}>{m.price[locale]}</span>
            </div>
            <ol start={4}>
              {page.rows.slice(3).map((row, i) => (
                <ListRow
                  key={row.slug}
                  row={row}
                  rank={i + 4}
                  collection={collection}
                  columns={columns}
                  shared={shared}
                  locale={locale}
                  journey={journey}
                />
              ))}
            </ol>
            {page.total > page.rows.length && (
              <p
                className={css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '2',
                  pt: '3',
                  borderTopWidth: '1px',
                  borderColor: 'line',
                  fontSize: 'sm',
                  color: 'ink.muted',
                })}
              >
                {m.firstOf(page.rows.length, page.total, locale)} ·
                <a
                  href={cataloguePaths(category)[locale]}
                  className={css({
                    color: 'ink',
                    textDecoration: 'underline',
                    textDecorationColor: 'token(colors.line.strong)',
                    textUnderlineOffset: '3px',
                    _hover: { textDecorationColor: 'ink' },
                  })}
                >
                  {m.everyModel[locale]}
                </a>
              </p>
            )}
          </div>
        )}
      </section>
      {neighbours.length > 0 && (
        <CatalogueSection id="voir-aussi" title={m.seeAlso[locale]}>
          <div className={chips}>
            {neighbours.map(({ other, size }) => (
              <CollectionChip
                key={other.id}
                href={collectionPaths(other)[locale]}
                label={other.short[locale]}
                count={size}
              />
            ))}
          </div>
        </CatalogueSection>
      )}
    </CatalogueShell>
  )
}
