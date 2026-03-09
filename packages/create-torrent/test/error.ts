import test from 'tape'
import createTorrent from 'create-torrent'

test('error handling', (t) => {
  t.plan(5)

  t.throws(() => createTorrent(null as never, () => {}))
  t.throws(() => createTorrent(undefined as never, () => {}))
  t.throws(() => createTorrent([null] as never, () => {}))
  t.throws(() => createTorrent([undefined] as never, () => {}))
  t.throws(() => createTorrent([null, undefined] as never, () => {}))
})
