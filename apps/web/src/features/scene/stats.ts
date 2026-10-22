// What the scene costs, measured where it runs. Milestones go on the performance timeline
// (`scene:*` marks, visible in DevTools); frame times and long frames are kept in a small ring.
// In dev, or with `localStorage['choose-a-device:stats'] = '1'` in production, `__scene.stats()`
// in the console sums it all up with whatever the scene reports about its bitmaps.

const FRAMES = 240
const frames = new Float32Array(FRAMES)
let frameCount = 0
const marked = new Set<string>()
let longFrames = 0
let longBlocking = 0
let observing = false

/** Puts a milestone on the performance timeline, once. */
export function mark(name: string) {
  if (marked.has(name)) return
  marked.add(name)
  try {
    performance.mark(`scene:${name}`)
  } catch {}
}

/** One frame's duration in ms. */
export function frame(ms: number) {
  frames[frameCount % FRAMES] = ms
  frameCount++
}

function percentile(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
}

function enabled() {
  if (import.meta.env.DEV) return true
  try {
    return localStorage.getItem('choose-a-device:stats') === '1'
  } catch {
    return false
  }
}

/** Long animation frames (Chromium): how often, and how long the main thread was blocked. */
function observeLongFrames() {
  if (observing || typeof PerformanceObserver === 'undefined') return
  observing = true
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longFrames++
        longBlocking +=
          (entry as PerformanceEntry & { blockingDuration?: number }).blockingDuration ?? 0
      }
    }).observe({ type: 'long-animation-frame', buffered: true })
  } catch {}
}

/** Exposes `__scene.stats()`, adding what `read` reports (bitmaps, queues). */
export function exposeStats(read: () => Record<string, unknown>) {
  if (typeof window === 'undefined' || !enabled()) return () => {}
  observeLongFrames()
  const target = window as unknown as { __scene?: { stats: () => unknown } }
  target.__scene = {
    stats: () => {
      const recent = Array.from(frames.subarray(0, Math.min(frameCount, FRAMES))).sort(
        (a, b) => a - b,
      )
      return {
        ...read(),
        frames: {
          count: frameCount,
          p50: Math.round(percentile(recent, 0.5) * 10) / 10,
          p95: Math.round(percentile(recent, 0.95) * 10) / 10,
          max: Math.round(recent[recent.length - 1] ?? 0),
        },
        longFrames: { count: longFrames, blockingMs: Math.round(longBlocking) },
        marks: Object.fromEntries(
          performance
            .getEntriesByType('mark')
            .filter((m) => m.name.startsWith('scene:'))
            .map((m) => [m.name.slice(6), Math.round(m.startTime)]),
        ),
      }
    },
  }
  return () => {
    delete target.__scene
  }
}
