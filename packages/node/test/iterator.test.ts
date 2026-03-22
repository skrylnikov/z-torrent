// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { ZTorrent, FileIterator } from '../dist/index.js'
import { expectSameMagnet, SEED_HEAVY_TIMEOUT_MS } from './common.js'

test('file iterator: use chunk store iterator if done', async () => {
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

  await new Promise<void>((resolve, reject) => {
    client.seed(
      fixtures.leaves.content,
      {
        name: 'Leaves of Grass by Walt Whitman.epub',
        announce: [],
      },
      async (torrent) => {
        expect(client.torrents.length).toBe(1)
        expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)
        expectSameMagnet(torrent.magnetURI, fixtures.leaves.magnetURI)

        const iterator = torrent.files[0][Symbol.asyncIterator]()
        expect(torrent.files[0].done).toBeTruthy()
        expect(!(iterator instanceof FileIterator)).toBeTruthy()
        iterator.return()

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
      }
    )
  })
}, { timeout: SEED_HEAVY_TIMEOUT_MS })

test('file iterator: use file iterator if not done', async () => {
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

  const torrent = client.add(fixtures.leaves.torrent)
  expect(client.torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('ready', async () => {
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)
      expectSameMagnet(torrent.magnetURI, fixtures.leaves.magnetURI)

      expect(!torrent.files[0].done).toBeTruthy()
      const iterator = torrent.files[0][Symbol.asyncIterator]()
      expect(iterator instanceof FileIterator).toBeTruthy()
      iterator.return()

      await new Promise<void>((res, rej) =>
        client.remove(fixtures.leaves.torrent, (err) => {
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
