/*! create-torrent BEP 52 helpers. MIT License. */
import { buildFileV2Merkle, BEP52_BLOCK_SIZE } from '@z-torrent/merkle-tree'
import { arr2hex } from 'uint8-util'

export { BEP52_BLOCK_SIZE }

export function alignUpByteOffset(offset: number, align: number): number {
  if (align <= 0) return offset
  const m = offset % align
  return m === 0 ? offset : offset + (align - m)
}

/** Next power of two >= n (for piece length). */
export function toBep52PieceLength(requested: number): number {
  if (requested < BEP52_BLOCK_SIZE) return BEP52_BLOCK_SIZE
  let p = BEP52_BLOCK_SIZE
  while (p < requested) p <<= 1
  return p
}

export function mergePathIntoFileTree(
  root: Record<string, unknown>,
  path: string[],
  leafMeta: Record<string, unknown>
): void {
  let cur = root
  for (let i = 0; i < path.length; i++) {
    const seg = path[i]!
    if (i === path.length - 1) {
      cur[seg] = { '': leafMeta }
    } else {
      if (!cur[seg]) cur[seg] = {}
      cur = cur[seg] as Record<string, unknown>
    }
  }
}

export interface HybridV1Layout {
  v1Buffer: Uint8Array
  infoFiles: Array<{ length: number; path: string[]; attr?: string }>
}

export function buildHybridV1Layout(
  files: Array<{ path?: string[] }>,
  buffers: Uint8Array[],
  pieceLength: number
): HybridV1Layout {
  const infoFiles: HybridV1Layout['infoFiles'] = []
  const parts: Uint8Array[] = []
  let cursor = 0
  for (let i = 0; i < files.length; i++) {
    const d = buffers[i]!
    const path = files[i]!.path
    if (!path?.length) {
      throw new Error('hybrid torrent requires each file to have a path')
    }
    infoFiles.push({ length: d.length, path })
    parts.push(d)
    cursor += d.length
    if (i < files.length - 1) {
      const padLen = alignUpByteOffset(cursor, pieceLength) - cursor
      if (padLen > 0) {
        parts.push(new Uint8Array(padLen))
        infoFiles.push({ length: padLen, path: ['.pad', String(padLen)], attr: 'p' })
        cursor += padLen
      }
    }
  }
  const total = parts.reduce((s, p) => s + p.length, 0)
  const v1Buffer = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    v1Buffer.set(p, o)
    o += p.length
  }
  return { v1Buffer, infoFiles }
}

/** Per-file merkle; merge into `fileTree` / `pieceLayers`. */
export function addFileToV2Torrent(
  fileTree: Record<string, unknown>,
  pieceLayers: Record<string, Uint8Array>,
  path: string[],
  data: Uint8Array,
  pieceLength: number
): void {
  const merkle = buildFileV2Merkle(data, pieceLength)
  const leaf: Record<string, unknown> = { length: data.length }
  if (data.length > 0 && merkle.piecesRoot) {
    leaf['pieces root'] = new Uint8Array(merkle.piecesRoot)
  }
  mergePathIntoFileTree(fileTree, path, leaf)
  if (merkle.pieceLayerConcat && merkle.piecesRoot) {
    pieceLayers[arr2hex(merkle.piecesRoot)] = merkle.pieceLayerConcat
  }
}
