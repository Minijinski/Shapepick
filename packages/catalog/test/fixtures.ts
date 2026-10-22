import { fileURLToPath } from 'node:url'
import { toKeyboardItems, toMonitorItems } from '../src'
import { loadData } from '../src/node/load-data'

// The demo catalogue (fictional brands, specs chosen to exercise every question), frozen here so the
// finder tests do not follow the real data in data/, which changes with every import.
const dataDir = fileURLToPath(new URL('./demo', import.meta.url))
const data = await loadData(dataDir)

export const keyboards = toKeyboardItems(data.keyboards, data.brands, data.switches)
export const monitors = toMonitorItems(data.monitors, data.brands)
