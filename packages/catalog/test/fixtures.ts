import { fileURLToPath } from 'node:url'
import { toKeyboardItems, toMonitorItems } from '../src'
import { loadData } from '../src/node/load-data'

const dataDir = fileURLToPath(new URL('../../../data', import.meta.url))
const data = await loadData(dataDir)

export const keyboards = toKeyboardItems(data.keyboards, data.brands, data.switches)
export const monitors = toMonitorItems(data.monitors, data.brands)
