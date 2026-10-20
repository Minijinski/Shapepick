import type { CatalogItem, Locale } from '@choose/catalog'

// The handful of specs a card, a list row or an annotated hero prints, worded per locale.

export type SpecLine = { label: string; value: string }

const formFactorName: Record<string, [string, string]> = {
  full: ['100 %', 'Full size'],
  f96: ['96 %', '96%'],
  tkl: ['TKL', 'TKL'],
  f75: ['75 %', '75%'],
  f65: ['65 %', '65%'],
  f60: ['60 %', '60%'],
  f40: ['40 %', '40%'],
  split: ['Split', 'Split'],
  alice: ['Alice', 'Alice'],
  numpad: ['Pavé num.', 'Numpad'],
}
const techName: Record<string, [string, string]> = {
  mechanical: ['Mécanique', 'Mechanical'],
  magnetic: ['Magnétique', 'Magnetic'],
  optical: ['Optique', 'Optical'],
  membrane: ['Membrane', 'Membrane'],
  scissor: ['Ciseaux', 'Scissor'],
  topre: ['Topre', 'Topre'],
}
const panelName: Record<string, string> = {
  ips: 'IPS',
  va: 'VA',
  tn: 'TN',
  woled: 'WOLED',
  qdoled: 'QD-OLED',
  miniled_ips: 'Mini-LED IPS',
  miniled_va: 'Mini-LED VA',
}
const pick = (pair: [string, string] | undefined, locale: Locale) =>
  pair ? pair[locale === 'fr' ? 0 : 1] : ''

export const formatPrice = (value: number, locale: Locale) =>
  new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)

const num = (value: number, locale: Locale) =>
  new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB').format(value)

export function keySpecs(item: CatalogItem, locale: Locale): SpecLine[] {
  const fr = locale === 'fr'
  if (item.category === 'keyboard') {
    const s = item.specs
    const feels = [...new Set(item.variants.map((v) => v.switch?.feel).filter(Boolean))] as string[]
    const feelName: Record<string, [string, string]> = {
      linear: ['linéaire', 'linear'],
      tactile: ['tactile', 'tactile'],
      clicky: ['clicky', 'clicky'],
    }
    const connection = [
      s.conn24ghz && '2.4 GHz',
      s.connBt && 'Bluetooth',
      !s.conn24ghz && !s.connBt && (fr ? 'Filaire' : 'Wired'),
    ]
      .filter(Boolean)
      .join(' + ')
    return [
      {
        label: fr ? 'Format' : 'Size',
        value:
          pick(formFactorName[s.formFactor], locale) +
          (s.lowProfile ? (fr ? ' · extra-plat' : ' · low profile') : ''),
      },
      {
        label: fr ? 'Touches' : 'Keys',
        value: [
          pick(techName[s.technology], locale),
          feels.map((f) => pick(feelName[f], locale)).join('/'),
        ]
          .filter(Boolean)
          .join(' · '),
      },
      { label: fr ? 'Connexion' : 'Connection', value: connection },
      s.rapidTrigger
        ? {
            label: 'Rapid trigger',
            value: s.minActuationMm ? `${num(s.minActuationMm, locale)} mm` : '✓',
          }
        : {
            label: fr ? 'Poids' : 'Weight',
            value: s.weightG ? `${num(s.weightG, locale)} g` : '—',
          },
    ]
  }
  const s = item.specs
  return [
    {
      label: fr ? 'Taille' : 'Size',
      value: `${num(s.diagonalIn, locale)}" ${s.aspect}${s.curvatureR ? ` · ${s.curvatureR}R` : ''}`,
    },
    { label: fr ? 'Définition' : 'Resolution', value: `${s.resW}×${s.resH} · ${s.ppi} PPI` },
    { label: fr ? 'Dalle' : 'Panel', value: panelName[s.panel] ?? s.panel },
    { label: fr ? 'Fréquence' : 'Refresh', value: `${s.refreshHzMax} Hz` },
  ]
}
