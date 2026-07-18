/**
 * e2e/global-setup.ts — Playwright global setup. Delegates all the bun-dependent
 * orchestration (spawning services, publishing) to e2e/setup.ts. Kept
 * node-pure so it runs reliably under the Playwright launcher runtime.
 */
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const setupScript = resolve(__dirname, 'setup.ts')

export default function globalSetup(): void {
  const result = spawnSync('bun', [setupScript], {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) {
    throw new Error(`Failed to launch e2e setup: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(
      `E2E setup failed (exit ${result.status}). ` +
        `Inspect e2e/.logs/{tracker,seed,portal}.log for details.`
    )
  }
}
