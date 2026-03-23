// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../dist/index.js'
import { SEED_HEAVY_TIMEOUT_MS } from './common.js'

test(
  'client.seed followed by duplicate client.add (sync)',
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
        (torrent1) => {
          expect(client.torrents.length).toBe(1)

          client.add(torrent1.infoHash, {}, (t) => {
            expect(t).toBe(torrent1)
            expect(client.torrents.length).toBe(1)
            client.destroy((err) => {
              if (err) reject(err)
              expect(client.torrents.length).toBe(0)
              resolve()
            })
          })
        }
      )
    })
  },
  { timeout: SEED_HEAVY_TIMEOUT_MS }
)

test(
  'client.seed followed by duplicate client.add (async)',
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
        (torrent1) => {
          expect(client.torrents.length).toBe(1)

          client.add(fixtures.leaves.torrentPath, {}, (t) => {
            expect(t).toBe(torrent1)
            expect(client.torrents.length).toBe(1)
            client.destroy((err) => {
              if (err) reject(err)
              expect(client.torrents.length).toBe(0)
              resolve()
            })
          })
        }
      )
    })
  },
  { timeout: SEED_HEAVY_TIMEOUT_MS }
)

test(
  'client.seed followed by two duplicate client.add calls (sync)',
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
        (torrent1) => {
          expect(client.torrents.length).toBe(1)

          client.add(torrent1.infoHash, {}, (t) => {
            expect(t).toBe(torrent1)
            expect(client.torrents.length).toBe(1)

            client.add(torrent1.infoHash, {}, (t2) => {
              expect(t2).toBe(torrent1)
              expect(client.torrents.length).toBe(1)
              client.destroy((err) => {
                if (err) reject(err)
                expect(client.torrents.length).toBe(0)
                resolve()
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
  'client.seed followed by two duplicate client.add calls (async)',
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
        (torrent1) => {
          expect(client.torrents.length).toBe(1)

          client.add(fixtures.leaves.torrentPath, {}, (t) => {
            expect(t).toBe(torrent1)
            expect(client.torrents.length).toBe(1)

            client.add(fixtures.leaves.torrentPath, {}, (t2) => {
              expect(t2).toBe(torrent1)
              expect(client.torrents.length).toBe(1)
              client.destroy((err) => {
                if (err) reject(err)
                expect(client.torrents.length).toBe(0)
                resolve()
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
  'successive sync client.add, client.remove, client.add, client.remove (sync)',
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
        (torrent1) => {
          expect(client.torrents.length).toBe(1)

          client.remove(torrent1.infoHash, () => {
            const t2 = client.add(torrent1.infoHash)
            client.remove(t2, () => {
              client.destroy((err) => {
                if (err) reject(err)
                expect(client.torrents.length).toBe(0)
                resolve()
              })
            })
          })
        }
      )
    })
  },
  { timeout: SEED_HEAVY_TIMEOUT_MS }
)
