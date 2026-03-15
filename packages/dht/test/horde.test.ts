import { once } from '@z-torrent/utils'
import parallel from 'run-parallel'

import { test, expect } from 'bun:test'
import DHT from '../src/index.js'
import * as common from './common.js'

const from = 2
const to = 20

for (let i = from; i <= to; i++) {
  runAnnounceLookupTest(i)
}

function runAnnounceLookupTest(numInstances: number) {
  test(`horde: announce+lookup with ${numInstances} DHTs`, () => {
    return new Promise<void>((resolve, reject) => {
      let numRunning = numInstances
      findPeers(numInstances, (err, dhts) => {
        if (err) {
          reject(err)
          return
        }

        dhts!.forEach((dht) => {
          for (const infoHash in (dht as any).tables) {
            const table = (dht as any).tables[infoHash]
            table.toJSON().nodes.forEach((contact: any) => {
              expect(contact.token).toBeTruthy()
            })
          }

          queueMicrotask(() => {
            dht.destroy((err) => {
              if (err) throw err
              if (--numRunning === 0) resolve()
            })
          })
        })
      })
    })
  })
}

/**
 *  Initialize [numInstances] dhts, have one announce an infoHash, and another perform a
 *  lookup. Times out after a while.
 */
function findPeers(numInstances: number, cb: (err: Error | null, dhts?: DHT[]) => void) {
  cb = once(cb) as any
  const dhts: DHT[] = []
  const timeoutId = setTimeout(() => {
    cb(new Error(`Timed out for ${numInstances} instances`))
  }, 20000)

  const infoHash = common.randomId().toString('hex')

  for (let i = 0; i < numInstances; i++) {
    const dht = new DHT({ bootstrap: false })

    dhts.push(dht)
    common.failOnWarningOrError(dht)
  }

  // wait until every dht is listening
  const tasks = dhts.map((dht) => {
    return (cb: () => void) => {
      dht.listen(cb)
    }
  })

  parallel(tasks, () => {
    // add each other to routing tables
    makeFriends(dhts)

    // lookup from other DHTs
    dhts[0].announce(infoHash, 9998, () => {
      dhts[1].lookup(infoHash)
    })
  })

  dhts[1].on('peer', (peer, hash) => {
    expect(hash.toString('hex')).toBe(infoHash)
    expect(peer.port).toBe(9998)
    clearTimeout(timeoutId)
    cb(null, dhts)
  })
}

/**
 * Add every dht address to the dht "before" it.
 * This should guarantee that any dht can be located (with enough queries).
 */
function makeFriends(dhts: DHT[]) {
  const len = dhts.length
  for (let i = 0; i < len; i++) {
    const next = dhts[(i + 1) % len]
    dhts[i].addNode({
      host: '127.0.0.1',
      port: (next.address() as any).port,
      id: next.nodeId,
    })
  }
}
