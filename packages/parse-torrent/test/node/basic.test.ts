import fixtures from '../fixtures/index.ts'
import http from 'http'
import parseTorrent, { remote } from '../../dist/index.js'
import { expect, test } from 'bun:test'

const leavesParsed = await parseTorrent(fixtures.leaves.torrent)
leavesParsed.infoHashBuffer = new Uint8Array(leavesParsed.infoHashBuffer)

test('http url to a torrent file, string', () => {
  return new Promise<void>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.end(fixtures.leaves.torrent)
    })

    server.listen(0, () => {
      const port = (server.address() as { port: number }).port
      const url = `http://127.0.0.1:${port}`
      remote(url, (err, parsedTorrent) => {
        try {
          expect(err).toBeFalsy()
          expect(parsedTorrent).toEqual(leavesParsed)
          server.close()
          resolve()
        } catch (e) {
          server.close()
          reject(e)
        }
      })
    })
  })
})

test('filesystem path to a torrent file, string', () => {
  return new Promise<void>((resolve, reject) => {
    remote(fixtures.leaves.torrentPath, (err, parsedTorrent) => {
      try {
        expect(err).toBeFalsy()
        expect(parsedTorrent).toEqual(leavesParsed)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  })
})
