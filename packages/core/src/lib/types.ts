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
  _select(
    start: number,
    end: number,
    priority: number,
    notify: (() => void) | null,
    isStreamSelection: boolean
  ): void
  _deselect(start: number, end: number, isStreamSelection?: boolean): void
  critical(start: number, end: number): void
}

export interface FileWire {
  _torrent: TorrentWire
  offset: number
}

/** Torrent interface for File — extends TorrentWire with client, select, deselect */
export interface TorrentForFile extends TorrentWire {
  infoHash: string
  client: { _server?: { pathname: string } }
  select(start: number, end: number, priority?: number): void
  deselect(start: number, end: number): void
}
