import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATE_FILE = resolve(__dirname, '.state.json')

export interface E2EState {
  /** Full portal URL to navigate to, e.g. http://localhost:5173/<infoHash> */
  portalUrl: string
  /** 40-hex infoHash of the published sintel-web site torrent */
  infoHash: string
}

/**
 * Reads the stack state produced by `e2e/setup.ts`.
 * Throws if globalSetup failed (no state file written).
 */
export function getE2EState(): E2EState {
  if (!existsSync(STATE_FILE)) {
    throw new Error(
      `E2E state not found at ${STATE_FILE}. The global setup likely failed — ` +
        `check e2e/.logs/ and the Playwright output above.`
    )
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2EState
}
