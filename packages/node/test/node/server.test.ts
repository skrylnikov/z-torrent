import fs from 'fs'
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../../dist/index.js'

test('client.createServer: programmatic http server', async () => {
  const client = new ZTorrent({ tracker: false, dht: false, lsd: false })

  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    client.add(fixtures.leaves.torrent, (torrent) => {
      const server = client.createServer()

      server.listen(0, async () => {
        const port = (server.address() as { port: number }).port

        let open = 2
        const close = () => {
          if (--open === 0) {
            server.close(() => {})
            client.destroy((err) => {
              if (err) reject(err)
              else resolve()
            })
          }
        }

        const loadPromise = new Promise<void>((res, rej) => {
          torrent.load(fs.createReadStream(fixtures.leaves.contentPath), (err) => {
            if (err) rej(err)
            else res()
          })
        })

        const host = `http://localhost:${port}`
        const path = `z-torrent/${torrent.infoHash}`

        const fetchAndVerify = async () => {
          const res1 = await fetch(`${host}/${path}/`)
          const text = await res1.text()
          expect(text.includes('Leaves of Grass by Walt Whitman.epub')).toBeTruthy()

          const res2 = await fetch(`${host}/${path}/${torrent.files[0].path}`)
          const data2 = Buffer.from(await res2.arrayBuffer())
          expect(data2).toEqual(fixtures.leaves.content)

          const res3 = await fetch(host + torrent.files[0].streamURL)
          const data3 = Buffer.from(await res3.arrayBuffer())
          expect(data3).toEqual(fixtures.leaves.content)
        }

        try {
          await Promise.all([loadPromise, fetchAndVerify()])
          close()
          close()
        } catch (err) {
          reject(err as Error)
        }
      })
    })
  })
})
