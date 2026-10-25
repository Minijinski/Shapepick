// Headless Chrome over the DevTools protocol, for checking the site in a real browser from a
// script (Node 22+: it uses the built-in WebSocket). Several Claude sessions often run their own
// headless Chrome on this machine at once, so this harness is built to survive them:
// - a Chrome killed from outside (on 2026-10-25 every "frozen" page was in fact that: another
//   session's commands ending took it down) rejects every pending call at once with `ChromeGone`,
//   and `withChrome` runs the step again on a fresh one;
// - Chrome takes a free DevTools port itself (`--remote-debugging-port=0`, read back from
//   `DevToolsActivePort`), so it never meets another session's Chrome on a fixed port;
// - every call has a timeout, and the temporary profile goes with the browser.
// Pages under test get a dead WebSocket: Vite's HMR client never connects, so other sessions'
// edits cannot reload them mid-measure.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Options: another Chrome binary (CHROME), where temporary profiles go (SCRATCH).
const {
  CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  SCRATCH = tmpdir(),
} = process.env

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Chrome went away under the script (killed, crashed, closed). */
export class ChromeGone extends Error {}

/**
 * A fresh headless Chrome showing one page, `width` × `height` CSS px at `dpr` (a width under
 * 768 px emulates a phone: mobile viewport, touch). `timeout` bounds every DevTools call (ms).
 */
export async function launch({
  width = 1728,
  height = 1000,
  dpr = 1,
  mobile = width < 768,
  timeout = 30000,
} = {}) {
  if (typeof WebSocket === 'undefined') throw new Error('Node 22+ is needed (global WebSocket)')
  const profile = mkdtempSync(join(SCRATCH, 'chrome-'))
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      `--force-device-scale-factor=${dpr}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-background-timer-throttling',
    ],
    { stdio: 'ignore' },
  )
  let gone = null
  let ws = null
  const pending = new Map()
  // Rejects once Chrome is gone, for whatever waits on an event rather than on a call.
  let markGone
  const goneSignal = new Promise((_, reject) => {
    markGone = reject
  })
  goneSignal.catch(() => {})
  const fail = (why) => {
    if (gone) return
    gone = new ChromeGone(why)
    markGone(gone)
    for (const settle of pending.values()) settle(gone)
    pending.clear()
  }
  proc.on('exit', (code, signal) => fail(`Chrome exited (${signal ?? `code ${code}`})`))
  const close = () => {
    fail('closed')
    try {
      ws?.close()
    } catch {}
    proc.kill('SIGKILL')
    // Its helpers may still be writing into the profile for a moment after the kill.
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } catch {}
  }

  // Chrome writes the port it took into the profile once DevTools listens.
  const portFile = join(profile, 'DevToolsActivePort')
  let port = null
  for (let i = 0; i < 300 && !port && !gone; i++) {
    if (existsSync(portFile)) port = Number(readFileSync(portFile, 'utf8').split('\n')[0]) || null
    if (!port) await sleep(100)
  }
  let page = null
  for (let i = 0; port && i < 50 && !page; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      page = targets.find((t) => t.type === 'page') ?? null
    } catch {}
    if (!page) await sleep(100)
  }
  if (!page) {
    close()
    throw gone ?? new ChromeGone('DevTools never came up')
  }
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new ChromeGone('DevTools socket error')), {
      once: true,
    })
  })
  ws.addEventListener('close', () => fail('DevTools socket closed'))
  let id = 0
  const listeners = []
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data)
    const settle = msg.id && pending.get(msg.id)
    if (settle) {
      pending.delete(msg.id)
      settle(msg)
    } else for (const listen of listeners) listen(msg)
  })

  /** One DevTools call; rejects on error, on timeout, or as soon as Chrome is gone. */
  const send = (method, params = {}, ms = timeout) =>
    new Promise((resolve, reject) => {
      if (gone) return reject(gone)
      const n = ++id
      const timer = setTimeout(() => {
        pending.delete(n)
        reject(new Error(`DevTools call timed out after ${ms} ms: ${method}`))
      }, ms)
      pending.set(n, (msg) => {
        clearTimeout(timer)
        if (msg instanceof Error) reject(msg)
        else if (msg.error) reject(new Error(`${method}: ${msg.error.message}`))
        else resolve(msg.result)
      })
      ws.send(JSON.stringify({ id: n, method, params }))
    })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: dpr,
    mobile,
  })
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      'window.WebSocket = class { constructor() {} send() {} close() {} addEventListener() {} removeEventListener() {} }',
  })

  /** The value of an expression in the page (awaited when it is a promise). */
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    }
    return r.result.value
  }

  /** Opens `url` and waits for its load event. */
  const goto = async (url) => {
    let loaded
    const load = new Promise((resolve) => {
      loaded = resolve
    })
    const onLoad = (msg) => msg.method === 'Page.loadEventFired' && loaded()
    listeners.push(onLoad)
    let timer
    try {
      await send('Page.navigate', { url })
      await Promise.race([
        load,
        goneSignal,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Page never loaded: ${url}`)), 60000)
        }),
      ])
    } finally {
      clearTimeout(timer)
      listeners.splice(listeners.indexOf(onLoad), 1)
    }
  }

  /** A PNG of the viewport (or of `clip`) written to `file`. */
  const shot = async (file, clip) => {
    const r = await send('Page.captureScreenshot', {
      format: 'png',
      ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
    })
    writeFileSync(file, Buffer.from(r.data, 'base64'))
  }

  /** A real mouse event at (x, y): mouseMoved, mousePressed or mouseReleased. */
  const mouse = (type, x, y) =>
    send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: type === 'mouseMoved' ? 'none' : 'left',
      clickCount: type === 'mouseMoved' ? 0 : 1,
      pointerType: 'mouse',
    })

  /** Clicks the middle of a CSS px point. */
  const click = async ([x, y]) => {
    await mouse('mouseMoved', x, y)
    await sleep(80)
    await mouse('mousePressed', x, y)
    await mouse('mouseReleased', x, y)
  }

  /** Collects the page's uncaught exceptions and console errors from now on. */
  const errors = () => {
    const list = []
    listeners.push((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const details = msg.params.exceptionDetails
        list.push(details?.exception?.description ?? details?.text)
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        list.push(
          msg.params.args
            .map((a) => a.value ?? a.description)
            .join(' ')
            .slice(0, 300),
        )
      }
    })
    return list
  }

  return { send, evaluate, goto, shot, mouse, click, errors, close, listeners, pid: proc.pid, port }
}

/**
 * Runs `step(browser, attempt)` on a fresh Chrome and closes it after. When Chrome dies under the
 * step, says so and runs the step again on a new one, up to `tries` times; other errors are
 * thrown as they are.
 */
export async function withChrome(options, step, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    const browser = await launch(options)
    try {
      return await step(browser, attempt)
    } catch (e) {
      if (!(e instanceof ChromeGone) || attempt >= tries) throw e
      console.log(`  (Chrome ${browser.pid} gone: ${e.message}; again on a fresh one)`)
    } finally {
      browser.close()
    }
  }
}

/**
 * Waits until the site's scene has made its entrance (the preloader let go and products are
 * drawn), then `settle` ms more. `__scene` is exposed in dev, or with
 * `localStorage['choose-a-device:stats'] = '1'` in production.
 */
export async function sceneReady(browser, settle = 3000) {
  for (let i = 0; i < 120; i++) {
    const drawn = await browser.evaluate(
      `!document.documentElement.hasAttribute('data-loading') && (window.__scene?.stats().frame.products ?? 0) > 0`,
    )
    if (drawn) break
    await sleep(250)
  }
  await sleep(settle)
}
