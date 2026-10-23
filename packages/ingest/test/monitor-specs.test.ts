import { describe, expect, it } from 'vitest'
import { Facts } from '../src/facts'
import { aspectOf, monitorSpecsOf, panelOf } from '../src/monitor-specs'
import { Skip } from '../src/source'

// Real label/value pairs as the brands' French pages word them (read on 23 October 2026), the
// ambiguous stand labels already renamed by their adapters (Swivel, Pivot).

const sheet = (pairs: [string, string][]) =>
  new Facts(pairs.map(([label, value]) => ({ label, value })))
const read = (pairs: [string, string][], name = '', text = '') =>
  monitorSpecsOf(sheet(pairs), { name, text }).specs

describe('monitor sheets, brand by brand', () => {
  it('reads Samsung (OLED with Quantum Dot, fractions, EA counts)', () => {
    const s = read([
      ["Taille de l'écran", '27'],
      ['Résolution', 'QHD (2,560 x 1,440)'],
      ['Format', '16:9'],
      ['Type de dalle', 'OLED'],
      ['Quantum Dot Color', 'Oui'],
      ['Plat / Incurvé', 'Plat'],
      ['Taux de rafraîchissement', 'Max 500Hz'],
      ['Temps de réponse', '0.03ms(GTG)'],
      ['FreeSync', 'FreeSync Premium Pro'],
      ['G-Sync', 'G-Sync Compatible'],
      ['HDR(High Dynamic Range)', 'VESA DisplayHDR True Black 500'],
      ['Luminosité', '250 cd/㎡'],
      ['Luminosité (Min)', '100 cd/㎡'],
      ['Rapport de contraste (statique)', '1,000,000:1(Typ.)'],
      ['Gamme de couleurs (DCI Coverage)', '99% (CIE1976)'],
      ['Gamme de couleur (sRGB Coverage)', '0.99'],
      ['Prise en charge des couleurs', 'Max 1B'],
      ['Display Port', '1 EA'],
      ['Version du DisplayPort', '1.4'],
      ['HDMI', '2 EA'],
      ['Version HDMI', '2.1'],
      ['Hub USB', '2'],
      ['Haut-parleurs', 'Non'],
      ['Ajustable en hauteur', '120.0(±5.0)'],
      ['Inclinaison', '-2.0˚(±2.0˚) ~ 25.0˚(±2.0˚)'],
      ['Swivel', '-30.0˚(±2.0˚) ~ 30.0˚(±2.0˚)'],
      ['Pivot', '-92˚~92˚'],
      ['Support mural', '100 x 100'],
      ["Poids de l'ensemble avec pied", '6.4 kg'],
      ["Poids de l'ensemble sans pied", '3.9 kg'],
      ['UL Glare Free', 'Oui'],
    ])
    expect(s).toMatchObject({
      diagonalIn: 27,
      aspect: '16:9',
      resW: 2560,
      resH: 1440,
      panel: 'qdoled',
      coating: 'matte',
      refreshHzMax: 500,
      responseGtgMs: 0.03,
      vrr: 'freesync_premium_pro',
      hdrCert: 'true_black_500',
      brightnessSdrNits: 250,
      dciP3Pct: 99,
      srgbPct: 99,
      bitDepth: 10,
      hdmiPorts: 2,
      hdmiVersion: '2.1',
      dpVersion: '1.4',
      usbcPdW: 0,
      usbHub: true,
      speakers: false,
      standHeightMm: 120,
      heightAdjustable: true,
      tilt: true,
      swivel: true,
      pivot: true,
      vesa: true,
      weightG: 6400,
    })
    expect(s.contrastStatic).toBeUndefined()
    expect(s.curvatureR).toBeUndefined()
  })

  it('reads a Samsung Mini-LED VA with Quantum Dot as Mini-LED, not QD-OLED', () => {
    const s = read([
      ["Taille de l'écran", '32'],
      ['Résolution', '4K UHD (3,840 x 2,160)'],
      ['Type de dalle', 'VA'],
      ['Quantum Dot Color', 'Oui'],
      ['Mini LED Local Dimming', 'Oui (1,196 zones)'],
      ['Plat / Incurvé', 'Incurvé'],
      ["Courbure d'écran", '1000R'],
      ['Taux de rafraîchissement', 'Max 240Hz'],
    ])
    expect(s).toMatchObject({ panel: 'miniled_va', dimmingZones: 1196, curvatureR: 1000 })
  })

  it('reads LG (WOLED, version in brackets, no stand travel)', () => {
    const { specs: s, notes } = monitorSpecsOf(
      sheet([
        ['Taille [pouce]', '26.5 pouces'],
        ['Taille [cm]', '67.3 cm'],
        ['Resolution', '2560 x 1440'],
        ["Format de l'image", '16:9'],
        ['Courbure', 'Non'],
        ['Dalle', 'OLED'],
        ['Taux de rafraîchissement (max.) [Hz]', '480 Hz'],
        ['Temps de réponse', '0.03ms (GTG)'],
        ['NVIDIA G-Sync™', 'G-SYNC Compatible'],
        ['AMD FreeSync™', 'FreeSync Premium Pro'],
        ['HDR 10', 'Oui'],
        ['VESA DisplayHDR™', 'DisplayHDR™ TRUE BLACK 400'],
        ['Luminosité (Typ.) [cd/m²]', '275cd/m²'],
        ['Taux de contraste (Typ.)', '1500000:1'],
        ['Gamme de couleurs (Typ.)', 'DCI-P3 98.5% (CIE1976)'],
        ['Profondeur de couleur (nombre de couleurs)', '1.07B'],
        ['HDMI', 'Oui(2.1)'],
        ['Version DP', '2.1'],
        ['Haut-parleurs', 'Non'],
        ['Height adjustment', 'Oui'],
        ['Swivel', 'Oui'],
        ['Pivot', 'Oui'],
        ['Installation au mur [mm]', '100 x 100 mm'],
        ['Poids sans le support [kg]', '5.1kg'],
        ['Poids avec le support [kg]', '6.8kg'],
      ]),
      { name: 'UltraGear 27GX790A' },
    )
    expect(s).toMatchObject({
      diagonalIn: 26.5,
      panel: 'woled',
      refreshHzMax: 480,
      hdrCert: 'true_black_400',
      brightnessSdrNits: 275,
      dciP3Pct: 98.5,
      bitDepth: 10,
      hdmiPorts: 1,
      hdmiVersion: '2.1',
      dpVersion: '2.1',
      heightAdjustable: true,
      standHeightMm: 0,
      swivel: true,
      pivot: true,
      weightG: 6800,
    })
    expect(notes).toContain('OLED sans précision : WOLED supposé')
  })

  it('reads Dell (class size, OLED peak as its only brightness, "compatible avec … G-Sync")', () => {
    const s = read(
      [
        ["Classe de taille d'écran", '32"'],
        ["Taille de l'écran visible", '80,3 cm (31,6")'],
        ['Résolution maximum', '3840 x 2160'],
        ["Technologie d'écran", 'Quantum Dot OLED'],
        ['Écran incurvé', 'Oui'],
        ['Courbure', '1700R'],
        ['Traitement de surface', 'Antiréfléchissante'],
        ['Taux de rafraîchissement standard', '240 Hz'],
        ['Détails du temps de réponse', '0.03 ms GTG'],
        ['Technologie anti-déchirures', 'Compatible avec VESA Adaptive Sync/NVIDIA ® G-Sync'],
        ['Luminosité', '1000 cd/m²'],
        ['Gamme de couleurs', '100% sRGB (CIE 1931) 99% DCI-P3 (CIE 1976)'],
        ['Couleur prise en charge', '1,07 milliards de couleurs'],
        ['Nombre de ports HDMI 2.1', '2'],
        ['Nombre de ports DisplayPort 1.4', '1'],
        ['Hauts-Parleurs', 'Non'],
        ['Hauteur maximum ajustable', '110 mm'],
        ['Swivel', '+/-20 °'],
        ['Norme de montage VESA', '100 x 100'],
        ['Poids avec support (approx.)', '8,3 kg'],
      ],
      'Écran gaming Alienware 32 4K QD-OLED - AW3225QF',
      'Certifié VESA DisplayHDR True Black 400.',
    )
    expect(s).toMatchObject({
      diagonalIn: 32,
      panel: 'qdoled',
      curvatureR: 1700,
      refreshHzMax: 240,
      vrr: 'gsync_compatible',
      hdrCert: 'true_black_400',
      brightnessHdrPeakNits: 1000,
      dciP3Pct: 99,
      srgbPct: 100,
      bitDepth: 10,
      hdmiPorts: 2,
      hdmiVersion: '2.1',
      dpVersion: '1.4',
      standHeightMm: 110,
      pivot: false,
      weightG: 8300,
    })
    expect(s.brightnessSdrNits).toBeUndefined()
  })

  it('reads Philips (curvature in another row, kHz beside Hz, VESA in a sentence)', () => {
    const s = read([
      ['Taille de la dalle', '27 pouces / 68.5 cm'],
      ["Format d'image", '16:9'],
      ['Résolution maximale', 'HDMI: 2560 x 1440@144Hz, DP: 2560 x 1440@180Hz'],
      ["Type d'écran LCD", 'Fast VA'],
      ['Zone de visualisation efficace', '596.74 (H) x 335.66 (V) mm - à une courbure 1500R*'],
      ["Revêtement de l'écran", 'Antireflet, 3H, voile 25%'],
      ['Fréquence de balayage', '30 - 230 kHz (H) / 48 - 180 Hz (V)'],
      ['Temps de réponse (type)', '1 ms (gris à gris)*'],
      ['Smart MBR', '0.5 ms*'],
      ['Technologie AMD FreeSync™', 'Oui'],
      ['HDR', 'Compatible HDR 10'],
      ['Luminosité', '300'],
      ['Niveau de contraste (standard)', '3000:1'],
      ['Gamme de couleurs (type)', 'NTSC : 111%, sRGB : 122%, DCI-P3 : 95%'],
      ["Couleurs d'affichage", '16.7 M (8 bits)'],
      ['Entrée de signal', 'HDMI 2.0 x 2, DisplayPort 1.4 x 1'],
      ['Inclinaison', '-5/20 degrés'],
      ['Autres fonctionnalités', 'Fixation VESA (100 x 100 mm)'],
      ['Produit avec support (kg)', '4.6 kg'],
    ])
    expect(s).toMatchObject({
      panel: 'va',
      curvatureR: 1500,
      refreshHzMax: 180,
      responseGtgMs: 1,
      vrr: 'freesync',
      hdrCert: 'none',
      brightnessSdrNits: 300,
      contrastStatic: 3000,
      dciP3Pct: 95,
      srgbPct: 122,
      bitDepth: 8,
      hdmiPorts: 2,
      hdmiVersion: '2.0',
      vesa: true,
      heightAdjustable: false,
      weightG: 4600,
    })
  })

  it('reads ASUS (S/O for "none", counts after an x)', () => {
    const s = read([
      ['Taille de la dalle (pouces)', '27'],
      ['Type de dalle', 'Fast IPS'],
      ['Résolution', '2560x1440'],
      ['Courbure', 'S/O'],
      ["Surface d'affichage", 'Anti-reflets'],
      ['Fréquence de rafraîchissement (max)', '320Hz'],
      ['Temps de réponse', '1ms(GTG), 0.3ms(min.)'],
      ['Technologie VRR', 'Oui (Adaptive-Sync)'],
      ['Certifications', 'G-SYNC Compatible, AMD FreeSync Premium'],
      ['Support HDR (High Dynamic Range)', 'HDR10'],
      ['Luminosité (Typ.)', '300cd/㎡'],
      ['Ratio de contraste (Typ.)', '1000:1'],
      ['Espace des couleurs (DCI-P3)', '95%'],
      ['Espace des couleurs (sRGB)', '130%'],
      ['DisplayPort 1.4', 'x 1'],
      ['HDMI(v2.1)', 'x 2'],
      ['Switch KVM', 'S/O'],
      ['Haut-parleur', 'Oui (2W x 2)'],
      ['Inclinaison', 'Oui (+20° ~ -5°)'],
      ['Swivel', 'Oui (+30° ~ -30°)'],
      ['Pivot', 'Oui (+90° ~ -90°)'],
      ['Ajustement de la hauteur', '0~120mm'],
      ['Montage mural VESA', '100X100 mm'],
      ['Poids net', '4.5 kg (9.92 lbs)'],
      ['Poids net sans support', '3.6 kg'],
    ])
    expect(s).toMatchObject({
      panel: 'ips',
      refreshHzMax: 320,
      responseGtgMs: 1,
      vrr: 'freesync_premium',
      hdrCert: 'none',
      dciP3Pct: 95,
      srgbPct: 130,
      hdmiPorts: 2,
      hdmiVersion: '2.1',
      dpVersion: '1.4',
      kvm: false,
      speakers: true,
      standHeightMm: 120,
      pivot: true,
      weightG: 4500,
    })
    expect(s.curvatureR).toBeUndefined()
  })

  it('reads MSI (curly inch mark, aligned gamut lists, net / gross weight)', () => {
    const s = read([
      ['Taille de la dalle', '26.5“(67.31cm)'],
      ['Courbure', 'Flat'],
      ['Type de dalle', 'QD-OLED'],
      ['Résolution', '2560x1440 (WQHD)'],
      ['Luminosité', '250 (Typ.)'],
      ['Contraste', '1500000:1 (Typ.)'],
      ['Taux de rafraîchissement', '360Hz'],
      ['Plage de fréquences de rafraîchissement', '48~360Hz'],
      ['Temps de réponse', '0.03ms (GtG)'],
      ['Technologie de rafraîchissement dynamique', 'AMD FreeSync™ Premium Pro'],
      ['Support HDR', 'DisplayHDR True Black 400'],
      ['Adobe RGB / DCI-P3 / sRGB', '98% / 99% / 138%'],
      ['Affichage des couleurs', '1.07B ,10 bits'],
      ['Traitement de la dalle', 'Anti-Reflection'],
      [
        'Entrées vidéo',
        '1 x DisplayPort 1.4a / 2 x HDMI™ 2.1 (WQHD@360Hz) / 1 x Type-c (DP alt.) w/PD 90W',
      ],
      ["Réglage de l'inclinaison", '-5° ~ 20°'],
      ['Réglage de la hauteur', '0 ~ 110 mm'],
      ['Swivel', '-30° ~ 30°'],
      ['Pivot', '-90° ~ 90°'],
      ['Fixation VESA', '100 x 100 mm'],
      ['Poids', '8.3 / 10.9 kg'],
    ])
    expect(s).toMatchObject({
      diagonalIn: 26.5,
      panel: 'qdoled',
      refreshHzMax: 360,
      brightnessSdrNits: 250,
      vrr: 'freesync_premium_pro',
      hdrCert: 'true_black_400',
      dciP3Pct: 99,
      srgbPct: 138,
      bitDepth: 10,
      hdmiPorts: 2,
      hdmiVersion: '2.1',
      dpVersion: '1.4',
      usbcPdW: 90,
      standHeightMm: 110,
      weightG: 8300,
    })
    expect(s.contrastStatic).toBeUndefined()
  })

  it('reads MSI English sheets (Adjustment rows, SDR brightness, cables are no ports)', () => {
    const s = read([
      ['Screen Size', '27" (68.58 cm)'],
      ['Panel Type', 'IPS'],
      ['Resolution', '2560x1440 (WQHD)'],
      ['SDR Brightness (nits)', '250'],
      ['Contrast Ratio', '1300:1'],
      ['DCR (Dynamic Contrast Ratio)', '100000000:1'],
      ['Refresh Rate', '100HZ'],
      ['Response Time (MPRT)', '1ms(MPRT)'],
      ['Response Time (GTG)', '4ms'],
      ['DCI-P3 (CIE1976 area percentage/overlap)', '79%/79%'],
      ['sRGB (CIE1976 area percentage/overlap)', '100%/95%'],
      ['Surface Treatment', 'Anti-glare'],
      ['Color bit', '10 bits (8 bits + FRC)'],
      ['Speaker', '2Wx 2'],
      ['HDMI', '2'],
      ['HDMI version', '2.0b'],
      ['HDMI HDCP version', '2.3'],
      ['DisplayPort version', '1.2a'],
      ['HDMI Cable', '1'],
      ['Adjustment (Tilt)', '-5° ~ 20°'],
      ['Adjustment (Swivel)', '-45° ~ 45°'],
      ['Adjustment (Height)', '0 ~ 130 mm'],
      ['Adjustment (Pivot)', '-90° ~ 90°'],
      ['VESA Mounting', '100x100mm'],
      ['Weight (Net kg)', '7.05'],
      ['Weight (Gross kg)', '10.24'],
    ])
    expect(s).toMatchObject({
      brightnessSdrNits: 250,
      contrastStatic: 1300,
      refreshHzMax: 100,
      responseGtgMs: 4,
      dciP3Pct: 79,
      srgbPct: 100,
      bitDepth: 10,
      speakers: true,
      hdmiPorts: 2,
      hdmiVersion: '2.0',
      dpVersion: '1.2',
      standHeightMm: 130,
      swivel: true,
      pivot: true,
      weightG: 7050,
    })
  })

  it('reads AOC (GtG and MPRT rows, label-carried colour spaces, dual mode)', () => {
    const s = read([
      ["Taille de l'écran (pouces)", '26.5'],
      ['Taille de l’écran (cm)', '67.3'],
      ['Résolution de la dalle', '2560x1440'],
      ['Type de dalle', 'QD - OLED'],
      ['Plat / incurvé', 'Plat'],
      ['Max Fréquence de rafraîchissement', '240 Hz'],
      ['Temps de réponse GtG', '0.03 ms'],
      ['Temps de réponse MPRT', '0,5 ms'],
      ['Technologie de synchronisation (VRR)', 'Adaptive Sync'],
      ['NVIDIA G-SYNC™', 'NVIDIA G-SYNC Compatible'],
      ['HDR (High Dynamic Range)', 'VESA Certified DisplayHDR™ True Black 400'],
      ['Luminosité en nits', '1000 cd/m²'],
      ['Rapport de contraste statique', '1.5M:1'],
      ['Espace chromatique (DCI-P3) CIE 1976 %', '99.1'],
      ['Espace chromatique (sRGB) CIE 1976 %', '138.4'],
      ["Couleurs d'affichage", '1.073B (10 bits)'],
      ['HDMI', 'HDMI 2.1 x 2'],
      ['DisplayPort', 'DisplayPort 1.4 x 1'],
      ['KVM', 'No'],
      ['Haut-parleurs', 'No'],
      ['Réglage en hauteur (mm)', '130mm'],
      ['Inclinaison', '­5°~20°'],
      ['Swivel', '30°'],
      ['Pivot', '­90°~90°'],
      ['Fixation murale Vesa', '100x100'],
      ['Poids net emballage exclus (en kg)', '6.5'],
    ])
    expect(s).toMatchObject({
      diagonalIn: 26.5,
      panel: 'qdoled',
      refreshHzMax: 240,
      responseGtgMs: 0.03,
      vrr: 'gsync_compatible',
      hdrCert: 'true_black_400',
      brightnessHdrPeakNits: 1000,
      dciP3Pct: 99.1,
      srgbPct: 138.4,
      bitDepth: 10,
      hdmiPorts: 2,
      kvm: false,
      speakers: false,
      standHeightMm: 130,
      swivel: true,
      pivot: true,
      weightG: 6500,
    })
    const dual = read([
      ["Taille de l'écran (pouces)", '27'],
      ['Résolution de la dalle', '3840x2160'],
      ['Type de dalle', 'Fast IPS'],
      ['Max Fréquence de rafraîchissement', 'UHD@160Hz / FHD@320Hz Dual Frame Monitor'],
    ])
    expect(dual).toMatchObject({ refreshHzMax: 160, dualModeHz: 320 })
  })

  it('reads BenQ (version in the label, count in the value; HDR peak row)', () => {
    const s = read([
      ['Taille de l’écran', '27 pouce'],
      ['Résolution (max)', '2560x1440'],
      ['Type de dalle', 'IPS'],
      ['Revêtement de l’écran', 'Anti-éblouissement'],
      ['Taux de rafraîchissement (Hz)', '165'],
      ['Temps de réponse (GàG)', '1 ms'],
      ['FreeSync Premium Pro', 'Oui'],
      ['HDR', 'HDR10, VESA DisplayHDR 400'],
      ['Luminosité (typ.)', '250 cd/m2'],
      ['Luminosité (pic)(HDR)', '400 cd/m2'],
      ['Contraste natif', '1000:1'],
      ['Gamme de couleurs', '95% P3'],
      ['Affichage des couleurs', '1,07 milliards de couleurs'],
      ['HDMI (v2.0)', '2'],
      ['HDMI (v2.1) eARC', '1'],
      ['DisplayPort (v1.4)', '1'],
      ['Haut-parleur intégré', '2.1 (2Wx2 + caisson de basses 5W)'],
      ['Pied réglable en hauteur', '100 mm'],
      ['Inclinaison (bas/haut)', '-5˚ - 20˚'],
      ['Swivel', '15˚/15˚'],
      ['Montage mural VESA', '100x100 mm'],
      ['Poids net (kg)', '6.2'],
    ])
    expect(s).toMatchObject({
      refreshHzMax: 165,
      responseGtgMs: 1,
      vrr: 'freesync_premium_pro',
      hdrCert: 'hdr400',
      brightnessSdrNits: 250,
      brightnessHdrPeakNits: 400,
      contrastStatic: 1000,
      dciP3Pct: 95,
      bitDepth: 10,
      hdmiPorts: 3,
      hdmiVersion: '2.1',
      dpVersion: '1.4',
      speakers: true,
      standHeightMm: 100,
      weightG: 6200,
    })
  })

  it('reads the rate at the maximum resolution before a Philips scan range', () => {
    const sheet = (rows: [string, string][]) =>
      read([['Diagonale', '27 pouces'], ['Type de dalle', 'IPS'], ...rows])
    // 27B2G5601: a 100 Hz panel behind a 30-150 Hz scaler.
    expect(
      sheet([
        ['Résolution optimale', '2560 x 1440 à 60 Hz'],
        ['Résolution maximale', '2560 x 1440 à 100 Hz (HDMI/DP/USB-C)'],
        ['Fréquence de balayage', '48-100 kHz (H) / 30-150 Hz (V)'],
      ]).refreshHzMax,
    ).toBe(100)
    // 34B2U5900C: 5K2K at 120 Hz, 240 Hz in its WFHD dual mode.
    const dual = sheet([
      ['Résolution maximale', '5120x2160@120Hz (HDMI/DP/USB-C)'],
      [
        'Fréquence de balayage',
        'Mode WUHD : 30 - 270 kHz (H) / 48 - 120 Hz (V) ; mode WFHD : 30 - 270 kHz (H) / 48 - 240 Hz (V)',
      ],
      ['Dual mode', 'WUHD 5120x2160@120Hz / WFHD 2560x1080@240Hz'],
    ])
    expect(dual).toMatchObject({ refreshHzMax: 120, dualModeHz: 240 })
  })

  it('works a BenQ size out of its pixel density when the sheet gives no size (SW272QN)', () => {
    const sheet = (ppp: string, resolution: string) =>
      read([
        ['Type de dalle', 'IPS'],
        ['Résolution (max)', resolution],
        ['Taux de rafraîchissement (Hz)', '60'],
        ['PPP', ppp],
      ])
    expect(sheet('109', '2560x1440').diagonalIn).toBe(27)
    expect(sheet('93', '1920x1080').diagonalIn).toBe(23.8)
    expect(sheet('140', '3840x2160').diagonalIn).toBe(31.5)
  })
})

describe('what the finder does not take', () => {
  const skip = (pairs: [string, string][]) => () => read(pairs)
  it('leaves portable screens out', () => {
    expect(
      skip([
        ['Taille de la dalle (pouces)', '15.6'],
        ['Résolution', '1920x1080'],
        ['Type de dalle', 'IPS'],
      ]),
    ).toThrow(Skip)
  })
  it('leaves an aspect ratio it does not list out (LG DualUp, 16:18)', () => {
    expect(
      skip([
        ['Taille [pouce]', '27.6 pouces'],
        ['Resolution', '2560 x 2880'],
        ['Dalle', 'IPS'],
        ['Taux de rafraîchissement (max.) [Hz]', '60 Hz'],
      ]),
    ).toThrow(/2560×2880/)
  })
  it('maps ratios and panel words', () => {
    expect(aspectOf(3440, 1440)).toBe('21:9')
    expect(aspectOf(3840, 1600)).toBe('21:9')
    expect(aspectOf(5120, 1440)).toBe('32:9')
    expect(aspectOf(1920, 1200)).toBe('16:10')
    expect(aspectOf(3840, 2560)).toBe('3:2')
    expect(panelOf('Technologie In-Plane Switching (IPS) Noir').panel).toBe('ips')
    expect(panelOf('Tandem QD-OLED').panel).toBe('qdoled')
    expect(panelOf('Mini LED ; IPS').panel).toBe('miniled_ips')
    expect(panelOf('Cristal liquide rapide ; TN').panel).toBe('tn')
  })
})
