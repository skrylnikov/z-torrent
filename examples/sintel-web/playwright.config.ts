import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for sintel-web live E2E.
 *
 * The stack (tracker + seed-server + web-portal) is brought up by
 * `e2e/global-setup.ts` (which shells out to `e2e/setup.ts` under bun) and
 * torn down by `e2e/global-teardown.ts`. Tests run single-workered against the
 * shared local stack. The portal URL + infoHash are read from e2e/.state.json.
 */
export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  // Single shared local stack — never parallelize.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,

  // Site delivery over a local P2P swarm can take a few seconds on the first
  // service-worker registration; give individual tests headroom.
  timeout: 90_000,
  expect: { timeout: 30_000 },

  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: process.env.ZT_PORTAL_URL ?? 'http://localhost:5173',
    headless: true,
    actionTimeout: 30_000,
    trace: 'on-first-retry',
    // Allow service workers + WebRTC (needed by the portal's torrent client).
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
