import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // One .env at the repo root, shared with the db package (DATABASE_URL).
  Object.assign(process.env, loadEnv(mode, '../..', ''))
  return {
    server: { port: 3000 },
    resolve: { tsconfigPaths: true },
    plugins: [tanstackStart({ srcDirectory: 'src' }), viteReact(), nitro()],
  }
})
