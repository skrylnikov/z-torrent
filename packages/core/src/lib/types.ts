/**
 * Wire interfaces to break circular dependencies between Torrent, File, FileIterator, RarityMap.
 */

import type BitField from 'bitfield'
import type Wire from '@z-torrent/protocol'

export interface TorrentWire {
  pieces: unknown[]
  pieceLength: number
  lastPieceLength: number
  length: number
  bitfield: BitField | null
  store: {
    get: (index: number, opts: unknown, cb: (err: Error | null, chunk?: Uint8Array) => void) => void
  } | null
  destroyed: boolean
  wires: Wire[]
  on(event: string, fn: (...args: unknown[]) => void): void
  removeListener(event: string, fn: (...args: unknown[]) => void): void
  emit(event: string, ...args: unknown[]): boolean
  selectStreamPieces(start: number, end: number): void
  deselectStreamPieces(start: number, end: number): void
  critical(start: number, end: number): void
}

export interface FileWire {
  _torrent: TorrentWire
  offset: number
}

/** Torrent interface for File — extends TorrentWire with client, select, deselect */
export interface TorrentForFile extends TorrentWire {
  infoHash: string
  client: { httpServer?: { pathname: string } | null; peerId: string; dht?: unknown }
  select(start: number, end: number, priority?: number): void
  deselect(start: number, end: number): void
}
