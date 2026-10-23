import type { MonitorSource } from '../../source'
import * as aoc from './aoc'
import * as asus from './asus'
import * as benq from './benq'
import * as dell from './dell'
import * as lg from './lg'
import * as msi from './msi'
import * as philips from './philips'
import * as samsung from './samsung'

// The monitor sources, by the name `pnpm ingest <name>` takes. One per brand site.
export const monitorSources: Record<string, MonitorSource> = {
  samsung: samsung.source,
  dell: dell.source,
  msi: msi.source,
  lg: lg.source,
  aoc: aoc.source,
  asus: asus.source,
  philips: philips.source,
  benq: benq.source,
}
