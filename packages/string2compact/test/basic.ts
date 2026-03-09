import test from 'tape'
import compact2string from 'compact2string'
import string2compact from '../src/index.js'

test('single', (t) => {
  const compact = string2compact('10.10.10.5:65408')
  t.deepEqual(compact, Uint8Array.from(Buffer.from('0A0A0A05FF80', 'hex')))
  t.end()
})

test('single IPv6', (t) => {
  const compact = string2compact('[2a03:2880:2110:9f07:face:b00c::1]:80')
  t.deepEqual(compact, Uint8Array.from(Buffer.from('2a03288021109f07faceb00c000000010050', 'hex')))
  t.end()
})

test('multi', (t) => {
  const ips = ['127.0.0.1:6881', '127.0.0.1:6882']
  t.deepEqual(compact2string.multi(Buffer.from(string2compact(ips))), ips)
  t.end()
})

test('multi IPv6', (t) => {
  const ips = ['[2a03:2880:2110:9f07:face:b00c::1]:80', '[2a00:1450:4008:801::1011]:443']
  t.deepEqual(compact2string.multi6(Buffer.from(string2compact(ips))), ips)
  t.end()
})

test('multi (byte check)', (t) => {
  const compacts = string2compact(['10.10.10.5:128', '100.56.58.99:28525'])
  t.deepEqual(compacts, Uint8Array.from(Buffer.from('0A0A0A05008064383a636f6d', 'hex')))
  t.end()
})
