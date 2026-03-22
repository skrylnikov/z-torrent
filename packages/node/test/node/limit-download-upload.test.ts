import { fixtures } from '@z-torrent/fixtures'
import MemoryChunkStore from 'memory-chunk-store'
import { test, expect } from 'bun:test'
import { WebTorrent } from '../../dist/index.js'

const DOWNLOAD_SPEED_LIMIT = 200 * 1000
const UPLOAD_SPEED_LIMIT = 200 * 1000

function testSpeed(
  downloaderOpts: Record<string, any>,
  uploaderOpts: Record<string, any>,
  cb: (downloadSpeeds: number[], uploadSpeeds: number[]) => void
) {
  return new Promise<void>((resolve, reject) => {
    const client1 = new WebTorrent({ dht: false, tracker: false, ...downloaderOpts })
    const client2 = new WebTorrent({ dht: false, tracker: false, ...uploaderOpts })

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

    const downloadSpeeds: number[] = []
    const uploadSpeeds: number[] = []

    client2.seed(
      fixtures.leaves.content,
      {
        name: 'Leaves of Grass by Walt Whitman.epub',
        announce: [],
      },
      (torrent: any) => {
        torrent.on('upload', () => {
          uploadSpeeds.push(torrent.uploadSpeed)
        })
      }
    )

    client2.on('listening', () => {
      const torrent = client1.add(fixtures.leaves.parsedTorrent.infoHash, {
        store: MemoryChunkStore,
      })

      torrent.once('infoHash', () => {
        torrent.addPeer(`127.0.0.1:${client2.address().port}`)
      })

      torrent.on('download', () => {
        downloadSpeeds.push(torrent.downloadSpeed)
      })

      torrent.on('done', () => {
        cb(downloadSpeeds, uploadSpeeds)

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
}

test('Limit download speed by constructor when tcp connection', async () => {
  await testSpeed({ downloadLimit: DOWNLOAD_SPEED_LIMIT }, {}, (downloadSpeeds) => {
    expect(downloadSpeeds.every((s) => s <= DOWNLOAD_SPEED_LIMIT)).toBeTruthy()
  })
})

test('Limit upload speed by constructor when tcp connection', async () => {
  await testSpeed({}, { uploadLimit: UPLOAD_SPEED_LIMIT }, (_, uploadSpeeds) => {
    expect(uploadSpeeds.every((s) => s <= UPLOAD_SPEED_LIMIT)).toBeTruthy()
  })
})

test('Limit download speed by constructor when utp connection', async () => {
  await testSpeed(
    { utp: true, downloadLimit: DOWNLOAD_SPEED_LIMIT },
    { utp: true },
    (downloadSpeeds) => {
      expect(downloadSpeeds.every((s) => s <= DOWNLOAD_SPEED_LIMIT)).toBeTruthy()
    }
  )
})

test('Limit upload speed by constructor when utp connection', async () => {
  await testSpeed(
    { utp: true },
    { utp: true, uploadLimit: UPLOAD_SPEED_LIMIT },
    (_, uploadSpeeds) => {
      expect(uploadSpeeds.every((s) => s <= UPLOAD_SPEED_LIMIT)).toBeTruthy()
    }
  )
})
