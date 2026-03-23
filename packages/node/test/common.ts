import assert from 'assert'
import os from 'os'
import fs from 'fs'
import path from 'path'

/**
 * `bun test` (default): только быстрые тесты без хрупкой UDP/DHT/трекер-сокетной математики.
 * `Z_TORRENT_LIVE=1 bun run test-live` — полный набор localhost-интеграции.
 */
export const LIVE_NETWORK = process.env.Z_TORRENT_LIVE === '1'

/** Обычный `bun test`: seed/hash крупных фикстур, duplicate, bitfield и т.д. */
export const SEED_HEAVY_TIMEOUT_MS = 5_000

/** `Z_TORRENT_LIVE=1`: трекер, DHT-файл, blocklist, addPeer, seed-stream, file.select+idle. */
export const LIVE_TEST_TIMEOUT_MS = 15_000

/** Два клиента на localhost (deselect, select и т.п.). */
export const PEER_LOCAL_TIMEOUT_MS = 15_000

/** Remove optional BEP 46 / v2 `xt=urn:btmh:…` segment for stable magnet comparisons. */
export function stripMagnetV2Xt(uri: string): string {
  return uri.replace(/&xt=urn%3Abtmh%3A[^&]*/gi, '').replace(/&xt=urn:btmh:[^&]*/gi, '')
}

export function expectSameMagnet(actual: string, expected: string): void {
  assert.strictEqual(stripMagnetV2Xt(actual), stripMagnetV2Xt(expected))
}

export function getDownloadPath(infix: string, infoHash: string): string {
  let tmpPath: string
  try {
    tmpPath = path.join(fs.statSync('/tmp') && '/tmp')
  } catch {
    tmpPath = path.join(typeof os.tmpdir === 'function' ? os.tmpdir() : '/')
  }
  return path.join(tmpPath, 'z-torrent', 'test', infix, infoHash)
}
