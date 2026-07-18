/**
 * e2e/global-teardown.ts — Playwright global teardown. Delegates to
 * e2e/teardown.ts. Never throws: a teardown hiccup must not fail the run.
 */
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const teardownScript = resolve(__dirname, 'teardown.ts')

export default function globalTeardown(): void {
  const result = spawnSync('bun', [teardownScript], {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0 && result.error) {
    console.error(`[global-teardown] launch error: ${result.error.message}`)
  }
}
