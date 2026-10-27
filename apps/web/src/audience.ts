// Events for the audience tool, Umami, whose script runs only once the site has its id (site.ts,
// routes/__root.tsx). Without the script, or in a browser that turned it off (legal pages), they
// go nowhere. They name what was done, never who did it.

declare global {
  interface Window {
    /** Umami's tracker, once its script has run. */
    umami?: { track: (event: string, data?: Record<string, string>) => void }
  }
}

/** Sends one event, with its few properties: each one counts against the plan's monthly events. */
export function track(event: string, data?: Record<string, string>) {
  try {
    window.umami?.track(event, data)
  } catch {
    // Never in the visitor's way.
  }
}
