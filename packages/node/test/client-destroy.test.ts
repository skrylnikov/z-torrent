// @ts-expect-error - no types available
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../dist/index.js'

test('after client.destroy(), throw on client.add() or client.seed()', async () => {
  const client = new ZTorrent({
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

  await new Promise<void>((resolve, reject) =>
    client.destroy((err) => {
      if (err) reject(err)
      else resolve()
    })
  )

  expect(() => {
    client.add(`magnet:?xt=urn:btih:${fixtures.leaves.parsedTorrent.infoHash}`)
  }).toThrow()
  expect(() => {
    client.seed(Buffer.from('sup'))
  }).toThrow()
})

test('after client.destroy(), no "torrent" or "ready" events emitted', async () => {
  const client = new ZTorrent({
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

  client.add(fixtures.leaves.torrent, { name: 'leaves' }, () => {
    throw new Error('unexpected "torrent" event (from add)')
  })
  client.seed(fixtures.leaves.content, { name: 'leaves' }, () => {
    throw new Error('unexpected "torrent" event (from seed)')
  })
  client.on('ready', () => {
    throw new Error('unexpected "ready" event')
  })

  await new Promise<void>((resolve, reject) =>
    client.destroy((err) => {
      if (err) reject(err)
      else resolve()
    })
  )
})
