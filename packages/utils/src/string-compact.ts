import ipaddr from 'ipaddr.js'

import { addrToIPPort } from './addr-ip-port'

export function string2compact(addrs: string | string[]): Uint8Array {
  if (typeof addrs === 'string') {
    addrs = [addrs]
  }

  const buffers = addrs.map((addr) => {
    const s = addrToIPPort(addr)
    if (s.length !== 2) {
      throw new Error('invalid address format, expecting: [IP]:[PORT]')
    }

    const ip = ipaddr.parse(s[0])
    const ipBuf = new Uint8Array(ip.toByteArray())
    const port = s[1]
    const portBuf = new Uint8Array(2)
    new DataView(portBuf.buffer).setUint16(0, port, false)

    const result = new Uint8Array(ipBuf.length + 2)
    result.set(ipBuf, 0)
    result.set(portBuf, ipBuf.length)
    return result
  })

  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const buf of buffers) {
    result.set(buf, offset)
    offset += buf.length
  }
  return result
}

export function compact2string(buf: Uint8Array): string {
  if (buf.length === 6) {
    const ip = `${buf[0]}.${buf[1]}.${buf[2]}.${buf[3]}`
    const port = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint16(4, false)
    return `${ip}:${port}`
  } else if (buf.length === 18) {
    const ipBytes = buf.slice(0, 16)
    const ip = ipaddr.fromByteArray(Array.from(ipBytes)).toString()
    const port = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint16(16, false)
    return `[${ip}]:${port}`
  }
  throw new Error(`Invalid compact peer format: expected 6 or 18 bytes, got ${buf.length}`)
}

export function compact2stringMulti(buf: Uint8Array): string[] {
  const result: string[] = []
  const step = 6
  for (let i = 0; i < buf.length; i += step) {
    result.push(compact2string(buf.subarray(i, i + step)))
  }
  return result
}

export function compact2stringMulti6(buf: Uint8Array): string[] {
  const result: string[] = []
  const step = 18
  for (let i = 0; i < buf.length; i += step) {
    result.push(compact2string(buf.subarray(i, i + step)))
  }
  return result
}

export const multi = string2compact
export const multi6 = string2compact
