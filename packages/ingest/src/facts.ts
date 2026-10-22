import { type HTMLElement, parse } from 'node-html-parser'

// Spec sheets come as label/value pairs in three shapes: two-column rows (`.spec-row` blocks,
// `.about__row` blocks, <table> rows) and "Label: value" lines, like the "Key specs" list of a Shopify description.
// Facts gathers them all and answers lookups by label, so mappers ask for "weight" without caring
// which template the page was built with.

export type Fact = { label: string; value: string }

const BR = ' [[br]] '
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
/** "Adjustable Ac-tuation Points" → "adjustableactuationpoints". */
const key = (label: string) =>
  label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

export function parseHtml(html: string): HTMLElement {
  return parse(
    html.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, BR),
  )
}

/** The text of an element, one entry per block or <br> line. */
export function linesOf(el: HTMLElement): string[] {
  return el.structuredText
    .split(/\n|\[\[br\]\]/)
    .map(clean)
    .filter(Boolean)
}

function rowFacts(root: HTMLElement): Fact[] {
  const out: Fact[] = []
  for (const row of root.querySelectorAll('.spec-row')) {
    const label = row.querySelector('.spec-label')
    const value = row.querySelector('.spec-value')
    if (label && value) out.push({ label: clean(label.text), value: linesOf(value).join(' ; ') })
  }
  // mechanicalkeyboards.com "Characteristics": <div class="about__row"><span>Label</span><span>…
  for (const row of root.querySelectorAll('.about__row')) {
    const [label, value] = row.querySelectorAll('span')
    if (label && value) out.push({ label: clean(label.text), value: clean(value.text) })
  }
  for (const tr of root.querySelectorAll('tr')) {
    const cells = tr.querySelectorAll('th, td')
    const [label, value] = cells
    if (cells.length === 2 && label && value) {
      out.push({ label: clean(label.text), value: clean(value.text) })
    }
  }
  return out
}

function colonFacts(lines: string[]): Fact[] {
  const out: Fact[] = []
  for (const [i, line] of lines.entries()) {
    const m = /^([A-Za-z][\w ()/&.+-]{1,60}?)\s*:\s*(.*)$/.exec(line)
    if (!m?.[1]) continue
    const value = m[2] || lines[i + 1] || ''
    if (value) out.push({ label: clean(m[1]), value: clean(value) })
  }
  return out
}

export class Facts {
  constructor(readonly list: Fact[]) {}

  static fromHtml(html: string, scope?: string) {
    const root = parseHtml(html)
    const el = (scope && root.querySelector(scope)) || root
    return new Facts([...rowFacts(el), ...colonFacts(linesOf(el))])
  }

  merge(other: Facts) {
    return new Facts([...this.list, ...other.list])
  }

  /** Values of the facts whose normalised label matches, in document order. */
  all(label: RegExp): string[] {
    return this.list.filter((f) => label.test(key(f.label))).map((f) => f.value)
  }

  /** Same, with the label kept in front: "Polling Rate (BT Mode): 90Hz" says which mode. */
  allWithLabel(label: RegExp): string[] {
    return this.list.filter((f) => label.test(key(f.label))).map((f) => `${f.label}: ${f.value}`)
  }

  first(label: RegExp): string | undefined {
    return this.all(label)[0]
  }

  /** Every label and value as one string, for keyword checks that must ignore menus and footers. */
  get text() {
    return this.list.map((f) => `${f.label}: ${f.value}`).join('\n')
  }
}

/** First number in a string, decimal comma accepted. */
export function num(s: string | undefined, unit?: RegExp): number | undefined {
  if (!s) return undefined
  const re = unit
    ? new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:${unit.source})`, 'i')
    : /(\d+(?:[.,]\d+)?)/
  const m = re.exec(s)
  return m?.[1] ? Number(m[1].replace(',', '.')) : undefined
}
