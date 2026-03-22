import http from 'node:http'

import { parse } from '@z-torrent/parse'
import { expect, test } from 'bun:test'

import { torrentFixtures } from '../fixtures/index.ts'

const leavesParsed = await parse.decode(torrentFixtures.leaves.torrent)
if (leavesParsed.infoHashBuffer) {
  leavesParsed.infoHashBuffer = new Uint8Array(leavesParsed.infoHashBuffer)
}

test('http url to a torrent file, string', () => {
  return new Promise<void>((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.end(torrentFixtures.leaves.torrent)
    })

    server.listen(0, () => {
      const port = (server.address() as { port: number }).port
      const url = `http://127.0.0.1:${port}`
      parse.remote(url, (err, parsedTorrent) => {
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
    parse.remote(torrentFixtures.leaves.torrentPath, (err, parsedTorrent) => {
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
