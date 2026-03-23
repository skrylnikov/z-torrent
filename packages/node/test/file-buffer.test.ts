// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../dist/index.js'
import { expectSameMagnet, SEED_HEAVY_TIMEOUT_MS } from './common.js'

test(
  'file buffer: use chunk store iterator if done',
  async () => {
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

          const buffer = await torrent.files[0].arrayBuffer({ start: 0, end: 99 })
          expect(buffer.byteLength === 100).toBeTruthy()
          const orig = fixtures.leaves.content.buffer.slice(0, 100)
          expect(new Uint8Array(orig)).toEqual(new Uint8Array(buffer))

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
  },
  { timeout: SEED_HEAVY_TIMEOUT_MS }
)
