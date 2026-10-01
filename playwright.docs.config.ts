import { defineConfig } from '@playwright/test'

// The built site is served from docs/site/dist by `vite preview`. Run with
// `npm run docs:test:e2e`, which builds first.
export default defineConfig({
  testDir: './tests/docs',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run docs:preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true
  }
})
