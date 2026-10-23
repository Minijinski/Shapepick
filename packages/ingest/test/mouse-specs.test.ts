import { describe, expect, it } from 'vitest'
import { Facts } from '../src/facts'
import { type MouseHints, mouseSpecsOf } from '../src/mouse-specs'
import { Skip } from '../src/source'

// Real label/value pairs as the brands' pages word them (read on 23 October 2026), the labels a
// site uses in another sense already renamed by its adapter (Logitech's office "Hauteur").

const sheet = (pairs: [string, string][]) =>
  new Facts(pairs.map(([label, value]) => ({ label, value })))
const read = (pairs: [string, string][], hints: Partial<MouseHints> = {}) =>
  mouseSpecsOf(sheet(pairs), { name: '', text: '', ...hints })

describe('mouse sheets, brand by brand', () => {
  it('reads Logitech G (separate measurements, 8 kHz, LIGHTSPEED)', () => {
    const { specs, notes } = read(
      [
        ['Hauteur', '40 mm'],
        ['Largeur', '63.5 mm'],
        ['Longueur', '125 mm'],
        ['Poids', '60 g'],
        ['Capteur', 'HERO 2'],
        ['Résolution - Suivi', '32 000 DPI'],
        ['Taux de rapport max.', '8000Hz (0.125) *Les fonctions avancées nécessitent le logiciel'],
        ['Technologie sans fil', 'LIGHTSPEED'],
        ['Type de batterie', 'Rechargeable Li-Po (95 mAh)'],
        ['Autonomie de la batterie', "Jusqu'à 95 heures"],
      ],
      {
        name: 'PRO X SUPERLIGHT 2',
        segment: 'gaming',
        text: 'Une forme ambidextre, un poids de 60 g.',
      },
    )
    expect(specs).toMatchObject({
      shape: 'symmetrical',
      hand: 'right',
      lengthMm: 125,
      widthMm: 63.5,
      heightMm: 40,
      weightG: 60,
      sensor: 'HERO 2',
      dpiMax: 32000,
      pollingHz: 8000,
      conn24ghz: true,
      connBt: false,
      power: 'rechargeable',
      batteryHours: 95,
    })
    // Sold as ambidextrous, its side buttons sit on the left only.
    expect(notes.join(' ')).toMatch(/ambidextre/)
  })

  it('reads Logitech office pages (length renamed, days of battery, Easy-Switch)', () => {
    const { specs, notes } = read(
      [
        ['Longueur', '124.9 mm'],
        ['Largeur', '84.3 mm'],
        ['Hauteur', '51 mm'],
        ['Poids', '141 g'],
        ['Type de batterie', 'Batterie Li-Po rechargeable (500 mAh)'],
        ['Autonomie de la batterie', "Jusqu'à 70 jours avec une charge complète"],
        ['Technologie sans fil', 'Logi Bolt, Bluetooth Low Energy'],
      ],
      {
        name: 'MX Master 3S',
        segment: 'office',
        shape: 'ergonomic',
        text: 'Défilement ultra-rapide MagSpeed, molette latérale, clics silencieux. Easy-Switch pour 3 appareils.',
      },
    )
    expect(specs).toMatchObject({
      shape: 'ergonomic',
      hand: 'right',
      lengthMm: 124.9,
      widthMm: 84.3,
      heightMm: 51,
      weightG: 141,
      conn24ghz: true,
      connBt: true,
      connWired: false,
      hosts: 3,
      freeSpinWheel: true,
      thumbWheel: true,
      silentClicks: true,
      power: 'rechargeable',
      batteryHours: 560,
    })
    expect(notes.join(' ')).toMatch(/jours/)
  })

  it('reads Razer (one size field, battery at 1 000 Hz, explicit "Non")', () => {
    const { specs } = read(
      [
        ['Forme', 'Droitier'],
        [
          'Connectivité',
          'Razer™ HyperSpeed Wireless ; Filaire - Câble de recharge USB Type A vers USB Type C',
        ],
        ['Autonomie de la batterie', 'Jusqu’à 90 heures à 1 000 Hz ; Jusqu’à 17 heures à 8 000 Hz'],
        ['Éclairage RGB', 'Non'],
        ['Capteur', 'Capteur optique 30 K Focus Pro'],
        ['Sensibilité max. (DPI)', '30000'],
        ['Boutons programmables', '6'],
        ['Type de switch', 'Switchs optiques de souris de 3e génération'],
        [
          'Taille',
          'Longueur: 128,0 mm / 5,00 po ; Largeur: 68,0 mm / 2,67 po ; Hauteur: 44,0 mm / 1,73 po',
        ],
        ['Poids', '63 g (câble et dongle exclus)'],
        ['Compatibilité avec les accessoires', 'Non'],
        ['Molette multidirectionnelle', 'Non'],
      ],
      {
        name: 'Razer DeathAdder V3 Pro',
        segment: 'gaming',
        text: 'Forme Ergonomique. Affûtée à la perfection.',
      },
    )
    expect(specs).toMatchObject({
      shape: 'ergonomic',
      hand: 'right',
      lengthMm: 128,
      widthMm: 68,
      heightMm: 44,
      weightG: 63,
      sensor: '30 K Focus Pro',
      dpiMax: 30000,
      buttons: 6,
      switchType: 'optical',
      conn24ghz: true,
      connWired: true,
      batteryHours: 90,
      power: 'rechargeable',
      rgb: false,
      wirelessCharging: false,
      tiltWheel: false,
    })
  })

  it('reads SteelSeries (front and back figures, grip styles, two battery lives)', () => {
    const { specs } = read(
      [
        ['Forme', 'Ergonomique, pour droitiers'],
        ['Style de prise', 'Paume ou griffe'],
        ['Nombre de boutons', '9'],
        [
          'Type de commutateur',
          'Commutateurs mécaniques SteelSeries, conçus pour 80 millions de clics',
        ],
        ['Poids', '74 g'],
        ['Longueur', '128,8 mm / 5,07 pouces'],
        ['Largeur', '62,8 mm / 2,47 pouces (avant), 68,2 mm / 2,68 pouces (arrière)'],
        ['Hauteur', '26,7 mm / 1,05 pouces (avant), 42,10 mm / 1,65 pouces (arrière)'],
        ['Éclairage', '3 zones RVB'],
        [
          'Autonomie de la batterie',
          "Jusqu'à 80 heures en 2,4 GHz Jusqu'à 180 heures en Bluetooth",
        ],
        ['Connexion', '2,4 GHz / Bluetooth 5.0'],
        ['Type de capteur', 'Optique'],
        ['Capteur', 'SteelSeries TrueMove Air'],
        ['CPI', '100 à 18 000 par incréments de 100 CPI'],
        ["Fréquence d'échantillonnage", '1000 Hz / 1 ms'],
      ],
      { name: 'Aerox 5 Wireless', segment: 'gaming', text: 'Batterie rechargeable.' },
    )
    expect(specs).toMatchObject({
      shape: 'ergonomic',
      hand: 'right',
      lengthMm: 128.8,
      widthMm: 68.2,
      heightMm: 42.1,
      weightG: 74,
      makerGrips: ['palm', 'claw'],
      buttons: 9,
      switchType: 'mechanical',
      rgb: true,
      batteryHours: 80,
      conn24ghz: true,
      connBt: true,
      sensor: 'SteelSeries TrueMove Air',
      dpiMax: 18000,
      pollingHz: 1000,
    })
  })

  it('waits for Corsair measurements, reading its hand size and kilograms meanwhile', () => {
    const corsair: [string, string][] = [
      ['Weight', '0.06'],
      ['Connectivity', 'Wireless'],
      ['Grip Type', 'Any'],
      ['Hand Size', 'Large'],
      ['Battery Life', '2.4GHz SLIPSTREAM: Up to 34hrs | Bluetooth®: Up to 100hrs'],
      ['Sensor', 'MARKSMAN 26K'],
      ['Sensor Type', 'Optical'],
      ['DPI', '26,000'],
    ]
    expect(() => read(corsair, { name: 'M75 WIRELESS', segment: 'gaming' })).toThrow(Skip)
    const { specs } = read([...corsair, ['Dimensions', '128.7 x 65.1 x 41.4 mm']], {
      name: 'M75 WIRELESS',
      segment: 'gaming',
      shape: 'symmetrical',
      text: 'Bluetooth',
    })
    expect(specs).toMatchObject({
      lengthMm: 128.7,
      widthMm: 65.1,
      heightMm: 41.4,
      weightG: 60,
      makerHandMinCm: 19,
      makerHandMaxCm: 21.5,
      dpiMax: 26000,
      batteryHours: 34,
      conn24ghz: true,
      connBt: true,
    })
    expect(specs.makerGrips).toBeUndefined()
  })

  it('reads Pulsar (inches beside millimetres)', () => {
    const { specs } = read(
      [
        ['Length', '4.55in (115.6mm)'],
        ['Width', '2.46in (62mm)'],
        ['Height', '1.49in (38mm)'],
        ['Weight', '52g (+- 1g) / 1.83oz'],
        ['Sensor', 'PAW3395'],
      ],
      {
        name: 'X2H Mini',
        segment: 'gaming',
        shape: 'symmetrical',
        text: 'Up to 100 hours of battery life at 1000Hz polling rate. 26000 DPI. 2.4GHz wireless dongle.',
      },
    )
    expect(specs).toMatchObject({
      lengthMm: 115.6,
      widthMm: 62,
      heightMm: 38,
      weightG: 52,
      sensor: 'PAW3395',
      conn24ghz: true,
    })
  })

  it('reads a Kensington finger trackball (no size, batteries, hands it suits)', () => {
    const { specs } = read(
      [
        [
          'Connectivité',
          'Récepteur USB 2,4 GHz, Bluetooth® LE, Dual USB Receiver & Bluetooth, Sans fil',
        ],
        ['Caractéristiques', 'Design ambidextre, Mode éveil/veille automatique, SmartFit™'],
        ['Diamètre du Trackball (mm)', '55'],
        ['PPP', '400'],
      ],
      {
        name: 'Trackball sans fil Expert Mouse',
        segment: 'office',
        text: "CONTRÔLE DE LA BOULE : Actionné par un doigt. Son design ambidextre convient aussi bien pour les droitiers qu'aux gauchers. La fonction de mise en veille préserve l'autonomie des piles AA. Ce produit est conçu pour s'adapter confortablement aux mains moyennes à grandes.",
      },
    )
    expect(specs).toMatchObject({
      shape: 'trackball',
      ballPosition: 'finger',
      hand: 'ambidextrous',
      conn24ghz: true,
      connBt: true,
      power: 'aa',
      dpiMax: 400,
      makerHandMinCm: 17,
      makerHandMaxCm: 21.5,
    })
    expect(specs.lengthMm).toBeUndefined()
  })

  it('sorts unlabelled measurements, a vertical mouse standing taller than wide', () => {
    const flat = read(
      [
        ['Dimensions', '63 x 40 x 125 mm'],
        ['Poids', '60 g'],
      ],
      { segment: 'gaming' },
    )
    expect(flat.specs).toMatchObject({ lengthMm: 125, widthMm: 63, heightMm: 40 })
    expect(flat.notes.join(' ')).toMatch(/sans ordre/)
    const vertical = read(
      [
        ['Dimensions', '120 x 78,5 x 70 mm'],
        ['Poids', '135 g'],
      ],
      {
        name: 'MX Vertical',
        segment: 'office',
      },
    )
    expect(vertical.specs).toMatchObject({
      shape: 'vertical',
      lengthMm: 120,
      heightMm: 78.5,
      widthMm: 70,
    })
  })

  it('reads an order the label names ("HxWxD")', () => {
    const { specs } = read(
      [
        ['Dimensions (HxWxD mm)', '42.5 x 64 x 120.5'],
        ['Poids (g)', '77'],
      ],
      {
        segment: 'gaming',
        shape: 'ergonomic',
      },
    )
    expect(specs).toMatchObject({ heightMm: 42.5, widthMm: 64, lengthMm: 120.5, weightG: 77 })
  })

  it('does not count a rate reached with a dongle sold separately', () => {
    const { specs, notes } = read(
      [
        ['Longueur', '127 mm'],
        ['Largeur', '64 mm'],
        ['Hauteur', '40 mm'],
        ['Poids', '54 g'],
        [
          "Taux d'interrogation",
          '4000 Hz ; 8000 Hz avec le dongle HyperPolling (vendu séparément)',
        ],
      ],
      { segment: 'gaming', shape: 'symmetrical' },
    )
    expect(specs.pollingHz).toBe(4000)
    expect(notes.join(' ')).toMatch(/vendu à part/)
  })
})
