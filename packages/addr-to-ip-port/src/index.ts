const ADDR_RE = /^\[?([^\]]+)]?:(\d+)$/ // ipv4/ipv6/hostname + port

const cache = new Map<string, [string, number]>()

export default function addrToIPPort(addr: string): [string, number] {
  if (cache.size === 100000) cache.clear()
  if (!cache.has(addr)) {
    const m = ADDR_RE.exec(addr)
    if (!m) throw new Error(`invalid addr: ${addr}`)
    cache.set(addr, [m[1], Number(m[2])])
  }
  return cache.get(addr)!
}
