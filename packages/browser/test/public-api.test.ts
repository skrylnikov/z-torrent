import { test, expect } from 'bun:test'
import { WebTorrent, FileIterator } from '../dist/z-torrent.min.js'

test('FileIterator is exported', () => {
  expect(FileIterator).toBeDefined()
  expect(typeof FileIterator).toBe('function')
})

test('WebTorrent static fields and destroy', async () => {
  const client = new WebTorrent({
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

  expect(WebTorrent.UTP_SUPPORT).toBe(false)
  expect(typeof WebTorrent.VERSION).toBe('string')
  expect(WebTorrent.VERSION.length).toBeGreaterThan(0)
  expect(typeof WebTorrent.WEBRTC_SUPPORT).toBe('boolean')

  await new Promise<void>((resolve, reject) =>
    client.destroy((err?: Error) => {
      if (err) reject(err)
      else resolve()
    })
  )
})
