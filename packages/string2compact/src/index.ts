import addrToIPPort from 'addr-to-ip-port'
import ipaddr from 'ipaddr.js'

const addrs = (addrs: string | string[]): Uint8Array => {
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

export default addrs
export { addrs as multi, addrs as multi6 }
