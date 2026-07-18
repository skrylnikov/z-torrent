/**
 * e2e/teardown.ts — tears down the stack started by e2e/setup.ts. Runs under
 * bun (spawned by e2e/global-teardown.ts). Safe to run multiple times and when
 * no state exists.
 */

import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, rmSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATE_FILE = resolve(__dirname, '.state.json')

interface E2EState {
  infoHash: string
  seedApiUrl: string
  apiKey: string
  pids: { tracker: number; seed: number; portal: number }
  tmpDir: string
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[teardown ${ts}] ${msg}`)
}

function killGroup(pid: number): void {
  // Try the process group first (detached children are group leaders), then
  // the PID itself; escalate TERM -> KILL.
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, 'SIGTERM')
    } catch {
      /* may already be gone */
    }
  }
}

async function deleteDeployment(state: E2EState): Promise<void> {
  try {
    await fetch(`${state.seedApiUrl}/api/deployments/${state.infoHash}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.apiKey}` },
      signal: AbortSignal.timeout(3000),
    })
    log(`deleted deployment ${state.infoHash}`)
  } catch {
    log(`could not delete deployment ${state.infoHash} (best-effort, ignored)`)
  }
}

async function main(): Promise<void> {
  if (!existsSync(STATE_FILE)) {
    log('no state file — nothing to tear down')
    return
  }

  let state: E2EState
  try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2EState
  } catch (err) {
    log(`state file unreadable: ${(err as Error).message}`)
    rmSync(STATE_FILE, { force: true })
    return
  }

  await deleteDeployment(state)

  log('stopping portal -> seed -> tracker...')
  killGroup(state.pids.portal)
  await new Promise((r) => setTimeout(r, 300))
  killGroup(state.pids.seed)
  await new Promise((r) => setTimeout(r, 300))
  killGroup(state.pids.tracker)

  // Give them a moment, then force-kill anything still alive.
  await new Promise((r) => setTimeout(r, 1500))
  for (const pid of [state.pids.portal, state.pids.seed, state.pids.tracker]) {
    for (const target of [-pid, pid]) {
      try {
        process.kill(target, 'SIGKILL')
      } catch {
        /* gone */
      }
    }
  }

  try {
    rmSync(state.tmpDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
  rmSync(STATE_FILE, { force: true })
  log('done')
}

main().catch((err: Error) => {
  log(`teardown error (ignored): ${err.message}`)
  // Never fail the test run from teardown.
})
