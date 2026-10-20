import netlify from '@netlify/vite-plugin-tanstack-start'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // One .env at the repo root, shared with the db package (DATABASE_URL).
  Object.assign(process.env, loadEnv(mode, '../..', ''))
  return {
    server: { port: 3000 },
    resolve: { tsconfigPaths: true },
    // GSAP ships its plugins as ES modules inside a package Node reads as CommonJS: on Netlify's
    // functions runtime, `import { Flip } from 'gsap/Flip'` lands on the CommonJS build and fails
    // ("Named export 'Flip' not found"). Bundled into the server build, GSAP never goes through
    // Node's module resolution at all.
    ssr: { noExternal: ['gsap', '@gsap/react'] },
    // Netlify: the pages, server functions and API routes run as one Netlify Function. In dev the
    // plugin emulates the platform; the site has no Edge Functions, so their emulator (a Deno
    // server, which fails to start with some Deno versions) stays off.
    plugins: [
      tanstackStart({ srcDirectory: 'src' }),
      viteReact(),
      netlify({ dev: { edgeFunctions: { enabled: false } } }),
    ],
  }
})
