import once from 'once'
import parallel from 'run-parallel'
import test from 'tape'
import DHT from '../src/index.js'
import * as common from './common.js'

const from = 2
const to = 20

for (let i = from; i <= to; i++) {
  runAnnounceLookupTest(i)
}

function runAnnounceLookupTest(numInstances: number) {
  test(`horde: announce+lookup with ${numInstances} DHTs`, (t) => {
    let numRunning = numInstances
    findPeers(numInstances, t, (err, dhts) => {
      if (err) throw err

      dhts.forEach((dht) => {
        for (const infoHash in (dht as any).tables) {
          const table = (dht as any).tables[infoHash]
          table.toJSON().nodes.forEach((contact: any) => {
            t.ok(contact.token, 'contact has token')
          })
        }

        process.nextTick(() => {
          dht.destroy((err) => {
            t.error(err, 'destroyed dht')
            if (--numRunning === 0) t.end()
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
function findPeers(
  numInstances: number,
  t: test.Test,
  cb: (err: Error | null, dhts?: DHT[]) => void
) {
  cb = once(cb) as any
  const dhts: DHT[] = []
  const timeoutId = setTimeout(() => {
    cb(new Error(`Timed out for ${numInstances} instances`))
  }, 20000)

  const infoHash = common.randomId().toString('hex')

  for (let i = 0; i < numInstances; i++) {
    const dht = new DHT({ bootstrap: false })

    dhts.push(dht)
    common.failOnWarningOrError(t, dht)
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
    t.equal(hash.toString('hex'), infoHash)
    t.equal(peer.port, 9998)
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
