// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../dist/index.js'

test('client.remove: remove by Torrent object', async () => {
  const client = new ZTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  const torrent = client.add(fixtures.leaves.parsedTorrent.infoHash)
  expect(client.torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', async () => {
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)

      await new Promise<void>((res, rej) =>
        client.remove(torrent, (err) => {
          if (err) rej(err)
          else res()
        })
      )
      expect(client.torrents.length).toBe(0)

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})
