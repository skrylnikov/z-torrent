import { expect, test } from 'bun:test'

import { string2compact, compact2stringMulti, compact2stringMulti6 } from '../src/string-compact'

test('single', () => {
  const compact = string2compact('10.10.10.5:65408')
  expect(compact).toEqual(Uint8Array.from(Buffer.from('0A0A0A05FF80', 'hex')))
})

test('single IPv6', () => {
  const compact = string2compact('[2a03:2880:2110:9f07:face:b00c::1]:80')
  expect(compact).toEqual(
    Uint8Array.from(Buffer.from('2a03288021109f07faceb00c000000010050', 'hex'))
  )
})

test('multi', () => {
  const ips = ['127.0.0.1:6881', '127.0.0.1:6882']
  expect(compact2stringMulti(Buffer.from(string2compact(ips)))).toEqual(ips)
})

test('multi IPv6', () => {
  const ips = ['[2a03:2880:2110:9f07:face:b00c:0:1]:80', '[2a00:1450:4008:801::1011]:443']
  expect(compact2stringMulti6(Buffer.from(string2compact(ips)))).toEqual(ips)
})

test('multi (byte check)', () => {
  const compacts = string2compact(['10.10.10.5:128', '100.56.58.99:28525'])
  expect(compacts).toEqual(Uint8Array.from(Buffer.from('0A0A0A05008064383a636f6d', 'hex')))
})
