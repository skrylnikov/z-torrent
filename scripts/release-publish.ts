/**
 * Inline workspace: deps for npm tarballs, run changeset publish, always restore package.json files.
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

import {
  inlineWorkspaceProtocols,
  restoreWorkspaceProtocols,
} from './workspace-protocol-for-publish.js'

const ROOT = join(import.meta.dir, '..')

inlineWorkspaceProtocols()
let code = 1
try {
  const r = spawnSync('bun', ['x', 'changeset', 'publish'], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  })
  code = r.status === null ? 1 : r.status
} finally {
  restoreWorkspaceProtocols()
}
process.exit(code)
