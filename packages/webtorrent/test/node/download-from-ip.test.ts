import fs from 'fs'
import fixtures from 'webtorrent-fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import { test, expect } from 'bun:test'
import WebTorrent from '../../dist/index.js'

test('Download via torrent.addPeer()', { timeout: 5000 }, async () => {
  const seeder = new WebTorrent({ tracker: false, dht: false, lsd: false })

  seeder.on('error', (err) => {
    throw err
  })
  seeder.on('warning', (err) => {
    throw err
  })

  const torrent = seeder.add(fixtures.leaves.parsedTorrent, { store: MemoryChunkStore })

  torrent.on('ready', () => {
    expect(torrent.name).toBe('Leaves of Grass by Walt Whitman.epub')
    expect(torrent.files.map((f: any) => f.name)).toEqual([
      'Leaves of Grass by Walt Whitman.epub',
    ])
  })

  await new Promise<void>((resolve, reject) => {
    torrent.load(fs.createReadStream(fixtures.leaves.contentPath), (err) => {
      if (err) throw err

      const downloader = new WebTorrent({ tracker: false, dht: false, lsd: false })

      downloader.on('error', (err) => {
        throw err
      })
      downloader.on('warning', (err) => {
        throw err
      })

      downloader.add(
        fixtures.leaves.parsedTorrent,
        { store: MemoryChunkStore },
        (torrent: any) => {
          torrent.addPeer(`localhost:${seeder.torrentPort}`)

          torrent.once('done', async () => {
            for (const file of torrent.files) {
              try {
                const ab = await file.arrayBuffer()
                expect(new Uint8Array(ab)).toEqual(new Uint8Array(fixtures.leaves.content))
              } catch (err) {
                if (err) throw err
              }
              seeder.destroy((err) => {
                if (err) throw err
              })
              downloader.destroy((err) => {
                if (err) throw err
                resolve()
              })
            }
          })
        }
      )
    })
  })
})

test('Download via magnet x.pe (BEP09)', { timeout: 15000 }, async () => {
  const seeder = new WebTorrent({
    tracker: false,
    dht: false,
    lsd: false,
    torrentPort: 63000,
  })

  seeder.on('error', (err) => {
    throw err
  })
  seeder.on('warning', (err) => {
    throw err
  })

  const torrent = seeder.add(fixtures.leaves.parsedTorrent, { store: MemoryChunkStore })

  torrent.on('ready', () => {
    expect(torrent.name).toBe('Leaves of Grass by Walt Whitman.epub')
    expect(torrent.files.map((f: any) => f.name)).toEqual([
      'Leaves of Grass by Walt Whitman.epub',
    ])
  })

  await new Promise<void>((resolve, reject) => {
    torrent.load(fs.createReadStream(fixtures.leaves.contentPath), (err) => {
      if (err) throw err

      const downloader = new WebTorrent({ tracker: false, dht: false, lsd: false })

      downloader.on('error', (err) => {
        throw err
      })
      downloader.on('warning', (err) => {
        throw err
      })

      const peerAddress = '127.0.0.1:63000'
      const magnetURI = fixtures.leaves.magnetURI + `&x.pe=${peerAddress}`

      downloader.add(magnetURI, { store: MemoryChunkStore }, (torrent: any) => {
        torrent.once('done', async () => {
          for (const file of torrent.files) {
            try {
              const ab = await file.arrayBuffer()
              expect(new Uint8Array(ab)).toEqual(new Uint8Array(fixtures.leaves.content))
            } catch (err) {
              if (err) throw err
            }

            seeder.destroy((err) => {
              if (err) throw err
            })
            downloader.destroy((err) => {
              if (err) throw err
              resolve()
            })
          }
        })
      })
    })
  })
})
