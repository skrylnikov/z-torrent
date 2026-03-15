import { expect, test, describe } from 'bun:test'

import { IPSet } from '../src/ip-set'

describe('IPv4', () => {
  test('single IP', () => {
    const ipSet = new IPSet()
    ipSet.add('1.2.3.4')
    expect(ipSet.contains('1.2.3.4')).toBe(true)
    expect(ipSet.contains('1.1.1.1')).toBe(false)
  })

  test('multiple IPs', () => {
    const ipSet = new IPSet()
    ipSet.add('1.2.3.4')
    ipSet.add('5.6.7.8')
    expect(ipSet.contains('1.2.3.4')).toBe(true)
    expect(ipSet.contains('5.6.7.8')).toBe(true)
    expect(ipSet.contains('1.1.1.1')).toBe(false)
  })

  test('IP range', () => {
    const ipSet = new IPSet()
    ipSet.add({ start: '1.2.3.0', end: '1.2.3.255' })
    expect(ipSet.contains('1.2.3.0')).toBe(true)
    expect(ipSet.contains('1.2.3.128')).toBe(true)
    expect(ipSet.contains('1.2.3.255')).toBe(true)
    expect(ipSet.contains('1.2.2.255')).toBe(false)
    expect(ipSet.contains('1.2.4.0')).toBe(false)
  })

  test('multiple ranges', () => {
    const ipSet = new IPSet([
      { start: '1.2.3.0', end: '1.2.3.255' },
      { start: '5.6.7.0', end: '5.6.7.255' },
      { start: '192.168.1.1', end: '192.168.1.230' },
    ])
    expect(ipSet.contains('1.2.3.0')).toBe(true)
    expect(ipSet.contains('1.2.3.255')).toBe(true)
    expect(ipSet.contains('5.6.7.0')).toBe(true)
    expect(ipSet.contains('5.6.7.255')).toBe(true)
    expect(ipSet.contains('192.168.1.1')).toBe(true)
    expect(ipSet.contains('192.168.1.230')).toBe(true)
    expect(ipSet.contains('192.168.1.231')).toBe(false)
    expect(ipSet.contains('1.1.1.1')).toBe(false)
  })

  test('CIDR notation', () => {
    const ipSet = new IPSet()
    ipSet.add('192.168.1.0/24')
    expect(ipSet.contains('192.168.1.0')).toBe(true)
    expect(ipSet.contains('192.168.1.128')).toBe(true)
    expect(ipSet.contains('192.168.1.255')).toBe(true)
    expect(ipSet.contains('192.168.0.255')).toBe(false)
    expect(ipSet.contains('192.168.2.0')).toBe(false)
  })

  test('constructor with array', () => {
    const ipSet = new IPSet([{ start: '1.2.3.4' }, { start: '5.6.7.8' }])
    expect(ipSet.contains('1.2.3.4')).toBe(true)
    expect(ipSet.contains('5.6.7.8')).toBe(true)
    expect(ipSet.contains('1.1.1.1')).toBe(false)
  })

  test('empty IPSet', () => {
    const ipSet = new IPSet()
    expect(ipSet.contains('1.2.3.4')).toBe(false)
  })

  test('invalid range throws', () => {
    const ipSet = new IPSet()
    expect(() => ipSet.add({ start: '1.2.3.4', end: '1.2.3.3' })).toThrow('Invalid block range')
  })
})

describe('IPv6', () => {
  test('single IPv6', () => {
    const ipSet = new IPSet()
    ipSet.add('::1')
    expect(ipSet.contains('::1')).toBe(true)
    expect(ipSet.contains('::2')).toBe(false)
  })

  test('IPv6 range', () => {
    const ipSet = new IPSet()
    ipSet.add({ start: '2001:db8::1', end: '2001:db8::ff' })
    expect(ipSet.contains('2001:db8::1')).toBe(true)
    expect(ipSet.contains('2001:db8::80')).toBe(true)
    expect(ipSet.contains('2001:db8::ff')).toBe(true)
    expect(ipSet.contains('2001:db8::100')).toBe(false)
    expect(ipSet.contains('2001:db9::1')).toBe(false)
  })

  test('IPv6 CIDR', () => {
    const ipSet = new IPSet()
    ipSet.add('2001:db8::/32')
    expect(ipSet.contains('2001:db8::1')).toBe(true)
    expect(ipSet.contains('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(true)
    expect(ipSet.contains('2001:db9::1')).toBe(false)
  })

  test('mixed IPv4 and IPv6', () => {
    const ipSet = new IPSet()
    ipSet.add('1.2.3.4')
    ipSet.add('::1')
    expect(ipSet.contains('1.2.3.4')).toBe(true)
    expect(ipSet.contains('::1')).toBe(true)
    expect(ipSet.contains('1.1.1.1')).toBe(false)
    expect(ipSet.contains('::2')).toBe(false)
  })
})

describe('AVL tree balancing', () => {
  test('large number of ranges', () => {
    const ipSet = new IPSet()
    for (let i = 0; i < 1000; i++) {
      ipSet.add({
        start: `10.${Math.floor(i / 256)}.${i % 256}.0`,
        end: `10.${Math.floor(i / 256)}.${i % 256}.255`,
      })
    }
    expect(ipSet.contains('10.0.0.0')).toBe(true)
    expect(ipSet.contains('10.0.0.128')).toBe(true)
    expect(ipSet.contains('10.3.231.100')).toBe(true)
    expect(ipSet.contains('10.10.10.10')).toBe(false)
    expect(ipSet.contains('192.168.1.1')).toBe(false)
  })
})
