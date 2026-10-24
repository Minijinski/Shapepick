import type { MouseSource } from '../../source'
import * as asus from './asus'
import * as corsair from './corsair'
import * as logitech from './logitech'
import * as msi from './msi'
import * as pulsar from './pulsar'
import * as razer from './razer'
import * as steelseries from './steelseries'
import * as stores from './stores'
import * as zowie from './zowie'

// The mouse sources, by the name `pnpm ingest <name>` takes. A name never clashes with a keyboard
// or monitor source of the same site: `razer` imports keyboards, `razer-mice` mice.
export const mouseSources: Record<string, MouseSource> = {
  ...logitech.sources,
  'razer-mice': razer.source,
  'steelseries-mice': steelseries.source,
  'rog-mice': asus.source,
  'corsair-mice': corsair.source,
  'msi-mice': msi.source,
  'pulsar-mice': pulsar.source,
  zowie: zowie.source,
  ...stores.sources,
}
