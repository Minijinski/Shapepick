import type { MouseSource } from '../../source'

// The mouse sources, by the name `pnpm ingest <name>` takes. A name never clashes with a keyboard
// or monitor source of the same site: `razer` imports keyboards, `razer-mice` mice.
export const mouseSources: Record<string, MouseSource> = {}
