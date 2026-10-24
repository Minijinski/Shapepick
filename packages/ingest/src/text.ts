export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// keychron.fr translates option values, sometimes word by word ("Gateron Jupiter Marron", "Os nu"
// for Barebone). Variants only sold there (AZERTY ones, mostly) are read through this glossary.
const glossary: [RegExp, string][] = [
  [/\bnoir(?: de)? carbone\b/gi, 'Carbon Black'],
  [/\bcoquille blanc(?:he)?\b|\bblanc(?:he)? coquille\b/gi, 'Shell White'],
  [/\bos nu\b/gi, 'Barebone'],
  [/(?:\s+[àa])?\s+profil bas\b/gi, ' Low Profile'],
  [/\bm[ée]canique\b/gi, 'Mechanical'],
  [/,/g, ' '],
  [/\brouge\b/gi, 'Red'],
  [/\bmarron\b|\bbrun\b/gi, 'Brown'],
  [/\bbanane\b/gi, 'Banana'],
  [/\bbleu\b/gi, 'Blue'],
  [/\bjaune\b/gi, 'Yellow'],
  [/\bnoir\b/gi, 'Black'],
  [/\bblanc(?:he)?\b/gi, 'White'],
  [/\bgris\b/gi, 'Grey'],
  [/\bviolet\b/gi, 'Purple'],
  [/\bargent\b/gi, 'Silver'],
  [/\bmenthe\b/gi, 'Mint'],
  [/\bcommutateurs?\b|\binterrupteurs?\b/gi, 'Switches'],
]

export const fromFrench = (s: string) => glossary.reduce((acc, [re, en]) => acc.replace(re, en), s)
