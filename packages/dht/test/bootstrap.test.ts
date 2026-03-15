import { test, expect } from 'bun:test'
import DHT from '../src/index.js'
import * as common from './common.js'

// https://github.com/webtorrent/bittorrent-dht/pull/36
test('bootstrap and listen to custom port', () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT({ bootstrap: ['1.2.3.4:1000'] })
    common.failOnWarningOrError(dht)

    const port = Math.floor(Math.random() * 60000) + 1024

    expect(!dht.listening).toBeTruthy()
    dht.listen(port)
    expect(!dht.listening).toBeTruthy()

    // bootstrapping should wait until next tick, so user has a chance to
    // listen to a custom port
    dht.on('listening', () => {
      expect(dht.listening).toBeTruthy()
      expect((dht.address() as any).port).toBe(port)
    })

    dht.on('ready', () => {
      dht.destroy()
      resolve()
    })
  })
})
