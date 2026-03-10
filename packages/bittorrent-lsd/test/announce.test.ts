import { expect, describe, test } from 'bun:test'
import sinon from 'sinon'
import dgram from 'dgram'
import * as common from './common.js'
import LSD from 'bittorrent-lsd'

test('should emit a warning when addMembership fails', () => {
  return new Promise<void>((resolve) => {
    const opts = {
      peerId: common.randomId(),
      infoHash: common.randomHash(),
      port: common.randomPort(),
    }
    const lsd = new LSD(opts)

    sinon.stub(lsd.server, 'addMembership').throws()

    lsd.on('warning', (err: unknown) => {
      expect(err).toBeTruthy()
      lsd.destroy(() => resolve())
    })

    lsd.start()
  })
})

test('should emit peer when receiving a valid announce', () => {
  return new Promise<void>((resolve, reject) => {
    const opts = {
      peerId: common.randomId(),
      infoHash: common.randomHash(),
      port: common.randomPort(),
    }
    const lsd = new LSD(opts)
    const client = dgram.createSocket('udp4')

    const host = '239.192.152.143:6771'
    const port = '51413'
    const infoHash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'

    client.connect(6771, '239.192.152.143', (err) => {
      if (err) reject(err)

      const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${infoHash}\r\n\r\n\r\n`
      client.send(announce)
      client.close()
    })

    lsd.on('error', (err: Error) => reject(err))

    lsd.on('peer', (peerAddress: string, peerInfoHash: string) => {
      expect(typeof peerAddress).toBe('string')
      expect(peerAddress).toMatch(/^\d+\.\d+\.\d+\.\d+:\d+$/)
      expect(peerInfoHash).toBe(infoHash)

      lsd.destroy(() => resolve())
    })

    lsd.start()
  })
})

describe.serial('announce timers', () => {
test('should not announce once when 3min passed', () => {
  return new Promise<void>((resolve, reject) => {
    const clock = sinon.useFakeTimers(new Date())
    let counter = 0

    const opts = {
      peerId: common.randomId(),
      infoHash: common.randomHash(),
      port: common.randomPort(),
    }
    const lsd = new LSD(opts)
    const client = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    const host = '239.192.152.143:6771'
    const port = opts.port.toString()
    const infoHash = opts.infoHash.toString('hex')
    const cookie = `bittorrent-lsd-${opts.peerId.toString('hex')}`

    client.bind(6771, () => {
      client.addMembership('239.192.152.143')
    })

    client.on('message', (msg: Buffer) => {
      const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${infoHash}\r\ncookie: ${cookie}\r\n\r\n\r\n`

      expect(msg.toString()).toBe(announce)
      counter++

      if (counter === 2) {
        reject(new Error('Should not announce twice'))
      } else {
        clock.tick(180000)

        lsd.destroy(() => {
          client.close()
          clock.restore()
          resolve()
        })
      }
    })

    lsd.start()
  })
})

test('should announce twice when 5min passed', () => {
  return new Promise<void>((resolve, reject) => {
    const clock = sinon.useFakeTimers(new Date())
    let counter = 0

    const opts = {
      peerId: common.randomId(),
      infoHash: common.randomHash(),
      port: common.randomPort(),
    }
    const lsd = new LSD(opts)
    const client = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    const host = '239.192.152.143:6771'
    const port = opts.port.toString()
    const infoHash = opts.infoHash.toString('hex')
    const cookie = `bittorrent-lsd-${opts.peerId.toString('hex')}`

    client.bind(6771, () => {
      client.addMembership('239.192.152.143')
    })

    client.on('message', (msg: Buffer) => {
      const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${infoHash}\r\ncookie: ${cookie}\r\n\r\n\r\n`

      expect(msg.toString()).toBe(announce)
      counter++

      if (counter === 2) {
        lsd.destroy(() => {
          client.close()
          clock.restore()
          resolve()
        })
      } else {
        clock.tick(300000)
      }
    })

    lsd.start()
  })
})
})
