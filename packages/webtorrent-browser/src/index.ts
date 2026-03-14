/*! z-torrent-browser. MIT License. */

import { Buffer } from 'buffer'
;(globalThis as any).Buffer = Buffer

import Peer from '@thaunknown/simple-peer/lite.js'
import { WebTorrentCore } from '../../z-torrent-core/src/index.js'
import { createBrowserPlatformAdapter } from './platform.js'

export { FileIterator } from '../../z-torrent-core/src/index.js'

export default class WebTorrent extends WebTorrentCore {
  constructor(opts: Record<string, unknown> = {}) {
    const platform = createBrowserPlatformAdapter()
    super({
      ...opts,
      platform,
    })
  }
}

WebTorrent.WEBRTC_SUPPORT = Peer.WEBRTC_SUPPORT
WebTorrent.UTP_SUPPORT = false
WebTorrent.VERSION = '2.8.5'
