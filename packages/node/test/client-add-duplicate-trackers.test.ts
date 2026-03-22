// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { WebTorrent } from '../dist/index.js'
import { expectSameMagnet } from './common.js'

test('client.add: duplicate trackers', async () => {
  const client = new WebTorrent({
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

  const torrent = client.add(fixtures.leaves.torrent, {
    announce: ['wss://example.com', 'wss://example.com', 'wss://example.com'],
  })

  await new Promise<void>((resolve, reject) => {
    torrent.on('ready', async () => {
      expectSameMagnet(
        torrent.magnetURI,
        `${fixtures.leaves.magnetURI}&tr=${encodeURIComponent('wss://example.com')}`
      )
      await new Promise<void>((res, rej) =>
        client.remove(fixtures.leaves.magnetURI, (err) => {
          if (err) rej(err)
          else res()
        })
      )
      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test('client.add: duplicate trackers, with multiple torrents', async () => {
  const opts = {
    announce: ['wss://example.com', 'wss://example.com', 'wss://example.com'],
  }

  const client = new WebTorrent({
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

  const torrent1 = client.add(fixtures.leaves.torrent, opts)

  await new Promise<void>((resolve, reject) => {
    torrent1.on('ready', () => {
      expectSameMagnet(
        torrent1.magnetURI,
        `${fixtures.leaves.magnetURI}&tr=${encodeURIComponent('wss://example.com')}`
      )

      const torrent2 = client.add(fixtures.alice.torrent, opts)

      torrent2.on('ready', async () => {
        expectSameMagnet(
          torrent2.magnetURI,
          `${fixtures.alice.magnetURI}&tr=${encodeURIComponent('wss://example.com')}`
        )

        await new Promise<void>((res, rej) =>
          torrent1.destroy((err) => {
            if (err) rej(err)
            else res()
          })
        )
        await new Promise<void>((res, rej) =>
          torrent2.destroy((err) => {
            if (err) rej(err)
            else res()
          })
        )
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

test('client.add: duplicate trackers (including in .torrent file), multiple torrents', async () => {
  const opts = {
    announce: ['wss://example.com', 'wss://example.com', 'wss://example.com'],
  }

  const parsedTorrentLeaves = Object.assign({}, fixtures.leaves.parsedTorrent)
  parsedTorrentLeaves.announce = ['wss://example.com', 'wss://example.com', 'wss://example.com']

  const parsedTorrentAlice = Object.assign({}, fixtures.alice.parsedTorrent)
  parsedTorrentAlice.announce = ['wss://example.com', 'wss://example.com', 'wss://example.com']

  const client = new WebTorrent({
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

  const torrent1 = client.add(parsedTorrentLeaves, opts)

  await new Promise<void>((resolve, reject) => {
    torrent1.on('ready', () => {
      expectSameMagnet(
        torrent1.magnetURI,
        `${fixtures.leaves.magnetURI}&tr=${encodeURIComponent('wss://example.com')}`
      )

      const torrent2 = client.add(parsedTorrentAlice, opts)

      torrent2.on('ready', async () => {
        expectSameMagnet(
          torrent2.magnetURI,
          `${fixtures.alice.magnetURI}&tr=${encodeURIComponent('wss://example.com')}`
        )

        await new Promise<void>((res, rej) =>
          torrent1.destroy((err) => {
            if (err) rej(err)
            else res()
          })
        )
        await new Promise<void>((res, rej) =>
          torrent2.destroy((err) => {
            if (err) rej(err)
            else res()
          })
        )
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})
