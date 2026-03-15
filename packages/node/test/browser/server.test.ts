import { test, expect } from 'bun:test'
import WebTorrent from '../../dist/index.js'
import fixtures from 'webtorrent-fixtures'

// The image append/render tests don't work in electron, so skip them
// logic taken from https://github.com/atom/electron/issues/2288#issuecomment-123147993
// Service Worker API is not available in Node/Bun

if (!(global as any)?.process?.versions?.electron && typeof navigator?.serviceWorker !== 'undefined') {
  const img = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  )
  ;(img as Buffer & { name: string }).name = 'img.png'

  test('SW Registration and errors', async () => {
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

    await new Promise<void>((resolve, reject) => {
      client.seed(img, (torrent: any) => {
        expect(() => torrent.files[0].streamURL).toThrow()

        function checkState(worker: ServiceWorker | null, controller: ServiceWorkerRegistration) {
          if (worker && worker.state !== 'activated' && worker.state !== 'activating') {
            expect(() => client.createServer({ controller })).toThrow()
          } else {
            client.createServer({ controller })
            expect(() => client.createServer({ controller })).toThrow()
            expect(torrent.files[0].streamURL).toBeTruthy()
            client.destroy((err) => {
              if (err) reject(err)
              controller
                .unregister()
                .then(() => resolve())
                .catch((err) => {
                  if (err) reject(err)
                })
            })
            return true
          }
        }
        try {
          navigator.serviceWorker.register('./sw.min.js', { scope: './' }).then(() => {
            navigator.serviceWorker.ready.then((controller) => {
              checkState(controller.active, controller)
            })
          })
        } catch (e) {
          if (e) throw e
        }
      })
    })
  })

  test('SW renderer image', async () => {
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
    try {
      await navigator.serviceWorker.register('./sw.min.js', { scope: './' })
      const controller = await navigator.serviceWorker.ready
      client.createServer({ controller })
      await new Promise<void>((resolve, reject) => {
        client.seed(img, async (torrent: any) => {
          const src = torrent.files[0].streamURL
          expect(typeof src === 'string').toBeTruthy()
          expect(
            src.endsWith('/z-torrent/db19b51fe04aaf14fd4c9be77f5eeeb2d8789b5c/img.png')
          ).toBeTruthy()

          const res = await fetch(torrent.files[0].streamURL)
          const data = new Uint8Array(await res.arrayBuffer())
          const original = new Uint8Array(img)
          expect(data).toEqual(original)
          client.destroy((err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      })
    } catch (e) {
      if (e) throw e
    }
  })

  test('client.createServer: programmatic http server [node-like usage]', async () => {
    const client = new WebTorrent({ tracker: false, dht: false, lsd: false })

    client.on('error', (err) => {
      throw err
    })
    client.on('warning', (err) => {
      throw err
    })

    await new Promise<void>((resolve, reject) => {
      client.seed(fixtures.leaves.content, async (torrent: any) => {
        const controller = await navigator.serviceWorker.getRegistration()
        if (!controller) {
          reject(new Error('No service worker registration'))
          return
        }
        const server = client.createServer({ controller })

        server.listen(0, async () => {
          const port = (server.address() as { port: number }).port

          const host = `http://localhost:${port}`
          const path = `z-torrent/${torrent.infoHash}`

          try {
            const res1 = await fetch(`${host}/${path}/`)
            const text = await res1.text()
            expect(text.includes('Leaves of Grass by Walt Whitman.epub')).toBeTruthy()

            const res2 = await fetch(`${host}/${path}/${torrent.files[0].path}`)
            const data2 = Buffer.from(await res2.arrayBuffer())
            expect(data2).toEqual(fixtures.leaves.content)

            const res3 = await fetch(torrent.files[0].streamURL)
            const data3 = Buffer.from(await res3.arrayBuffer())
            expect(data3).toEqual(fixtures.leaves.content)

            server.close(() => {})
            client.destroy((err) => {
              if (err) reject(err)
              else resolve()
            })
          } catch (err) {
            reject(err as Error)
          }
        })
      })
    })
  })
}
