import { DHT } from '@z-torrent/dht'
import { expect, test } from 'bun:test'
import { randomBytes } from 'uint8-util'

import { Discovery } from '../src/index.js'

test('initialize with dht', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT()
    const discovery = new Discovery({
      infoHash: randomBytes(20),
      peerId: randomBytes(20),
      port: 6000,
      dht,
    })
    discovery.destroy(() => {
      dht.destroy(() => resolve())
    })
  })
})

test('initialize with default dht and lsd', () => {
  return new Promise<void>((resolve) => {
    const discovery = new Discovery({
      infoHash: randomBytes(20),
      peerId: randomBytes(20),
      port: 6000,
    })
    expect(discovery.dht).toBeTruthy()
    expect(discovery.lsd).toBeTruthy()
    discovery.destroy(() => resolve())
  })
})

test('initialize without dht', () => {
  return new Promise<void>((resolve) => {
    const discovery = new Discovery({
      infoHash: randomBytes(20),
      peerId: randomBytes(20),
      port: 6000,
      dht: false,
    })
    expect(discovery.dht).toBeNull()
    discovery.destroy(() => resolve())
  })
})

test('initialize without lsd', () => {
  return new Promise<void>((resolve) => {
    const discovery = new Discovery({
      infoHash: randomBytes(20),
      peerId: randomBytes(20),
      port: 6000,
      lsd: false,
    })
    expect(discovery.lsd).toBeNull()
    discovery.destroy(() => resolve())
  })
})
