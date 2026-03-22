// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { WebTorrent } from '../dist/index.js'
import { expectSameMagnet, SEED_HEAVY_TIMEOUT_MS } from './common.js'
import type { Torrent } from '@z-torrent/core'

test('client.seed: torrent file (Buffer)', async () => {
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

  await new Promise<void>((resolve, reject) => {
    client.seed(
      fixtures.leaves.content,
      {
        name: 'Leaves of Grass by Walt Whitman.epub',
        announce: [],
      },
      async (torrent: Torrent) => {
        expect((client as any).torrents.length).toBe(1)
        expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)
        expectSameMagnet(torrent.magnetURI, fixtures.leaves.magnetURI)

        await new Promise<void>((res, rej) =>
          (client as any).remove(torrent, null, (err?: Error) => {
            if (err) rej(err)
            else res()
          })
        )
        expect((client as any).torrents.length).toBe(0)

        client.destroy((err?: Error) => {
          if (err) reject(err)
          else resolve()
        })
      }
    )
  })
}, { timeout: SEED_HEAVY_TIMEOUT_MS })

test('client.seed: torrent file (Buffer), set name on buffer', async () => {
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

  const buf = Buffer.from(fixtures.leaves.content) as Buffer & { name: string }
  buf.name = 'Leaves of Grass by Walt Whitman.epub'

  await new Promise<void>((resolve, reject) => {
    client.seed(buf, { announce: [] }, async (torrent: Torrent) => {
      expect((client as any).torrents.length).toBe(1)
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)
      expectSameMagnet(torrent.magnetURI, fixtures.leaves.magnetURI)

      await new Promise<void>((res, rej) =>
        (client as any).remove(torrent, null, (err?: Error) => {
          if (err) rej(err)
          else res()
        })
      )
      expect((client as any).torrents.length).toBe(0)

      client.destroy((err?: Error) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
}, { timeout: SEED_HEAVY_TIMEOUT_MS })

test('client.seed: torrent file (Blob)', async () => {
  if (typeof Blob === 'undefined') return

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

  await new Promise<void>((resolve, reject) => {
    client.seed(
      new Blob([fixtures.leaves.content]),
      {
        name: 'Leaves of Grass by Walt Whitman.epub',
        announce: [],
      },
      async (torrent: Torrent) => {
        expect((client as any).torrents.length).toBe(1)
        expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)
        expectSameMagnet(torrent.magnetURI, fixtures.leaves.magnetURI)

        await new Promise<void>((res, rej) =>
          (client as any).remove(torrent, null, (err?: Error) => {
            if (err) rej(err)
            else res()
          })
        )
        expect((client as any).torrents.length).toBe(0)

        client.destroy((err?: Error) => {
          if (err) reject(err)
          else resolve()
        })
      }
    )
  })
}, { timeout: SEED_HEAVY_TIMEOUT_MS })

test('client.seed: duplicate seed', async () => {
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

  await new Promise<void>((resolve, reject) => {
    client.seed(fixtures.leaves.content, function (torrent1: Torrent) {
      client.seed(fixtures.leaves.content, function (torrent2: Torrent) {
        expect(torrent1).toBe(torrent2)
        expect((client as any).torrents.length).toBe(1)

        client.destroy((err?: Error) => {
          if (err) reject(err)
          else {
            expect((client as any).torrents.length).toBe(0)
            resolve()
          }
        })
      })
    })
  })
}, { timeout: SEED_HEAVY_TIMEOUT_MS })
