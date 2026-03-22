/** Options passed to `Torrent.destroy` / `detachTorrent` / `remove`. */
export interface TorrentDestroyOpts {
  destroyStore?: boolean
}

/**
 * Subset of BEP announce params returned by `getAnnounceOpts` (matches
 * @z-torrent/tracker `AnnounceOptions`).
 */
export interface TrackerAnnounceOpts {
  uploaded?: number
  downloaded?: number
  left?: number | string
  numwant?: number
  event?: string
}

/**
 * Agents / proxy for HTTP(S) tracker requests (Node).
 * Shapes match @z-torrent/tracker `TrackerProxyOpts` without `unknown`.
 */
export interface TrackerProxyOpts {
  httpsAgent?: object
  httpAgent?: object
  socksProxy?: object
}

/**
 * Global tracker client options merged into each swarm’s tracker `Client`
 * (see @z-torrent/tracker `Client` constructor). `peerId`, `port`, `infoHash`,
 * and per-torrent `announce` are supplied by the core/torrent layer.
 */
export interface TrackerOpts {
  /** Extra announce URLs for every torrent (unless private). */
  announce?: string | string[]
  /** Default announce fields merged before per-torrent values. */
  getAnnounceOpts?: () => TrackerAnnounceOpts
  rtcConfig?: RTCConfiguration
  userAgent?: string
  /** WebRTC implementation for ws/wss trackers (or a factory). */
  wrtc?: object | (() => object)
  proxyOpts?: TrackerProxyOpts
}
