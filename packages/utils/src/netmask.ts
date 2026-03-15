import ipaddr from 'ipaddr.js'

function ip2long(ip: string): number | bigint {
  const parsed = ipaddr.parse(ip)
  if (parsed.kind() === 'ipv4') {
    const bytes = (parsed as ipaddr.IPv4).toByteArray()
    return ((bytes[0]! << 24) + (bytes[1]! << 16) + (bytes[2]! << 8) + bytes[3]!) >>> 0
  }
  const bytes = (parsed as ipaddr.IPv6).toByteArray()
  let result = 0n
  for (let i = 0; i < 16; i++) {
    result = (result << 8n) | BigInt(bytes[i]!)
  }
  return result
}

function long2ip(long: number | bigint): string {
  if (typeof long === 'number') {
    return [(long >>> 24) & 0xff, (long >>> 16) & 0xff, (long >>> 8) & 0xff, long & 0xff].join('.')
  }
  const bytes = new Array(16).fill(0)
  let v = long
  for (let i = 15; i >= 0; i--) {
    bytes[i] = Number(v & 255n)
    v >>= 8n
  }
  const parts: number[] = []
  for (let i = 0; i < 16; i += 2) {
    parts.push((bytes[i] << 8) | bytes[i + 1])
  }
  return new ipaddr.IPv6(parts).toString()
}

class Netmask {
  base: string
  mask: string
  bitmask: number
  hostmask: string
  size: number | bigint
  first: string
  last: string
  broadcast: string | null

  private _isIPv6: boolean
  private _netLong: number | bigint
  private _maskLong: number | bigint

  constructor(net: string, mask?: string | number) {
    if (typeof net !== 'string' || !net) throw new Error("Missing `net' parameter")

    if (!mask) {
      const parts = net.split('/', 2)
      net = parts[0]!
      mask = parts[1] !== undefined ? parts[1] : net.includes(':') ? 128 : 32
    }

    this._isIPv6 = net.includes(':')
    const maxBits = this._isIPv6 ? 128 : 32

    if (typeof mask === 'string' && mask.includes('.')) {
      this._maskLong = ip2long(mask)
      this.bitmask = this._maskToBitmask(this._maskLong)
    } else {
      this.bitmask = parseInt(String(mask), 10)
      if (this.bitmask < 0 || this.bitmask > maxBits) {
        throw new Error(`Invalid mask for ip${this._isIPv6 ? '6' : '4'}: ${mask}`)
      }
      this._maskLong = this._bitmaskToMask(this.bitmask)
    }

    const netLong = ip2long(net)
    if (this._isIPv6) {
      this._netLong = (netLong as bigint) & (this._maskLong as bigint)
    } else {
      this._netLong = ((netLong as number) & (this._maskLong as number)) >>> 0
    }

    this.base = long2ip(this._netLong)
    this.mask = long2ip(this._maskLong)

    if (this._isIPv6) {
      this.hostmask = long2ip(~(this._maskLong as bigint) & ((1n << 128n) - 1n))
      this.size = 1n << BigInt(128 - this.bitmask)
    } else {
      this.hostmask = long2ip(~(this._maskLong as number) >>> 0)
      this.size = Math.pow(2, 32 - this.bitmask)
    }

    if (this._isIPv6) {
      this.first = this.base
      this.last = long2ip((this._netLong as bigint) + (this.size as bigint) - 1n)
      this.broadcast = null
    } else {
      if (this.bitmask <= 30) {
        this.first = long2ip((this._netLong as number) + 1)
        this.last = long2ip((this._netLong as number) + (this.size as number) - 2)
        this.broadcast = long2ip((this._netLong as number) + (this.size as number) - 1)
      } else {
        this.first = this.base
        this.last = long2ip((this._netLong as number) + (this.size as number) - 1)
        this.broadcast = null
      }
    }
  }

  private _bitmaskToMask(bitmask: number): number | bigint {
    if (bitmask === 0) return this._isIPv6 ? 0n : 0
    if (this._isIPv6) {
      if (bitmask === 128) return (1n << 128n) - 1n
      return ((1n << BigInt(bitmask)) - 1n) << BigInt(128 - bitmask)
    }
    if (bitmask === 32) return 0xffffffff
    return (((1 << bitmask) - 1) << (32 - bitmask)) >>> 0
  }

  private _maskToBitmask(mask: number | bigint): number {
    const maxBits = this._isIPv6 ? 128 : 32
    for (let i = maxBits; i >= 0; i--) {
      const expected = this._bitmaskToMask(i)
      if (mask === expected) return i
    }
    throw new Error(`Invalid mask: ${mask}`)
  }

  contains(ip: string | Netmask): boolean {
    if (ip instanceof Netmask) {
      return this.contains(ip.base) && this.contains(ip.broadcast ?? ip.last)
    }
    const ipLong = ip2long(ip)
    if (this._isIPv6) {
      return ((ipLong as bigint) & (this._maskLong as bigint)) === (this._netLong as bigint)
    }
    return (
      ((ipLong as number) & (this._maskLong as number)) >>> 0 === (this._netLong as number) >>> 0
    )
  }

  next(count = 1): Netmask {
    const nextBase = this._isIPv6
      ? long2ip((this._netLong as bigint) + (this.size as bigint) * BigInt(count))
      : long2ip((this._netLong as number) + (this.size as number) * count)
    return new Netmask(`${nextBase}/${this.bitmask}`)
  }

  forEach(fn: (ip: string, long: number | bigint, index: number) => void): void {
    const firstLong = ip2long(this.first)
    const lastLong = ip2long(this.last)
    let index = 0
    if (this._isIPv6) {
      let long = firstLong as bigint
      const end = lastLong as bigint
      while (long <= end) {
        fn(long2ip(long), long, index)
        index++
        long++
      }
    } else {
      let long = firstLong as number
      const end = lastLong as number
      while (long <= end) {
        fn(long2ip(long), long, index)
        index++
        long++
      }
    }
  }

  toString(): string {
    return `${this.base}/${this.bitmask}`
  }
}

export { Netmask, ip2long, long2ip }
