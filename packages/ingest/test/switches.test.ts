import { fileURLToPath } from 'node:url'
import type { Switch } from '@choose/catalog'
import { loadData } from '@choose/catalog/node'
import { describe, expect, it } from 'vitest'
import { aliasTable, loadAliases, nameKey, switchResolver } from '../src/switches'

// The alias table ties the names listings give a switch to its record. These cases resolve without
// any catalogue: an alias, or a name that is already a switch's slug, is answered first.

const dataDir = fileURLToPath(new URL('../../../data', import.meta.url))
const sw = (slug: string): Switch => ({
  slug,
  brand: 'Keychron',
  name: slug,
  feel: 'linear',
  silent: false,
  tech: 'mechanical',
  factoryLubed: false,
})

describe('switch names', () => {
  it('compare whatever their case, accents, word order, weight or « Switch »', () => {
    expect(nameKey('Keychron K Pro Red Switch')).toBe(nameKey('keychron k pro red'))
    expect(nameKey('Gateron Mechanical Low Profile Red')).toBe(
      nameKey('Low Profile Gateron Mechanical Red'),
    )
    expect(nameKey('Switchs mécaniques verts Razer™ - Tactile et sonore')).toBe(
      nameKey('Switchs mecaniques verts Razer - Tactile et sonore'),
    )
    expect(nameKey('HMX Frost 45g Linear PCB Mount')).toBe(nameKey('HMX Frost Linear'))
    expect(nameKey('Keychron Super Switch (Hot-Swappable）')).toBe(nameKey('Keychron Super'))
  })

  it('keep the words that tell switches apart', () => {
    expect(nameKey('K Pro Red')).not.toBe(nameKey('Keychron K Pro Red'))
    expect(nameKey('Ducky Shush Linear')).not.toBe(nameKey('Ducky Shush Tactile'))
  })
})

describe('alias table', () => {
  const switches = [sw('keychron-k-pro-red'), sw('keychron-k-pro-brown')]

  it('ties every spelling of a name to its switch', async () => {
    const resolver = switchResolver(
      switches,
      aliasTable({ 'keychron-k-pro-red': ['K Pro Red'] }, switches),
    )
    expect(await resolver.resolve('K Pro Red')).toEqual({ slug: 'keychron-k-pro-red' })
    expect(await resolver.resolve('k pro red switch')).toEqual({ slug: 'keychron-k-pro-red' })
    // A name that gives the slug of a switch needs no alias.
    expect(await resolver.resolve('Keychron K Pro Brown')).toEqual({
      slug: 'keychron-k-pro-brown',
    })
  })

  it('refuses a switch it does not know and a name pointing to two switches', () => {
    expect(() => aliasTable({ 'keychron-k-pro-mint': ['Mint'] }, switches)).toThrow(/absent/)
    expect(() =>
      aliasTable({ 'keychron-k-pro-red': ['Red'], 'keychron-k-pro-brown': ['red'] }, switches),
    ).toThrow(/renvoie/)
  })

  it('makes no switch of a bare feel', async () => {
    const res = await switchResolver([]).resolve('Linear')
    expect(res.slug).toBeUndefined()
    expect(res.note).toMatch(/^switch « Linear » : /)
  })

  it('loads from data/, every alias on a switch of data/switches.yaml', async () => {
    const data = await loadData(dataDir)
    const table = await loadAliases(dataDir, data.switches)
    expect(table.size).toBeGreaterThan(50)
    expect(table.get(nameKey('K Pro Red'))).toBe('keychron-k-pro-red')
    expect(table.get(nameKey('Switch optique sonore (violet)'))).toBe('razer-clicky-optical')
  })
})
