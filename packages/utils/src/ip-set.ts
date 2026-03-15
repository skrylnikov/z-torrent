import ipaddr from 'ipaddr.js'

class IPSetNode {
  start: number
  end: number
  max: number
  depth: number
  left: IPSetNode | null
  right: IPSetNode | null

  constructor(start: number, end: number) {
    this.start = start
    this.end = end
    this.max = end
    this.depth = 1
    this.left = null
    this.right = null
  }

  add(start: number, end: number): boolean {
    const d = start - this.start
    let update = false

    if (d === 0 && this.end < end) {
      this.end = end
      update = true
    } else if (d < 0) {
      if (this.left) {
        update = this.left.add(start, end)
        if (update) this._balance()
      } else {
        this.left = new IPSetNode(start, end)
        update = true
      }
    } else if (d > 0) {
      if (this.right) {
        update = this.right.add(start, end)
        if (update) this._balance()
      } else {
        this.right = new IPSetNode(start, end)
        update = true
      }
    }

    if (update) this._update()
    return update
  }

  contains(addr: number): boolean {
    let node: IPSetNode | null = this
    while (node && !(addr >= node.start && addr <= node.end)) {
      if (node.left && node.left.max >= addr) node = node.left
      else node = node.right
    }
    return !!node
  }

  _balance(): void {
    const ldepth = this.left ? this.left.depth : 0
    const rdepth = this.right ? this.right.depth : 0

    if (ldepth > rdepth + 1) {
      const lldepth = this.left!.left ? this.left!.left.depth : 0
      const lrdepth = this.left!.right ? this.left!.right.depth : 0
      if (lldepth < lrdepth) this.left!._rotateRR()
      this._rotateLL()
    } else if (ldepth + 1 < rdepth) {
      const rrdepth = this.right!.right ? this.right!.right.depth : 0
      const rldepth = this.right!.left ? this.right!.left.depth : 0
      if (rldepth > rrdepth) this.right!._rotateLL()
      this._rotateRR()
    }
  }

  _rotateLL(): void {
    const _start = this.start
    const _end = this.end
    const _right = this.right

    this.start = this.left!.start
    this.end = this.left!.end
    this.right = this.left
    this.left = this.left!.left

    this.right!.left = this.right!.right
    this.right!.right = _right
    this.right!.start = _start
    this.right!.end = _end

    this.right!._update()
    this._update()
  }

  _rotateRR(): void {
    const _start = this.start
    const _end = this.end
    const _left = this.left

    this.start = this.right!.start
    this.end = this.right!.end
    this.left = this.right
    this.right = this.right!.right

    this.left!.right = this.left!.left
    this.left!.left = _left
    this.left!.start = _start
    this.left!.end = _end

    this.left!._update()
    this._update()
  }

  _update(): void {
    this.depth = 1
    if (this.left) this.depth = this.left.depth + 1
    if (this.right && this.depth <= this.right.depth) this.depth = this.right.depth + 1
    this.max = Math.max(this.end, this.left ? this.left.max : 0, this.right ? this.right.max : 0)
  }
}

class IPSetNodeBigInt {
  start: bigint
  end: bigint
  max: bigint
  depth: number
  left: IPSetNodeBigInt | null
  right: IPSetNodeBigInt | null

  constructor(start: bigint, end: bigint) {
    this.start = start
    this.end = end
    this.max = end
    this.depth = 1
    this.left = null
    this.right = null
  }

  add(start: bigint, end: bigint): boolean {
    const d = Number(start - this.start)
    let update = false

    if (d === 0 && this.end < end) {
      this.end = end
      update = true
    } else if (d < 0) {
      if (this.left) {
        update = this.left.add(start, end)
        if (update) this._balance()
      } else {
        this.left = new IPSetNodeBigInt(start, end)
        update = true
      }
    } else if (d > 0) {
      if (this.right) {
        update = this.right.add(start, end)
        if (update) this._balance()
      } else {
        this.right = new IPSetNodeBigInt(start, end)
        update = true
      }
    }

    if (update) this._update()
    return update
  }

  contains(addr: bigint): boolean {
    let node: IPSetNodeBigInt | null = this
    while (node && !(addr >= node.start && addr <= node.end)) {
      if (node.left && node.left.max >= addr) node = node.left
      else node = node.right
    }
    return !!node
  }

  _balance(): void {
    const ldepth = this.left ? this.left.depth : 0
    const rdepth = this.right ? this.right.depth : 0

    if (ldepth > rdepth + 1) {
      const lldepth = this.left!.left ? this.left!.left.depth : 0
      const lrdepth = this.left!.right ? this.left!.right.depth : 0
      if (lldepth < lrdepth) this.left!._rotateRR()
      this._rotateLL()
    } else if (ldepth + 1 < rdepth) {
      const rrdepth = this.right!.right ? this.right!.right.depth : 0
      const rldepth = this.right!.left ? this.right!.left.depth : 0
      if (rldepth > rrdepth) this.right!._rotateLL()
      this._rotateRR()
    }
  }

  _rotateLL(): void {
    const _start = this.start
    const _end = this.end
    const _right = this.right

    this.start = this.left!.start
    this.end = this.left!.end
    this.right = this.left
    this.left = this.left!.left

    this.right!.left = this.right!.right
    this.right!.right = _right
    this.right!.start = _start
    this.right!.end = _end

    this.right!._update()
    this._update()
  }

  _rotateRR(): void {
    const _start = this.start
    const _end = this.end
    const _left = this.left

    this.start = this.right!.start
    this.end = this.right!.end
    this.left = this.right
    this.right = this.right!.right

    this.left!.right = this.left!.left
    this.left!.left = _left
    this.left!.start = _start
    this.left!.end = _end

    this.left!._update()
    this._update()
  }

  _update(): void {
    this.depth = 1
    if (this.left) this.depth = this.left.depth + 1
    if (this.right && this.depth <= this.right.depth) this.depth = this.right.depth + 1
    this.max =
      this.end > (this.left ? this.left.max : 0n)
        ? this.end > (this.right ? this.right.max : 0n)
          ? this.end
          : this.right!.max
        : this.left!.max > (this.right ? this.right.max : 0n)
          ? this.left!.max
          : this.right!.max
  }
}

function toLong(ip: string): number {
  const parts = ip.split('.')
  return (
    ((parseInt(parts[0]!, 10) << 24) +
      (parseInt(parts[1]!, 10) << 16) +
      (parseInt(parts[2]!, 10) << 8) +
      parseInt(parts[3]!, 10)) >>>
    0
  )
}

function toBigInt(ip: string): bigint {
  const parsed = ipaddr.parse(ip) as ipaddr.IPv6
  let result = 0n
  for (let i = 0; i < 8; i++) {
    result = (result << 16n) | BigInt(parsed.parts[i]!)
  }
  return result
}

function parseCIDR(cidr: string): { start: string; end: string; isIPv6: boolean } | null {
  try {
    const parsed = ipaddr.parseCIDR(cidr)
    const addr = parsed[0]
    const prefixLength = parsed[1]

    if (addr.kind() === 'ipv4') {
      const ipv4 = addr as ipaddr.IPv4
      const bytes = ipv4.toByteArray()
      const maskBytes = prefixLengthToMaskBytes(prefixLength, 4)
      const startBytes = bytes.map((b, i) => b & maskBytes[i]!)
      const endBytes = bytes.map((b, i) => b | (~maskBytes[i]! & 255))

      const start = startBytes.join('.')
      const end = endBytes.join('.')
      return { start, end, isIPv6: false }
    } else {
      const ipv6 = addr as ipaddr.IPv6
      const bytes = ipv6.toByteArray()
      const maskBytes = prefixLengthToMaskBytes(prefixLength, 16)
      const startBytes = bytes.map((b, i) => b & maskBytes[i]!)
      const endBytes = bytes.map((b, i) => b | (~maskBytes[i]! & 255))

      const start = bytesToIPv6(startBytes)
      const end = bytesToIPv6(endBytes)
      return { start, end, isIPv6: true }
    }
  } catch {
    return null
  }
}

function prefixLengthToMaskBytes(prefixLength: number, bytes: number): number[] {
  const mask = new Array(bytes).fill(0)
  let remaining = prefixLength
  for (let i = 0; i < bytes && remaining > 0; i++) {
    if (remaining >= 8) {
      mask[i] = 255
      remaining -= 8
    } else {
      mask[i] = 256 - (1 << (8 - remaining))
      remaining = 0
    }
  }
  return mask
}

function bytesToIPv6(bytes: number[]): string {
  const parts: number[] = []
  for (let i = 0; i < 16; i += 2) {
    parts.push((bytes[i]! << 8) | bytes[i + 1]!)
  }
  const ipv6 = new ipaddr.IPv6(parts)
  return ipv6.toString()
}

export interface IPRange {
  start: string
  end?: string
}

export type IPInput = string | IPRange

export class IPSet {
  private tree4: IPSetNode | null = null
  private tree6: IPSetNodeBigInt | null = null

  constructor(blocklist?: IPInput[]) {
    if (Array.isArray(blocklist)) {
      for (const block of blocklist) {
        this.add(block)
      }
    }
  }

  add(start: string | IPRange, end?: string): void {
    if (typeof start === 'object') {
      end = start.end
      start = start.start
    }
    if (!start) return

    const cidrMatch = /^\/\d{1,3}$/.test(start.slice(start.lastIndexOf('/')))
    if (cidrMatch) {
      const parsed = parseCIDR(start)
      if (parsed) {
        this._addRaw(parsed.start, parsed.end, parsed.isIPv6)
      }
      return
    }

    const isIPv6 = start.includes(':')
    if (!end) end = start
    this._addRaw(start, end, isIPv6)
  }

  private _addRaw(start: string, end: string, isIPv6: boolean): void {
    if (isIPv6) {
      const startNum = toBigInt(start)
      const endNum = toBigInt(end)

      if (endNum < startNum) throw new Error('Invalid block range')

      if (this.tree6) this.tree6.add(startNum, endNum)
      else this.tree6 = new IPSetNodeBigInt(startNum, endNum)
    } else {
      const startNum = toLong(start)
      const endNum = toLong(end)

      if (startNum < 0 || endNum > 4294967295 || endNum < startNum) {
        throw new Error('Invalid block range')
      }

      if (this.tree4) this.tree4.add(startNum, endNum)
      else this.tree4 = new IPSetNode(startNum, endNum)
    }
  }

  contains(addr: string): boolean {
    const isIPv6 = addr.includes(':')

    if (isIPv6) {
      if (!this.tree6) return false
      const addrNum = toBigInt(addr)
      return this.tree6.contains(addrNum)
    } else {
      if (!this.tree4) return false
      const addrNum = toLong(addr)
      return this.tree4.contains(addrNum)
    }
  }
}
