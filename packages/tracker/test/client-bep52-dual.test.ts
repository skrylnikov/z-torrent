import { test, expect } from 'bun:test'
import { Client } from '../src/index.js'
import common from './common.js'
import { fixtures } from '@z-torrent/fixtures'

import { testWrtc } from './helpers.js'

const peerId = Buffer.from('01234567890123456789')
const port = 6881

test('http: Client with infoHashV2 emits two updates (dual swarm)', () => {
  return new Promise<void>((resolve, reject) => {
    common.createServer('http', (server, announceUrl) => {
      const v2trunc = 'a'.repeat(40)
      let updates = 0
      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        infoHashV2: v2trunc,
        announce: announceUrl,
        peerId,
        port,
        wrtc: testWrtc,
      })

      expect(client.infoHashV2).toBe(v2trunc)

      client.on('error', reject)
      client.on('warning', reject)
      client.on('update', () => {
        updates += 1
        if (updates === 2) {
          client.stop()
          client.once('update', () => {
            server.close()
            client.destroy()
            resolve()
          })
        }
      })

      client.start()
    })
  })
})

test('Client rejects invalid infoHashV2 length', () => {
  expect(() => {
    new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      infoHashV2: 'abcd',
      announce: ['http://127.0.0.1:1/announce'],
      peerId,
      port,
      wrtc: testWrtc,
    })
  }).toThrow()
})
