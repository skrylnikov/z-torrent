import { test } from 'bun:test'
import DHT from '../src/index.js'
import * as common from './common.js'

test('explicitly set nodeId', () => {
  return new Promise<void>((resolve) => {
    const nodeId = common.randomId()

    const dht = new DHT({
      nodeId,
      bootstrap: false,
    })

    common.failOnWarningOrError(dht)

    dht.on('node', () => {
      throw new Error('should not find nodes')
    })

    dht.on('peer', () => {
      throw new Error('should not find peers')
    })

    const abort = dht.lookup(common.randomId())
    abort()

    setTimeout(() => {
      dht.destroy()
      resolve()
    }, 500)
  })
})
