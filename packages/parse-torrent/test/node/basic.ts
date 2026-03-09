import fixtures from '../fixtures/index.ts'
import http from 'http'
import parseTorrent, { remote } from '../../dist/index.js'
import test from 'tape'

const leavesParsed = await parseTorrent(fixtures.leaves.torrent)
leavesParsed.infoHashBuffer = new Uint8Array(leavesParsed.infoHashBuffer)

test('http url to a torrent file, string', (t) => {
  t.plan(3)

  const server = http.createServer((req, res) => {
    t.pass('server got request')
    res.end(fixtures.leaves.torrent)
  })

  server.listen(0, () => {
    const port = (server.address() as { port: number }).port
    const url = `http://127.0.0.1:${port}`
    remote(url, (err, parsedTorrent) => {
      t.error(err)
      t.deepEqual(parsedTorrent, leavesParsed)
      server.close()
    })
  })
})

test('filesystem path to a torrent file, string', (t) => {
  t.plan(2)

  remote(fixtures.leaves.torrentPath, (err, parsedTorrent) => {
    t.error(err)
    t.deepEqual(parsedTorrent, leavesParsed)
  })
})
