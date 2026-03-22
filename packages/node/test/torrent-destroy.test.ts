// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { WebTorrent } from '../dist/index.js'
import type { default as Torrent } from '../src/lib/torrent.js'

test('torrent.destroy: destroy and remove torrent', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('error', (err: Error) => {
    throw err.message
  })
  client.on('warning', (err: Error) => {
    throw err.message
  })

  const torrent: Torrent = client.add(fixtures.leaves.parsedTorrent.infoHash)
  expect((client as any).torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', () => {
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)

      torrent.destroy((err?: Error) => {
        if (err) reject(err)
        expect((client as any).torrents.length).toBe(0)

        client.destroy((err?: Error) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})
