import { test, expect } from 'bun:test'
import DHT from '../../src/index.js'

const ubuntu = '62a4d9e139f3315f8716bcccca0cc984a9809da1'

const pride = '1E69917FBAA2C767BCA463A96B5572785C6D8A12'.toLowerCase() // Pride & Prejudice
const leaves = 'D2474E86C95B19B8BCFDB92BC12C9D44667CFA36'.toLowerCase() // Leaves of Grass

test(
  'Default bootstrap server returns at least one node',
  () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT()
    dht.on('error', console.error)

    dht.once('node', () => {
      dht.destroy()
      resolve()
    })
  })
  },
  60000,
)

test(
  'Default bootstrap server returns a peer for one torrent',
  () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT()
    dht.on('error', console.error)

    dht.on('node', (event) => {
      // console.log(event)
    })

    dht.on('ready', () => {
      dht.lookup(ubuntu)

      dht.once('peer', (peer, infoHash) => {
        expect(infoHash.toString('hex')).toBe(ubuntu)
        dht.destroy()
        resolve()
      })
    })
  })
  },
  60000,
)

test(
  'Default bootstrap server returns a peer for two torrents (simultaneously)',
  () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT()
    dht.on('error', console.error)

    dht.on('ready', () => {
      dht.lookup(pride)
      dht.lookup(leaves)

      let prideDone = false
      let leavesDone = false
      dht.on('peer', (peer, infoHash) => {
        if (!prideDone && infoHash.toString('hex') === pride) {
          prideDone = true
        }
        if (!leavesDone && infoHash.toString('hex') === leaves) {
          leavesDone = true
        }
        if (leavesDone && prideDone) {
          dht.destroy()
          resolve()
        }
      })
    })
  })
  },
  60000,
)

test(
  'Find peers before ready is emitted',
  () => {
  return new Promise<void>((resolve) => {
    const dht = new DHT()
    dht.on('error', console.error)
    const then = Date.now()

    dht.once('node', () => {})

    dht.once('peer', (peer, infoHash) => {
      expect(infoHash.toString('hex')).toBe(ubuntu)
      dht.destroy()
      resolve()
    })

    dht.lookup(ubuntu)
  })
  },
  60000,
)
