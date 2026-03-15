import createTorrent from '@z-torrent/create'

export function createTorrentPromise(
  input: Parameters<typeof createTorrent>[0],
  options?: Record<string, unknown>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const callback = (err: Error | null, torrent: Buffer) => {
      if (err) reject(err)
      else resolve(torrent)
    }
    if (options === undefined) {
      createTorrent(input, callback)
    } else {
      createTorrent(input, options, callback)
    }
  })
}
