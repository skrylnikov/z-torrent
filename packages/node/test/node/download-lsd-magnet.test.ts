import fixtures from 'webtorrent-fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import { test, expect } from 'bun:test'
import WebTorrent from '../../dist/index.js'

test('Download using LSD (via magnet uri)', async () => {
  const client1 = new WebTorrent({ dht: false, tracker: false, lsd: true })
  const client2 = new WebTorrent({ dht: false, tracker: false, lsd: true })

  client1.on('error', (err) => {
    throw err
  })
  client1.on('warning', (err) => {
    throw err
  })

  client2.on('error', (err) => {
    throw err
  })
  client2.on('warning', (err) => {
    throw err
  })

  const torrent = client1.add(fixtures.leaves.magnetURI, { store: MemoryChunkStore })

  client2.seed(fixtures.leaves.content, {
    name: 'Leaves of Grass by Walt Whitman.epub',
    announce: [],
  })

  await new Promise<void>((resolve, reject) => {
    torrent.on('done', () => {
      client1.destroy((err) => {
        if (err) reject(err)
      })
      client2.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})
