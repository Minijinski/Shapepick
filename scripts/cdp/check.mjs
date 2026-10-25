// Checks the finder's scene in headless Chrome, each step on its own browser: what the pages draw
// on desktop and phone (counts and screenshots), hover, popup and drag on the keyboard canvas,
// then answers down to the short list. Exits 1 when a check fails.
//
//   pnpm check:scene [label]          against the dev server (http://localhost:3000)
//   BASE=https://shapepick.com pnpm check:scene prod
//
// Screenshots go to OUT (default: <tmp>/shapepick-check/<label>). Node 22+.

import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sceneReady, sleep, withChrome } from './cdp.mjs'

const label = process.argv[2] ?? 'check'
const { BASE = 'http://localhost:3000', OUT: out = join(tmpdir(), 'shapepick-check', label) } =
  process.env
const base = BASE.replace(/\/+$/, '')
mkdirSync(out, { recursive: true })

const failures = []
const report = (ok, what, detail = '') => {
  if (!ok) failures.push(what)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` · ${detail}` : ''}`)
}

/** Opens a page with the scene's stats exposed (production keeps them behind a flag). */
async function open(browser, path) {
  await browser.send('Page.addScriptToEvaluateOnNewDocument', {
    source: "try { localStorage.setItem('choose-a-device:stats', '1') } catch {}",
  })
  const errors = browser.errors()
  await browser.goto(`${base}${path}`)
  await sceneReady(browser, 2500)
  return errors
}

// The products drawn on the scene's canvas, found from its pixels (CSS px boxes), and whether each
// sits clear of the page's widgets and edges.
const PRODUCTS = `(() => {
  const canvas = document.querySelector('canvas')
  const dpr = canvas.width / canvas.clientWidth
  const W = canvas.width, H = Math.min(canvas.height, Math.round(innerHeight * dpr))
  const data = canvas.getContext('2d').getImageData(0, 0, W, H).data
  const C = Math.round(8 * dpr), cols = Math.floor(W / C), rows = Math.floor(H / C)
  const ink = new Uint8Array(cols * rows)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let n = 0
    for (let y = 0; y < C; y += 2) for (let x = 0; x < C; x += 2) {
      const i = ((r * C + y) * W + c * C + x) * 4
      const d = (data[i + 3] / 255) * (Math.abs(data[i] - 243) + Math.abs(data[i + 1] - 241) + Math.abs(data[i + 2] - 236))
      if (d > 45) n++
    }
    if (n > (C / 2) * (C / 2) * 0.5) ink[r * cols + c] = 1
  }
  const seen = new Uint8Array(cols * rows), found = []
  for (let s = 0; s < ink.length; s++) {
    if (!ink[s] || seen[s]) continue
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, count = 0
    const stack = [s]
    seen[s] = 1
    while (stack.length) {
      const k = stack.pop(), r = Math.floor(k / cols), c = k % cols
      count++
      x0 = Math.min(x0, c); x1 = Math.max(x1, c); y0 = Math.min(y0, r); y1 = Math.max(y1, r)
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc, kk = rr * cols + cc
        if (rr >= 0 && cc >= 0 && rr < rows && cc < cols && ink[kk] && !seen[kk]) { seen[kk] = 1; stack.push(kk) }
      }
    }
    if (count >= 12) found.push({ x: (x0 * C) / dpr, y: (y0 * C) / dpr, w: ((x1 - x0 + 1) * C) / dpr, h: ((y1 - y0 + 1) * C) / dpr, count })
  }
  const widgets = [...document.querySelectorAll('[data-keep-clear]')].map((e) => e.getBoundingClientRect())
  return found.map((b) => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    const edge = b.x < 16 || b.y < 200 || b.x + b.w > innerWidth - 16 || b.y + b.h > innerHeight - 16
    const covered = widgets.some((r) => cx > r.left - 40 && cx < r.right + 40 && cy > r.top - 40 && cy < r.bottom + 40)
    return { ...b, free: !edge && !covered }
  })
})()`

const POPUP = `(() => {
  const frame = document.querySelector('[data-popup-frame]')
  return {
    hover: document.querySelector('canvas').hasAttribute('data-hover'),
    name: frame?.innerText.split('\\n').slice(0, 2).join(' · ') ?? null,
  }
})()`

// 1. What the pages draw, on a laptop screen and on a phone.
for (const [width, height, paths] of [
  [1728, 1000, ['/fr', '/fr/claviers', '/fr/ecrans', '/fr/souris']],
  [390, 844, ['/fr', '/fr/claviers', '/fr/souris']],
]) {
  for (const path of paths) {
    const { drawn, errors } = await withChrome({ width, height }, async (browser) => {
      const errors = await open(browser, path)
      const drawn = await browser.evaluate('window.__scene?.stats().frame.onScreen ?? 0')
      await browser.shot(join(out, `${width}x${height}${path.replace(/\//g, '_')}.png`))
      return { drawn, errors }
    })
    report(
      drawn > 0 && !errors.length,
      `${path} at ${width}×${height}`,
      `${drawn} products on screen${errors.length ? `, errors: ${errors.join(' | ')}` : ''}`,
    )
  }
}

// 2. Hover, popup and drag on the keyboard canvas.
await withChrome({ width: 1728, height: 1000 }, async (browser) => {
  await open(browser, '/fr/claviers')
  const free = (await browser.evaluate(PRODUCTS)).filter((p) => p.free).slice(0, 3)
  let opened = 0
  for (const p of free) {
    const [x, y] = [p.x + p.w / 2, p.y + p.h / 2]
    await browser.mouse('mouseMoved', x - 30, y)
    await sleep(60)
    await browser.mouse('mouseMoved', x, y)
    await sleep(700)
    const popup = await browser.evaluate(POPUP)
    if (popup.hover && popup.name) opened++
  }
  report(
    free.length > 0 && opened === free.length,
    'hovering a product opens its popup',
    `${opened}/${free.length}`,
  )
  // The bare paper farthest from every product drawn takes no pointer.
  const all = await browser.evaluate(PRODUCTS)
  let paper = null
  for (let x = 320; x < 1690; x += 24) {
    for (let y = 220; y < 620; y += 24) {
      const d = Math.min(
        ...all.map((p) =>
          Math.max(
            Math.abs(x - (p.x + p.w / 2)) - p.w / 2,
            Math.abs(y - (p.y + p.h / 2)) - p.h / 2,
          ),
        ),
      )
      if (!paper || d > paper.d) paper = { x, y, d }
    }
  }
  await browser.mouse('mouseMoved', paper.x, paper.y)
  await sleep(700)
  report(!(await browser.evaluate(POPUP)).hover, 'bare paper opens no popup')
  // Dragging by (-180, -90): while held, the field has moved by exactly that much. (It drifts
  // until the press: read where the products are right before it.)
  const before = (await browser.evaluate(PRODUCTS)).filter((p) => p.free && p.count > 40)
  await browser.mouse('mousePressed', paper.x, paper.y)
  for (let i = 1; i <= 6; i++) {
    await browser.mouse('mouseMoved', paper.x - 30 * i, paper.y - 15 * i)
    await sleep(30)
  }
  await sleep(400)
  const after = await browser.evaluate(PRODUCTS)
  await browser.mouse('mouseReleased', paper.x - 180, paper.y - 90)
  const worst = Math.max(
    ...before.map((p) =>
      Math.min(
        ...after.map((a) =>
          Math.hypot(a.x + a.w / 2 - (p.x + p.w / 2) + 180, a.y + a.h / 2 - (p.y + p.h / 2) + 90),
        ),
      ),
    ),
  )
  report(
    before.length > 0 && worst <= 12,
    'the canvas follows a drag',
    `worst ${Math.round(worst)} px`,
  )
})

// 3. Answers (the first tile of each question) down to the short list.
await withChrome({ width: 1728, height: 1000 }, async (browser) => {
  const errors = await open(browser, '/fr/claviers')
  const field = `(() => { const k = window.__scene.stats().categories.keyboard; return { laidOut: k.laidOut, spot: k.spot } })()`
  const next = `(() => {
    const at = (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }
    const tiles = [...document.querySelectorAll('[data-option]:not([data-dead]) > button')].filter((e) => !e.disabled && e.offsetParent)
    const go = [...document.querySelectorAll('section button')].find((e) => !e.disabled && /Continuer|Continue|Peu importe|No preference|Aucun|None/.test(e.textContent))
    if (tiles.length && !tiles.some((e) => e.getAttribute('aria-pressed') === 'true')) return at(tiles[0])
    return go ? at(go) : null
  })()`
  let state = await browser.evaluate(field)
  const trail = [state.laidOut]
  for (let i = 0; i < 14 && !state.spot; i++) {
    const at = await browser.evaluate(next)
    if (!at) break
    await browser.click(at)
    await sleep(2200)
    state = await browser.evaluate(field)
    if (state.laidOut !== trail.at(-1)) trail.push(state.laidOut)
  }
  await browser.shot(join(out, 'short-list.png'))
  report(
    state.spot > 0 && !errors.length,
    'answers narrow the field down to a short list',
    `${trail.join(' → ')}, ${state.spot} in front${errors.length ? `, errors: ${errors.join(' | ')}` : ''}`,
  )
})

console.log(
  `\n${failures.length ? `${failures.length} failed` : 'all checks passed'} · screenshots in ${out}`,
)
process.exit(failures.length ? 1 : 0)
