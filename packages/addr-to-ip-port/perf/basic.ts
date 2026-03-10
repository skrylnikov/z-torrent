import addrToIPPort from '../src/index.js'
import { suite } from './util.js'

const s = suite()

// Around 262k addresses to cause 2 resets
const addrs: string[] = []
for (let i = 1; i < 65536; i++) {
  addrs.push(`127.0.0.1:${i}`)
  addrs.push(`1.1.1.1:${i}`)
  addrs.push(`8.8.8.8:${i}`)
  addrs.push(`8.8.4.4:${i}`)
}

s.add('addr-to-ip-port', () => {
  let ipPort
  for (let i = 0, len = addrs.length; i < len; i++) {
    // First pass no cache
    ipPort = addrToIPPort(addrs[i])
    // Should be in cache immediately
    ipPort = addrToIPPort(addrs[i])
  }
  // Repeat after auto-resets (cache clears at 100k keys)
  for (let i = 0, len = addrs.length; i < len; i++) {
    // First pass with cache on 100k keys
    ipPort = addrToIPPort(addrs[i])
    // Should be in cache immediately
    ipPort = addrToIPPort(addrs[i])
  }
})
