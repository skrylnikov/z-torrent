import { expect, test, describe } from 'bun:test'

import { Netmask, ip2long, long2ip } from '../src/netmask'

describe('IPv4', () => {
  test('basic /24 block', () => {
    const block = new Netmask('192.168.1.0/24')
    expect(block.base).toBe('192.168.1.0')
    expect(block.mask).toBe('255.255.255.0')
    expect(block.bitmask).toBe(24)
    expect(block.hostmask).toBe('0.0.0.255')
    expect(block.size).toBe(256)
    expect(block.first).toBe('192.168.1.1')
    expect(block.last).toBe('192.168.1.254')
    expect(block.broadcast).toBe('192.168.1.255')
    expect(block.toString()).toBe('192.168.1.0/24')
  })

  test('/16 block', () => {
    const block = new Netmask('10.0.0.0/16')
    expect(block.base).toBe('10.0.0.0')
    expect(block.mask).toBe('255.255.0.0')
    expect(block.size).toBe(65536)
    expect(block.first).toBe('10.0.0.1')
    expect(block.last).toBe('10.0.255.254')
    expect(block.broadcast).toBe('10.0.255.255')
  })

  test('/8 block', () => {
    const block = new Netmask('10.0.0.0/8')
    expect(block.base).toBe('10.0.0.0')
    expect(block.mask).toBe('255.0.0.0')
    expect(block.size).toBe(16777216)
    expect(block.first).toBe('10.0.0.1')
    expect(block.last).toBe('10.255.255.254')
  })

  test('/32 single host', () => {
    const block = new Netmask('192.168.1.1/32')
    expect(block.base).toBe('192.168.1.1')
    expect(block.first).toBe('192.168.1.1')
    expect(block.last).toBe('192.168.1.1')
    expect(block.broadcast).toBe(null)
  })

  test('/31 point-to-point', () => {
    const block = new Netmask('192.168.1.0/31')
    expect(block.size).toBe(2)
    expect(block.first).toBe('192.168.1.0')
    expect(block.last).toBe('192.168.1.1')
    expect(block.broadcast).toBe(null)
  })

  test('/30 block', () => {
    const block = new Netmask('192.168.1.0/30')
    expect(block.size).toBe(4)
    expect(block.first).toBe('192.168.1.1')
    expect(block.last).toBe('192.168.1.2')
    expect(block.broadcast).toBe('192.168.1.3')
  })

  test('with dotted mask', () => {
    const block = new Netmask('192.168.1.0', '255.255.255.0')
    expect(block.bitmask).toBe(24)
    expect(block.base).toBe('192.168.1.0')
  })

  test('contains IP', () => {
    const block = new Netmask('192.168.1.0/24')
    expect(block.contains('192.168.1.0')).toBe(true)
    expect(block.contains('192.168.1.128')).toBe(true)
    expect(block.contains('192.168.1.255')).toBe(true)
    expect(block.contains('192.168.2.0')).toBe(false)
    expect(block.contains('10.0.0.1')).toBe(false)
  })

  test('contains other Netmask', () => {
    const block = new Netmask('192.168.0.0/16')
    const sub = new Netmask('192.168.1.0/24')
    const other = new Netmask('10.0.0.0/8')
    expect(block.contains(sub)).toBe(true)
    expect(block.contains(other)).toBe(false)
  })

  test('next block', () => {
    const block = new Netmask('192.168.1.0/24')
    const next = block.next()
    expect(next.base).toBe('192.168.2.0')
    expect(next.toString()).toBe('192.168.2.0/24')
  })

  test('forEach', () => {
    const block = new Netmask('192.168.1.0/30')
    const ips: string[] = []
    block.forEach((ip) => ips.push(ip))
    expect(ips).toEqual(['192.168.1.1', '192.168.1.2'])
  })
})

describe('IPv6', () => {
  test('basic /64 block', () => {
    const block = new Netmask('2001:db8::/64')
    expect(block.base).toBe('2001:db8::')
    expect(block.bitmask).toBe(64)
    expect(block.first).toBe('2001:db8::')
    expect(block.broadcast).toBe(null)
  })

  test('/128 single host', () => {
    const block = new Netmask('::1/128')
    expect(block.base).toBe('::1')
    expect(block.first).toBe('::1')
    expect(block.last).toBe('::1')
    expect(block.broadcast).toBe(null)
  })

  test('/48 block', () => {
    const block = new Netmask('2001:db8:abcd::/48')
    expect(block.bitmask).toBe(48)
    expect(block.base).toBe('2001:db8:abcd::')
  })

  test('contains IP', () => {
    const block = new Netmask('2001:db8::/32')
    expect(block.contains('2001:db8::1')).toBe(true)
    expect(block.contains('2001:db8:abcd::1')).toBe(true)
    expect(block.contains('2001:db9::1')).toBe(false)
  })
})

describe('ip2long / long2ip', () => {
  test('IPv4 roundtrip', () => {
    const ips = ['0.0.0.0', '127.0.0.1', '192.168.1.1', '255.255.255.255']
    for (const ip of ips) {
      expect(long2ip(ip2long(ip))).toBe(ip)
    }
  })

  test('IPv6 roundtrip', () => {
    const ips = ['::', '::1', '2001:db8::1', 'fe80::1']
    for (const ip of ips) {
      expect(long2ip(ip2long(ip))).toBe(ip)
    }
  })

  test('IPv4 specific values', () => {
    expect(ip2long('0.0.0.0')).toBe(0)
    expect(ip2long('0.0.0.1')).toBe(1)
    expect(ip2long('1.0.0.0')).toBe(16777216)
    expect(ip2long('255.255.255.255')).toBe(4294967295)
  })
})

describe('errors', () => {
  test('missing net parameter', () => {
    expect(() => new Netmask('' as string)).toThrow("Missing `net' parameter")
  })

  test('invalid bitmask', () => {
    expect(() => new Netmask('1.2.3.4/33')).toThrow('Invalid mask for ip4')
    expect(() => new Netmask('::1/129')).toThrow('Invalid mask for ip6')
  })
})
