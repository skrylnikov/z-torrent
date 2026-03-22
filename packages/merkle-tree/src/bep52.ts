import { sha256 } from '@noble/hashes/sha256'

/** 16 KiB — BEP 52 leaf block size */
export const BEP52_BLOCK_SIZE = 1 << 14

/** 32 zero bytes — padding leaf per BEP 52 */
export const BEP52_ZERO_LEAF = new Uint8Array(32)

export function sha256Concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const buf = new Uint8Array(64)
  buf.set(left, 0)
  buf.set(right, 32)
  return sha256(buf)
}

export function sha256Data(data: Uint8Array): Uint8Array {
  return sha256(data)
}

/**
 * Merkle root of a complete binary layer (length must be a power of two).
 * Each node is SHA256(left || right).
 */
export function rootHashLayer(hashes: Uint8Array[]): Uint8Array {
  if (hashes.length === 0) {
    throw new Error('rootHashLayer: empty layer')
  }
  if ((hashes.length & (hashes.length - 1)) !== 0) {
    throw new Error('rootHashLayer: layer length must be a power of two')
  }
  let layer = hashes
  while (layer.length > 1) {
    const next: Uint8Array[] = []
    for (let i = 0; i < layer.length; i += 2) {
      next.push(sha256Concat(layer[i]!, layer[i + 1]!))
    }
    layer = next
  }
  return layer[0]!
}

function nextPow2(n: number): number {
  if (n <= 1) return 1
  return 1 << (32 - Math.clz32(n - 1))
}

/** Like Python `int.bit_length()` for non-negative integers. */
function uintBitLength(x: number): number {
  if (x <= 0) return 0
  return 32 - Math.clz32(x)
}

/**
 * Pad block hashes for one piece to the leaf count required by BEP 52.
 */
export function padPieceBlockHashes(
  blockHashes: Uint8Array[],
  blocksPerPiece: number,
  isFirstPiece: boolean
): Uint8Array[] {
  const n = blockHashes.length
  if (n === 0) return []
  const leavesRequired = isFirstPiece ? 1 << uintBitLength(n - 1) : blocksPerPiece
  const out = blockHashes.slice()
  while (out.length < leavesRequired) {
    out.push(BEP52_ZERO_LEAF.slice())
  }
  return out
}

/** Root of a “virtual” piece made entirely of zero leaves (BEP 52 file-tree balancing). */
export function padPieceRoot(blocksPerPiece: number): Uint8Array {
  const zeros: Uint8Array[] = []
  for (let i = 0; i < blocksPerPiece; i++) {
    zeros.push(BEP52_ZERO_LEAF.slice())
  }
  return rootHashLayer(zeros)
}

export interface FileV2MerkleResult {
  /** Total file length in bytes */
  length: number
  /** Merkle root over piece-level hashes (`pieces root` in file tree) */
  piecesRoot?: Uint8Array
  /**
   * Concatenated 32-byte piece subtree roots for `piece layers` dict value.
   * Omitted when file fits in one piece (no `piece layers` entry per BEP 52).
   */
  pieceLayerConcat?: Uint8Array
  /** Per-piece subtree roots (each is root of that piece’s block merkle tree) */
  pieceSubtreeRoots: Uint8Array[]
}

/**
 * Build BEP 52 per-file merkle metadata from raw file bytes.
 * Mirrors `FileHasher` in the reference `bep_0052_torrent_creator.py`.
 */
export function buildFileV2Merkle(fileData: Uint8Array, pieceLength: number): FileV2MerkleResult {
  if (pieceLength < BEP52_BLOCK_SIZE || (pieceLength & (pieceLength - 1)) !== 0) {
    throw new Error('pieceLength must be a power of two and >= 16 KiB')
  }

  const blocksPerPiece = pieceLength / BEP52_BLOCK_SIZE
  const pieceSubtreeRoots: Uint8Array[] = []
  let offset = 0
  const len = fileData.length

  while (offset < len) {
    const blockHashes: Uint8Array[] = []
    for (let i = 0; i < blocksPerPiece && offset < len; i++) {
      const end = Math.min(offset + BEP52_BLOCK_SIZE, len)
      const block = fileData.subarray(offset, end)
      if (block.length === 0) break
      offset = end
      blockHashes.push(sha256Data(block))
    }

    if (blockHashes.length === 0) break

    const padded = padPieceBlockHashes(blockHashes, blocksPerPiece, pieceSubtreeRoots.length === 0)
    pieceSubtreeRoots.push(rootHashLayer(padded))
  }

  const length = len
  if (length === 0) {
    return { length: 0, pieceSubtreeRoots: [] }
  }

  const layerHashes = pieceSubtreeRoots.slice()
  let pieceLayerConcat: Uint8Array | undefined
  if (pieceSubtreeRoots.length > 1) {
    const flat = new Uint8Array(pieceSubtreeRoots.length * 32)
    let p = 0
    for (const h of pieceSubtreeRoots) {
      flat.set(h, p)
      p += 32
    }
    pieceLayerConcat = flat
  }

  const padPiece = padPieceRoot(blocksPerPiece)
  const targetPieces = nextPow2(layerHashes.length)
  while (layerHashes.length < targetPieces) {
    layerHashes.push(padPiece.slice())
  }

  const piecesRoot = rootHashLayer(layerHashes)

  const out: FileV2MerkleResult = {
    length,
    piecesRoot,
    pieceSubtreeRoots,
  }
  if (length > pieceLength && pieceLayerConcat) {
    out.pieceLayerConcat = pieceLayerConcat
  }
  return out
}

/**
 * Build all layers from leaf hashes (padded to power of two with zero leaves).
 */
export function buildMerkleLayers(leaves: Uint8Array[]): Uint8Array[][] {
  if (leaves.length === 0) {
    throw new Error('buildMerkleLayers: no leaves')
  }
  const n = nextPow2(leaves.length)
  const padded: Uint8Array[] = leaves.slice()
  while (padded.length < n) {
    padded.push(BEP52_ZERO_LEAF.slice())
  }
  const layers: Uint8Array[][] = [padded]
  let layer = padded
  while (layer.length > 1) {
    const next: Uint8Array[] = []
    for (let i = 0; i < layer.length; i += 2) {
      next.push(sha256Concat(layer[i]!, layer[i + 1]!))
    }
    layers.push(next)
    layer = next
  }
  return layers
}

/**
 * Uncle hashes for one leaf index, from leaf layer up `proofLayers` steps.
 * Returns uncles from bottom to top (closest to root last).
 */
export function unclesForLeafIndex(layers: Uint8Array[][], leafIndex: number, proofLayers: number): Uint8Array[] {
  const uncles: Uint8Array[] = []
  let idx = leafIndex
  for (let depth = 0; depth < proofLayers && depth < layers.length - 1; depth++) {
    const row = layers[depth]!
    const sibling = idx ^ 1
    if (sibling >= row.length) break
    uncles.push(row[sibling]!.slice())
    idx >>= 1
  }
  return uncles
}

/**
 * Verify that `leafHash` at `leafIndex` (in padded leaf layer) reaches `expectedRoot`
 * using `uncles` (sibling hashes bottom-up).
 */
/**
 * Merkle subtree root for one logical piece’s raw bytes (BEP 52).
 * `isFirstPieceOfFile` matches reference `FileHasher` padding (first piece of each file).
 */
export function pieceSubtreeRootFromBytes(
  pieceBytes: Uint8Array,
  pieceLength: number,
  isFirstPieceOfFile: boolean
): Uint8Array {
  const blocksPerPiece = pieceLength / BEP52_BLOCK_SIZE
  const blockHashes: Uint8Array[] = []
  let offset = 0
  while (offset < pieceBytes.length) {
    const end = Math.min(offset + BEP52_BLOCK_SIZE, pieceBytes.length)
    blockHashes.push(sha256Data(pieceBytes.subarray(offset, end)))
    offset = end
  }
  if (blockHashes.length === 0) {
    return rootHashLayer([BEP52_ZERO_LEAF.slice()])
  }
  const padded = padPieceBlockHashes(blockHashes, blocksPerPiece, isFirstPieceOfFile)
  return rootHashLayer(padded)
}

export function verifyLeafToRoot(
  leafHash: Uint8Array,
  leafIndex: number,
  uncles: Uint8Array[],
  expectedRoot: Uint8Array
): boolean {
  let idx = leafIndex
  let acc: Uint8Array = leafHash.slice()
  for (const uncle of uncles) {
    const left = (idx & 1) === 0 ? acc : uncle
    const right = (idx & 1) === 0 ? uncle : acc
    acc = sha256Concat(left, right)
    idx >>= 1
  }
  if (acc.length !== expectedRoot.length) return false
  for (let i = 0; i < acc.length; i++) {
    if (acc[i] !== expectedRoot[i]) return false
  }
  return true
}
