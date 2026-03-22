# @z-torrent/merkle-tree

[BEP 52](http://www.bittorrent.org/beps/bep_0052.html) BitTorrent v2 **merkle hash trees** (SHA-256, 16 KiB leaf blocks). Used by [@z-torrent/create](https://www.npmjs.com/package/@z-torrent/create) and [@z-torrent/core](https://www.npmjs.com/package/@z-torrent/core) for v2 / hybrid torrents.

**Node.js 18+** (uses `node:crypto`).

## Install

```bash
npm install @z-torrent/merkle-tree
```

## API overview

### Constants

- **`BEP52_BLOCK_SIZE`** — leaf block size (16 KiB).
- **`BEP52_ZERO_LEAF`** — 32 zero bytes; padding leaf per BEP 52.

### Hash helpers

- **`sha256Data(data)`** — SHA-256 of raw bytes.
- **`sha256Concat(left, right)`** — SHA-256 of `left || right` (64-byte node input).

### Layers and roots

- **`rootHashLayer(hashes)`** — Merkle root of a complete binary layer (length must be a power of two). Each parent is `SHA256(left || right)`.
- **`buildMerkleLayers(leaves)`** — Build all tree layers from leaf hashes (padded to the next power of two with zero leaves).
- **`padPieceBlockHashes(blockHashes, blocksPerPiece, isFirstPiece)`** — Pad per-piece block hashes to the leaf count required by BEP 52.
- **`padPieceRoot(blocksPerPiece)`** — Root of a virtual “all zero leaf” piece (file-tree balancing).

### File hashing (torrent creator)

- **`buildFileV2Merkle(fileData, pieceLength)`** — Compute v2 per-file metadata: `piecesRoot`, optional `pieceLayerConcat`, and `pieceSubtreeRoots`. `pieceLength` must be a power of two and ≥ 16 KiB.

### Proofs and verification

- **`unclesForLeafIndex(layers, leafIndex, proofLayers)`** — Uncle (sibling) hashes for a leaf, bottom-up.
- **`verifyLeafToRoot(leafHash, leafIndex, uncles, expectedRoot)`** — Check a Merkle path.
- **`pieceSubtreeRootFromBytes(pieceBytes, pieceLength, isFirstPieceOfFile)`** — Subtree root for one logical piece’s raw bytes (matches reference BEP 52 padding for the first piece of a file).

### Types

- **`FileV2MerkleResult`** — `{ length, piecesRoot?, pieceLayerConcat?, pieceSubtreeRoots }`.

## Example

```js
import { buildFileV2Merkle, BEP52_BLOCK_SIZE } from '@z-torrent/merkle-tree'

const data = new TextEncoder().encode('hello')
const pieceLength = 32 * 1024 // ≥ BEP52_BLOCK_SIZE, power of two
const { piecesRoot, pieceSubtreeRoots } = buildFileV2Merkle(data, pieceLength)
```

## License

MIT. See [LICENSE](LICENSE).
