import type { V2FileLayoutEntry } from '@z-torrent/parse'
import { BEP52_BLOCK_SIZE, padPieceRoot } from '@z-torrent/merkle-tree'
import { hex2arr } from 'uint8-util'

export function alignUpByteOffset(offset: number, align: number): number {
  if (align <= 0) return offset
  const m = offset % align
  return m === 0 ? offset : offset + (align - m)
}

export function v2TotalPieceSpaceBytes(layout: V2FileLayoutEntry[], pieceLength: number): number {
  if (layout.length === 0) return 0
  let end = 0
  for (const f of layout) {
    const tail = f.byteOffset + f.length
    end = alignUpByteOffset(tail, pieceLength)
  }
  return end
}

export function v2NumPieces(layout: V2FileLayoutEntry[], pieceLength: number): number {
  const bytes = v2TotalPieceSpaceBytes(layout, pieceLength)
  return Math.floor(bytes / pieceLength)
}

function lookupFilePieceRoot(
  f: V2FileLayoutEntry,
  pieceInFile: number,
  pieceLength: number,
  layersByRootHex: Record<string, Uint8Array[]>
): Uint8Array {
  const nfp = Math.max(1, Math.ceil(f.length / pieceLength))
  const hex = f.piecesRootHex
  if (!hex) {
    throw new Error('BitTorrent v2 file entry missing pieces root')
  }
  const layers = layersByRootHex[hex]
  if (layers && layers[pieceInFile]) {
    return layers[pieceInFile]!.slice()
  }
  if (nfp === 1 && pieceInFile === 0) {
    return hex2arr(hex)
  }
  throw new Error(`Missing piece layer for pieces root ${hex.slice(0, 8)}… index ${pieceInFile}`)
}

/**
 * Expected 32-byte merkle subtree root for each global piece index (v2-only layout).
 */
export function buildV2ExpectedPieceRoots(
  layout: V2FileLayoutEntry[],
  pieceLength: number,
  layersByRootHex: Record<string, Uint8Array[]>
): Uint8Array[] {
  const n = v2NumPieces(layout, pieceLength)
  /** BEP 52: inter-file padding uses zero *leaves* (32 zero bytes), not SHA-256 of zero blocks */
  const blocksPerPiece = pieceLength / BEP52_BLOCK_SIZE
  const paddingPieceRoot = padPieceRoot(blocksPerPiece)
  const roots: Uint8Array[] = []

  for (let g = 0; g < n; g++) {
    const b0 = g * pieceLength
    let assigned = false
    for (let fi = 0; fi < layout.length; fi++) {
      const f = layout[fi]!
      const fStart = f.byteOffset
      const fEndContent = f.byteOffset + f.length
      const fEndAligned = alignUpByteOffset(fEndContent, pieceLength)

      if (b0 < fStart) {
        roots.push(paddingPieceRoot.slice())
        assigned = true
        break
      }
      if (b0 >= fStart && b0 < fEndContent) {
        const pieceInFile = ((b0 - fStart) / pieceLength) | 0
        roots.push(lookupFilePieceRoot(f, pieceInFile, pieceLength, layersByRootHex))
        assigned = true
        break
      }
      if (b0 >= fEndContent && b0 < fEndAligned) {
        roots.push(paddingPieceRoot.slice())
        assigned = true
        break
      }
    }
    if (!assigned) {
      roots.push(paddingPieceRoot.slice())
    }
  }

  return roots
}

/**
 * Whether global piece `index` is the first piece of some file’s payload (BEP 52 leaf padding).
 */
export function v2IsFirstPieceOfFile(
  layout: V2FileLayoutEntry[],
  pieceLength: number,
  index: number
): boolean {
  const b0 = index * pieceLength
  for (const f of layout) {
    if (f.length === 0) continue
    if (b0 >= f.byteOffset && b0 < f.byteOffset + f.length) {
      return b0 === f.byteOffset
    }
  }
  return false
}
