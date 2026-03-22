import fs from 'fs'
import http from 'http'
import path, { dirname } from 'path'
import { expect, test } from 'bun:test'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

import { loadIPSet } from '../src/load-ip-set'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function checkList(ipSet: { contains: (ip: string) => boolean }) {
  expect(ipSet.contains('1.2.3.0')).toBe(true)
  expect(ipSet.contains('1.2.3.1')).toBe(true)
  expect(ipSet.contains('1.2.3.254')).toBe(true)
  expect(ipSet.contains('1.2.3.255')).toBe(true)
  expect(ipSet.contains('5.6.7.0')).toBe(true)
  expect(ipSet.contains('5.6.7.128')).toBe(true)
  expect(ipSet.contains('5.6.7.255')).toBe(true)
  expect(ipSet.contains('192.168.1.1')).toBe(true)
  expect(ipSet.contains('192.168.1.230')).toBe(true)
  expect(ipSet.contains('192.168.1.100')).toBe(true)
  expect(ipSet.contains('192.168.1.231')).toBe(false)
  expect(ipSet.contains('192.168.1.240')).toBe(true)
  expect(ipSet.contains('192.168.1.241')).toBe(false)
  expect(ipSet.contains('192.168.2.5')).toBe(true)
  expect(ipSet.contains('192.168.2.6')).toBe(false)
  expect(ipSet.contains('192.168.2.4')).toBe(false)
  expect(ipSet.contains('1.1.1.1')).toBe(false)
  expect(ipSet.contains('2.2.2.2')).toBe(false)
  expect(ipSet.contains('196.168.1.100')).toBe(true)
  expect(ipSet.contains('196.168.2.100')).toBe(false)
  expect(ipSet.contains('194.0.0.0')).toBe(false)
  expect(ipSet.contains('194.0.0.1')).toBe(true)
  expect(ipSet.contains('194.255.255.255')).toBe(true)
  expect(ipSet.contains('194.2.3.4')).toBe(true)
  expect(ipSet.contains('195.168.3.6')).toBe(true)
  expect(ipSet.contains('195.168.5.222')).toBe(true)
  expect(ipSet.contains('195.166.1.1')).toBe(false)
}

test('array of IPs', async () => {
  expect.assertions(5)
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      loadIPSet(['1.2.3.4'], (err, ipSet) => {
        if (err) {
          reject(err)
          return
        }
        expect(ipSet!.contains('1.2.3.4')).toBe(true)
        expect(ipSet!.contains('1.1.1.1')).toBe(false)
        resolve()
      })
    }),
    new Promise<void>((resolve, reject) => {
      loadIPSet(['1.2.3.4', '5.6.7.8'], (err, ipSet) => {
        if (err) {
          reject(err)
          return
        }
        expect(ipSet!.contains('1.2.3.4')).toBe(true)
        expect(ipSet!.contains('5.6.7.8')).toBe(true)
        expect(ipSet!.contains('1.1.1.1')).toBe(false)
        resolve()
      })
    }),
  ])
})

test('array of IP ranges', async () => {
  expect.assertions(27)
  await new Promise<void>((resolve, reject) => {
    loadIPSet(
      [
        { start: '1.2.3.0', end: '1.2.3.255' },
        { start: '5.6.7.0', end: '5.6.7.255' },
        { start: '192.168.1.1', end: '192.168.1.230' },
        { start: '192.168.1.240', end: '192.168.1.240' },
        { start: '192.168.2.5', end: '192.168.2.5' },
        { start: '194.0.0.1', end: '194.255.255.255' },
        { start: '195.168.0.1', end: '195.168.255.255' },
        { start: '196.168.1.1', end: '196.168.1.255' },
      ],
      (err, ipSet) => {
        if (err) {
          reject(err)
          return
        }
        checkList(ipSet!)
        resolve()
      }
    )
  })
})

test('http url', async () => {
  expect.assertions(27)
  const server = http.createServer((req, res) => {
    fs.createReadStream(path.join(__dirname, 'list.txt')).pipe(res)
  })
  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => {
      const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
      loadIPSet(url, (err, ipSet) => {
        if (err) {
          reject(err)
          return
        }
        checkList(ipSet!)
        server.close()
        resolve()
      })
    })
  })
})

test('http url (with custom user agent)', async () => {
  expect.assertions(28)
  const server = http.createServer((req, res) => {
    expect(req.headers['user-agent']).toBe('Z-Torrent (https://github.com/skrylnikov/z-torrent)')
    fs.createReadStream(path.join(__dirname, 'list.txt')).pipe(res)
  })
  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => {
      const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
      loadIPSet(
        url,
        {
          headers: { 'user-agent': 'Z-Torrent (https://github.com/skrylnikov/z-torrent)' },
        },
        (err, ipSet) => {
          if (err) {
            reject(err)
            return
          }
          checkList(ipSet!)
          server.close()
          resolve()
        }
      )
    })
  })
})

test('http url with gzip encoding', async () => {
  expect.assertions(27)
  const server = http.createServer((req, res) => {
    res.setHeader('content-encoding', 'gzip')
    fs.createReadStream(path.join(__dirname, 'list.txt')).pipe(zlib.createGzip()).pipe(res)
  })
  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => {
      const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
      loadIPSet(url, (err, ipSet) => {
        if (err) {
          reject(err)
          return
        }
        checkList(ipSet!)
        server.close()
        resolve()
      })
    })
  })
})

test('http url with deflate encoding', async () => {
  expect.assertions(27)
  const server = http.createServer((req, res) => {
    res.setHeader('content-encoding', 'deflate')
    fs.createReadStream(path.join(__dirname, 'list.txt')).pipe(zlib.createDeflate()).pipe(res)
  })
  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => {
      const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
      loadIPSet(url, (err, ipSet) => {
        if (err) {
          reject(err)
          return
        }
        checkList(ipSet!)
        server.close()
        resolve()
      })
    })
  })
})

test('fs path', async () => {
  expect.assertions(27)
  await new Promise<void>((resolve, reject) => {
    loadIPSet(path.join(__dirname, 'list.txt'), (err, ipSet) => {
      if (err) {
        reject(err)
        return
      }
      checkList(ipSet!)
      resolve()
    })
  })
})

test('fs path with gzip', async () => {
  expect.assertions(27)
  await new Promise<void>((resolve, reject) => {
    loadIPSet(path.join(__dirname, 'list.txt.gz'), (err, ipSet) => {
      if (err) {
        reject(err)
        return
      }
      checkList(ipSet!)
      resolve()
    })
  })
})
