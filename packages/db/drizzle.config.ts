import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile('../../.env')
} catch {}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
