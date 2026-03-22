import SimplePeerLite from '@thaunknown/simple-peer/lite.js'
import type { ServerOptions, ZTorrentCoreOpts } from '@z-torrent/core'
import { ZTorrentCore, FileIterator, VERSION } from '@z-torrent/core'
import { createBrowserPlatformAdapter } from './platform.js'
import type { BrowserServerOptions } from './lib/server.js'

export { FileIterator, Torrent, Peer, RarityMap, WebConn, ServerBase, File } from '@z-torrent/core'

export type ZTorrentBrowserOpts = Omit<ZTorrentCoreOpts, 'platform'>

export class ZTorrent extends ZTorrentCore {
  static WEBRTC_SUPPORT = SimplePeerLite.WEBRTC_SUPPORT
  static UTP_SUPPORT = false
  static VERSION = VERSION

  constructor(opts: ZTorrentBrowserOpts = {}) {
    const platform = createBrowserPlatformAdapter()
    super({
      ...opts,
      platform,
    })
  }

  override createServer(options: BrowserServerOptions): unknown {
    return super.createServer(options as ServerOptions)
  }
}
