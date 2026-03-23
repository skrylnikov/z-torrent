import fs from 'fs'
import path from 'path'
import http from 'http'
// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import type { Torrent } from '@z-torrent/core'
import { ZTorrent } from '../../dist/index.js'
import { expectSameMagnet, SEED_HEAVY_TIMEOUT_MS } from '../common.js'

test('ZTorrent.WEBRTC_SUPPORT', async () => {
  const client = new ZTorrent({
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

  expect((ZTorrent as any).WEBRTC_SUPPORT).toBe(true)

  await new Promise<void>((resolve, reject) =>
    client.destroy((err?: Error) => {
      if (err) reject(err)
      else resolve()
    })
  )
})

test('client.add: http url to a torrent file, string', async () => {
  const server = http.createServer((req, res) => {
    expect(req.headers['user-agent']?.includes('Z-Torrent')).toBeTruthy()
    res.end(fixtures.leaves.torrent)
  })

  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => {
      const address = server.address() as { port: number }
      const port = address.port
      const url = `http://127.0.0.1:${port}`
      const client = new ZTorrent({
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

      client.add(url, async (torrent: Torrent) => {
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

        server.close(() => {})
        client.destroy((err?: Error) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

test('client.add: filesystem path to a torrent file, string', async () => {
  const client = new ZTorrent({
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
    client.add(fixtures.leaves.torrentPath, async (torrent: Torrent) => {
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
})

test(
  'client.seed: filesystem path to file, string',
  async () => {
    const client = new ZTorrent({
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
        fixtures.leaves.contentPath,
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
  },
  { timeout: SEED_HEAVY_TIMEOUT_MS }
)

test(
  'client.seed: filesystem path to folder with one file, string',
  async () => {
    const client = new ZTorrent({
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
      client.seed(fixtures.folder.contentPath, { announce: [] }, async (torrent: Torrent) => {
        expect((client as any).torrents.length).toBe(1)
        expect(torrent.infoHash).toBe(fixtures.folder.parsedTorrent.infoHash)
        expectSameMagnet(torrent.magnetURI, fixtures.folder.magnetURI)

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
  },
  { timeout: SEED_HEAVY_TIMEOUT_MS }
)

test(
  'client.seed: filesystem path to folder with multiple files, string',
  async () => {
    const client = new ZTorrent({
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
      client.seed(fixtures.numbers.contentPath, { announce: [] }, async (torrent: Torrent) => {
        expect((client as any).torrents.length).toBe(1)
        expect(torrent.infoHash).toBe(fixtures.numbers.parsedTorrent.infoHash)
        expectSameMagnet(torrent.magnetURI, fixtures.numbers.magnetURI)

        const downloaded = torrent.files.map((file) => ({
          length: file.length,
          downloaded: file.downloaded,
        }))

        expect(downloaded).toEqual([
          { length: 1, downloaded: 1 },
          { length: 2, downloaded: 2 },
          { length: 3, downloaded: 3 },
        ])

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
  },
  { timeout: SEED_HEAVY_TIMEOUT_MS }
)

test('client.add: invalid torrent id: invalid filesystem path', async () => {
  const client = new ZTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  await new Promise<void>((resolve, reject) => {
    client.on('error', (err: Error) => {
      expect(err instanceof Error).toBeTruthy()
      expect(err.message.includes('Invalid torrent identifier')).toBeTruthy()

      client.destroy((err?: Error) => {
        if (err) reject(err)
        else resolve()
      })
    })
    client.on('warning', (err: Error) => {
      throw err.message
    })

    client.add('/invalid/filesystem/path/123')
  })
})

test(
  'client.remove: opts.destroyStore',
  async () => {
    const client = new ZTorrent({
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
        fixtures.alice.content,
        { name: 'alice.txt', announce: [] },
        (torrent: Torrent) => {
          const torrentPath = torrent.path
          ;(client as any).remove(torrent, { destroyStore: true }, (err?: Error) => {
            if (err) throw err

            fs.stat(path.join(torrentPath as string, 'alice.txt'), (err) => {
              expect(err && (err as NodeJS.ErrnoException).code === 'ENOENT').toBeTruthy()

              client.destroy((err?: Error) => {
                if (err) reject(err)
                else resolve()
              })
            })
          })
        }
      )
    })
  },
  { timeout: SEED_HEAVY_TIMEOUT_MS }
)

test(
  'torrent.destroy: opts.destroyStore',
  async () => {
    const client = new ZTorrent({
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
        fixtures.alice.content,
        { name: 'alice.txt', announce: [] },
        (torrent: Torrent) => {
          const torrentPath = torrent.path
          ;(torrent as any).destroy({ destroyStore: true }, (err?: Error) => {
            if (err) throw err

            fs.stat(path.join(torrentPath as string, 'alice.txt'), (err) => {
              expect(err && (err as NodeJS.ErrnoException).code === 'ENOENT').toBeTruthy()

              client.destroy((err?: Error) => {
                if (err) reject(err)
                else resolve()
              })
            })
          })
        }
      )
    })
  },
  { timeout: SEED_HEAVY_TIMEOUT_MS }
)
