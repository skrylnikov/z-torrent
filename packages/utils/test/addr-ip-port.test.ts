import { expect, test } from 'bun:test'

import { addrToIPPort } from '../src/addr-ip-port'

test('Basic tests', () => {
  expect(addrToIPPort('1.2.3.4:1000')).toEqual(['1.2.3.4', 1000])
  expect(addrToIPPort('2.3.4.5:1000')).toEqual(['2.3.4.5', 1000])
  expect(addrToIPPort('[2a00:1450:4008:801::1011]:80')).toEqual(['2a00:1450:4008:801::1011', 80])
  expect(addrToIPPort('webtorrent.io:80')).toEqual(['webtorrent.io', 80])

  const data1 = addrToIPPort('1.2.3.4:2000')
  const data2 = addrToIPPort('1.2.3.4:2000')
  expect(data1).toEqual(['1.2.3.4', 2000])
  expect(data1).toBe(data2)
})
