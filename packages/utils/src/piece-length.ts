/**
 * Calculate the optimal piece length for a torrent given the total byte size.
 *
 * The algorithm picks a power-of-two piece length such that the number of
 * pieces stays roughly around 1000-1500, with a minimum of 16 KiB (16384).
 *
 * @param bytes - Total file/torrent size in bytes
 * @returns Optimal piece length in bytes (power of 2, >= 16384)
 */
export function calcPieceLength(bytes: number): number {
  return Math.max(16384, 1 << ((Math.log2(bytes < 1024 ? 1 : bytes / 1024) + 0.5) | 0))
}
