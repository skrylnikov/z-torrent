/**
 * z-torrent-core — platform-agnostic interfaces and shared logic.
 * Platform adapters (browser, node, bun) implement these interfaces.
 */

export * from './interfaces.js'
export * from './selections.js'
export { default as WebTorrentCore } from './client.js'
export { default as Torrent } from './lib/torrent.js'
export { default as File } from './lib/file.js'
export { default as FileIterator } from './lib/file-iterator.js'
export { default as Peer } from './lib/peer.js'
export { default as RarityMap } from './lib/rarity-map.js'
export { default as WebConn } from './lib/webconn.js'
export { ServerBase } from './lib/server-base.js'
export type { TorrentOpts, ParsedTorrent, WebTorrentClient } from './lib/torrent.js'
export type { FileMetadata } from './lib/file.js'
export type { ThrottleGroups, PeerSwarm } from './lib/peer.js'
export type { Request, Response, ServerOptions, ClientWithTorrents, TorrentWithFiles } from './lib/server-base.js'
