import { test, expect } from 'bun:test'
import { ZTorrent, FileIterator } from '../dist/index.js'

test('FileIterator is exported', () => {
  expect(FileIterator).toBeDefined()
  expect(typeof FileIterator).toBe('function')
})

test('ZTorrent static fields and destroy', async () => {
  const client = new ZTorrent({
    dht: false,
    tracker: false,
    lsd: false,
  })

  client.on('error', (err: Error) => {
    throw err
  })
  client.on('warning', (err: Error) => {
    throw err
  })

  expect(ZTorrent.UTP_SUPPORT).toBe(false)
  expect(typeof ZTorrent.VERSION).toBe('string')
  expect(ZTorrent.VERSION.length).toBeGreaterThan(0)
  expect(typeof ZTorrent.WEBRTC_SUPPORT).toBe('boolean')

  await new Promise<void>((resolve, reject) =>
    client.destroy((err?: Error) => {
      if (err) reject(err)
      else resolve()
    })
  )
})
