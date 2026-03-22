import { createRequire } from 'node:module'

import webrtcPolyfill from 'webrtc-polyfill'

const require = createRequire(import.meta.url)

/**
 * WebRTC for Node.js WebSocket tracker tests.
 * Prefer native `wrtc` when the binary is available; otherwise `webrtc-polyfill` (ESM).
 */
function loadTestWrtc(): unknown {
  try {
    return require('wrtc')
  } catch {
    return webrtcPolyfill
  }
}

export const testWrtc = loadTestWrtc()
