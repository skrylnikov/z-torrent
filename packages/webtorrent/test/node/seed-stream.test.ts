import { Readable } from 'stream'
import series from 'run-series'
import { test, expect } from 'bun:test'
import { Server as Tracker } from 'bittorrent-tracker'
import WebTorrent from '../../dist/index.js'

test('client.seed: stream', async () => {
  const tracker = new Tracker({ udp: false, ws: false })

  tracker.on('error', (err) => {
    throw err
  })
  tracker.on('warning', (err) => {
    throw err
  })

  let seeder: any
  let client: any
  let magnetURI: string

  await new Promise<void>((resolve, reject) => {
    series(
      [
        (cb) => {
          tracker.listen(cb)
        },

        (cb) => {
          const port = (tracker as any).http.address().port
          const announceUrl = `http://localhost:${port}/announce`

          seeder = new WebTorrent({ dht: false, lsd: false })

          seeder.on('error', (err) => {
            throw err
          })
          seeder.on('warning', (err) => {
            throw err
          })

          const stream = new Readable()
          stream._read = () => {}
          stream.push('HELLO WORLD\n')
          stream.push(null)

          const seederOpts = {
            name: 'hello.txt',
            pieceLength: 5,
            announce: [announceUrl],
          }
          seeder.seed([stream], seederOpts, (torrent: any) => {
            magnetURI = torrent.magnetURI
            cb(null)
          })
        },

        (cb) => {
          client = new WebTorrent({ dht: false, lsd: false })

          client.on('error', (err) => {
            throw err
          })
          client.on('warning', (err) => {
            throw err
          })

          client.add(magnetURI!, async (dl: any) => {
            expect(dl.files.length).toBe(1)
            expect(dl.files[0].name).toBe('hello.txt')
            expect(dl.files[0].length).toBe(12)
            try {
              const buf = await dl.files[0].arrayBuffer()
              expect(Buffer.from(buf).toString('utf8')).toBe('HELLO WORLD\n')
            } catch (err) {
              if (err) throw err
            }

            cb(null)
          })
        },
      ],
      (err) => {
        if (err) {
          reject(err)
          return
        }
        seeder.destroy((err) => {
          if (err) reject(err)
        })
        client.destroy((err) => {
          if (err) reject(err)
        })
        tracker.close(() => {
          resolve()
        })
      }
    )
  })
})
