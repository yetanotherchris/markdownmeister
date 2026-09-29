import { defineConfig } from '@playwright/test'

// The Electron app is launched with Chromium's --headless switch (see
// tests/e2e/launch.ts), so the suite never steals desktop focus; set
// MM_E2E_HEADED=1 to run with a visible window when debugging.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  // One Electron app at a time by default: two concurrent apps starve each
  // other on a shared CI runner and make the large-file open in
  // open-performance.spec.ts time out. The suite is parallelised by sharding
  // across runners in quality.yml instead. Raise via PLAYWRIGHT_WORKERS on a
  // machine with headroom.
  fullyParallel: false,
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? 1),
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure'
  }
})
