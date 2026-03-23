// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import path from 'path'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../dist/index.js'
import { SEED_HEAVY_TIMEOUT_MS } from './common.js'

test(
  'preloaded bitfield: load files into filesystem',
  { timeout: SEED_HEAVY_TIMEOUT_MS },
  async () => {
    const client = new ZTorrent({
      dht: false,
      utp: false,
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
        () => {
          expect(true).toBeTruthy()
          client.destroy((err) => {
            if (err) reject(err)
            else resolve()
          })
        }
      )
    })
  }
)

test('preloaded bitfield: full bitfield, files exist', async () => {
  const client = new ZTorrent({
    dht: false,
    utp: false,
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

  const torrent = client.add(fixtures.leaves.torrent, {
    bitfield: new Uint8Array([255, 255, 254]),
    path: path.dirname(fixtures.leaves.contentPath!),
  })
  const verifiedPieces: number[] = []
  torrent.on('verified', (i) => {
    verifiedPieces.push(i)
  })

  await new Promise<void>((resolve, reject) => {
    torrent.on('ready', () => {
      expect(verifiedPieces).toContain(1)
      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test(
  'preloaded bitfield: partial bitfield, files exist',
  { timeout: SEED_HEAVY_TIMEOUT_MS },
  async () => {
    const client = new ZTorrent({
      dht: false,
      utp: false,
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

    const torrent = client.add(fixtures.leaves.torrent, {
      bitfield: new Uint8Array([0, 0, 255]),
      path: path.dirname(fixtures.leaves.contentPath!),
    })
    const verifiedPieces: number[] = []
    torrent.on('verified', (i) => {
      verifiedPieces.push(i)
    })

    await new Promise<void>((resolve, reject) => {
      torrent.on('ready', () => {
        expect(verifiedPieces).toContain(17)
        expect(torrent.done).toBeFalsy()
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  }
)

test('preloaded bitfield: wrong size bitfield, files exist', async () => {
  const client = new ZTorrent({
    dht: false,
    utp: false,
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

  const torrent = client.add(fixtures.leaves.torrent, { bitfield: new Uint8Array([255, 255]) })
  let verifiedPieces = 0
  torrent.on('verified', () => ++verifiedPieces)

  await new Promise<void>((resolve, reject) => {
    torrent.on('ready', () => {
      expect(verifiedPieces).toBe(torrent.pieces.length)
      torrent.destroy({ destroyStore: true }, () => {
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

test("preloaded bitfield: full bitfield, files don't exist", async () => {
  const client = new ZTorrent({
    dht: false,
    utp: false,
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

  const torrent = client.add(fixtures.leaves.torrent, { bitfield: new Uint8Array([255, 255, 254]) })
  let verifiedPieces = 0
  torrent.on('verified', () => ++verifiedPieces)

  await new Promise<void>((resolve, reject) => {
    torrent.on('ready', () => {
      expect(verifiedPieces).toBe(0)
      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test("preloaded bitfield: wrong size bitfield, files don't exist", async () => {
  const client = new ZTorrent({
    dht: false,
    utp: false,
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

  const torrent = client.add(fixtures.leaves.torrent, { bitfield: new Uint8Array([255, 255]) })
  let verifiedPieces = 0
  torrent.on('verified', () => ++verifiedPieces)

  await new Promise<void>((resolve, reject) => {
    torrent.on('ready', () => {
      expect(verifiedPieces).toBe(0)
      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})
