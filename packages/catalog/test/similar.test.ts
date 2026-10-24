import { describe, expect, it } from 'vitest'
import { type CatalogItem, type Category, categories, finderOf, mouseFinder, similar } from '../src'
import type { FinderDefinition } from '../src/finder/types'
import { text } from '../src/i18n'
import { keyboards, mice, monitors } from './fixtures'

// The products a sheet suggests as like it: on a toy catalogue whose answers can be checked by
// hand, then on the three questionnaires with the demo catalogue.

type Toy = {
  id: string
  maker: string
  size: 's' | 'm' | 'l'
  /** Sold with these ports: a toy may meet several options of the same question. */
  ports: ('usb' | 'bt')[]
  hand: 'left' | 'right' | 'both'
  price: number
}
const t = (s: string) => text(s)

const def: FinderDefinition<Toy> = {
  category: 'keyboard',
  profileStep: 'use',
  id: (x) => x.id,
  price: (x) => x.price,
  prior: () => 0.5,
  maker: (x) => x.maker,
  likeness: [
    { key: 'hand', weight: 1, hard: true },
    { key: 'size', weight: 2 },
    { key: 'ports', weight: 1 },
  ],
  steps: [
    {
      key: 'hand',
      kind: 'single',
      label: t('Hand'),
      title: t('Hand?'),
      options: [
        { id: 'right', label: t('Right'), match: (x) => x.hand !== 'left' },
        { id: 'left', label: t('Left'), match: (x) => x.hand !== 'right' },
      ],
    },
    {
      key: 'size',
      kind: 'multi',
      label: t('Size'),
      title: t('Size?'),
      options: [
        { id: 's', label: t('S'), match: (x) => x.size === 's' },
        { id: 'm', label: t('M'), match: (x) => x.size === 'm' },
        { id: 'l', label: t('L'), match: (x) => x.size === 'l' },
      ],
    },
    {
      key: 'ports',
      kind: 'multi',
      label: t('Ports'),
      title: t('Ports?'),
      options: [
        { id: 'usb', label: t('USB'), match: (x) => x.ports.includes('usb') },
        { id: 'bt', label: t('Bluetooth'), match: (x) => x.ports.includes('bt') },
      ],
    },
    {
      key: 'budget',
      kind: 'range',
      label: t('Budget'),
      title: t('Budget?'),
      value: (x) => x.price,
      bounds: [0, 400],
      snap: 10,
    },
  ],
  criteria: [],
  profiles: { default: {} },
}

const toy = (id: string, rest: Partial<Toy> = {}): Toy => ({
  id,
  maker: id,
  size: 'm',
  ports: ['usb'],
  hand: 'right',
  price: 100,
  ...rest,
})
const ids = (list: Toy[]) => list.map((x) => x.id)

describe('similar products', () => {
  it('never suggests the product itself, and no more than asked', () => {
    const items = [toy('p'), toy('a'), toy('b'), toy('c'), toy('d'), toy('e')]
    const found = similar(def, items, items[0] as Toy)
    expect(found).toHaveLength(4)
    expect(ids(found)).not.toContain('p')
    expect(similar(def, items, items[0] as Toy, { count: 2 })).toHaveLength(2)
  })

  it('puts the most alike first, by the weight of what they share', () => {
    const p = toy('p', { size: 'm', ports: ['usb'] })
    const items = [
      p,
      toy('ports-only', { size: 'l', ports: ['usb'] }),
      toy('twin', { size: 'm', ports: ['usb'] }),
      toy('size-only', { size: 'm', ports: ['bt'] }),
    ]
    expect(ids(similar(def, items, p))).toEqual(['twin', 'size-only', 'ports-only'])
  })

  it('reads an answer met by several options as partly alike', () => {
    const p = toy('p', { ports: ['usb'] })
    const items = [
      p,
      toy('both-ports', { ports: ['usb', 'bt'] }),
      toy('bt-only', { ports: ['bt'] }),
      toy('usb-only', { ports: ['usb'] }),
    ]
    expect(ids(similar(def, items, p))).toEqual(['usb-only', 'both-ports', 'bt-only'])
  })

  it('weighs the price: a near twin at the same price beats a twin at four times the price', () => {
    const p = toy('p', { price: 100 })
    const items = [
      p,
      toy('dear-twin', { price: 400 }),
      toy('near-twin', { ports: ['bt'], price: 100 }),
      toy('close-price', { price: 120 }),
    ]
    expect(ids(similar(def, items, p))).toEqual(['close-price', 'near-twin', 'dear-twin'])
  })

  it('never suggests a product with nothing in common on a hard question', () => {
    const p = toy('p', { hand: 'left' })
    const items = [
      p,
      toy('right', { hand: 'right' }),
      toy('both', { hand: 'both' }),
      toy('left', { hand: 'left' }),
    ]
    expect(ids(similar(def, items, p))).toEqual(['left', 'both'])
  })

  it('takes no more than two of a maker while others are left, then fills up with them', () => {
    const p = toy('p', { maker: 'x' })
    const items = [
      p,
      toy('x1', { maker: 'x' }),
      toy('x2', { maker: 'x' }),
      toy('x3', { maker: 'x' }),
      toy('y1', { maker: 'y', size: 'l' }),
    ]
    expect(ids(similar(def, items, p))).toEqual(['x1', 'x2', 'y1', 'x3'])
    expect(ids(similar(def, items, p, { count: 3 }))).toEqual(['x1', 'x2', 'y1'])
  })

  it('breaks ties by id, so the server and the browser agree', () => {
    const p = toy('p')
    const items = [p, toy('d'), toy('b'), toy('c'), toy('a')]
    expect(ids(similar(def, items, p))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(similar(def, [...items].reverse(), p))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returns what there is when the catalogue holds fewer products', () => {
    const p = toy('p')
    expect(ids(similar(def, [p, toy('a')], p))).toEqual(['a'])
    expect(similar(def, [p], p)).toEqual([])
  })
})

describe('similar products in the questionnaires', () => {
  const catalogues: Record<Category, CatalogItem[]> = {
    keyboard: keyboards,
    monitor: monitors,
    mouse: mice,
  }

  for (const category of categories) {
    it(`suggests four other products for every demo ${category}`, () => {
      const items = catalogues[category]
      for (const item of items) {
        const slugs = similar(finderOf(category), items, item).map((found) => found.slug)
        expect(slugs, item.slug).toHaveLength(Math.min(4, items.length - 1))
        expect(new Set(slugs).size, item.slug).toBe(slugs.length)
        expect(slugs, item.slug).not.toContain(item.slug)
      }
    })
  }

  it('reads its likeness from choice questions of its own questionnaire', () => {
    for (const category of categories) {
      const finder = finderOf(category)
      expect(finder.likeness?.length, category).toBeGreaterThan(0)
      for (const likeness of finder.likeness ?? []) {
        const step = finder.steps.find((s) => s.key === likeness.key)
        expect(step, `${category}.${likeness.key}`).toBeDefined()
        expect(step?.kind, `${category}.${likeness.key}`).not.toBe('range')
      }
    }
  })

  it('never suggests a mouse for the other hand', () => {
    for (const mouse of mice) {
      const found = similar(mouseFinder, mice, mouse)
      if (mouse.specs.hand === 'left')
        expect(
          found.every((m) => m.specs.hand !== 'right'),
          mouse.slug,
        ).toBe(true)
      if (mouse.specs.hand === 'right')
        expect(
          found.every((m) => m.specs.hand !== 'left'),
          mouse.slug,
        ).toBe(true)
    }
  })
})
