import { test, expect } from 'bun:test'
import { ZTorrent } from '../../dist/index.js'

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
