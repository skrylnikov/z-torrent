import crypto from 'node:crypto'
import ed from 'bittorrent-dht-sodium'
import ip from 'ip'
import type DHT from '../src/client.js'

export const failOnWarningOrError = (t: any, dht: DHT) => {
  dht.on('warning', (err) => {
    t.fail(err)
  })
  dht.on('error', (err) => {
    t.fail(err)
  })
}

export const randomHost = () => {
  return ip.toString(crypto.randomBytes(4))
}

export const randomPort = () => {
  return crypto.randomBytes(2).readUInt16LE(0)
}

export const randomAddr = () => {
  return { host: randomHost(), port: randomPort() }
}

export const randomId = () => {
  return crypto.randomBytes(20)
}

export const addRandomNodes = (dht: DHT, num: number) => {
  for (let i = 0; i < num; i++) {
    dht.addNode({
      id: randomId(),
      host: randomHost(),
      port: randomPort(),
    })
  }
}

export const addRandomPeers = (dht: DHT, num: number) => {
  for (let i = 0; i < num; i++) {
    dht._addPeer(randomAddr(), randomId(), randomAddr())
  }
}

export const fill = (n: number, s: string) => {
  const bs = Buffer.from(s)
  const b = Buffer.allocUnsafe(n)
  for (let i = 0; i < n; i++) {
    b[i] = bs[i % bs.length]
  }
  return b
}

export const sign = (keypair: { sk: Buffer; pk: Buffer }) => {
  return (buf: Buffer) => {
    return ed.sign(buf, keypair.sk)
  }
}
