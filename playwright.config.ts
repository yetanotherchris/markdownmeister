import { defineConfig } from '@playwright/test'

// The Electron app is launched with Chromium's --headless switch (see
// tests/e2e/launch.ts), so the suite never steals desktop focus; set
// MM_E2E_HEADED=1 to run with a visible window when debugging.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  // Tests stay serial within a file; spec files run concurrently across
  // workers. Each test isolates its app through MM_CONFIG_DIR and
  // MM_SINGLE_INSTANCE=0, so files are independent. Raise via PLAYWRIGHT_WORKERS
  // on a bigger machine; two keeps a standard two-core CI runner busy without
  // over-subscribing the Electron processes under xvfb.
  fullyParallel: false,
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? 2),
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure'
  }
})
