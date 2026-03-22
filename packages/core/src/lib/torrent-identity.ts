export type TorrentIdentity = {
  infoHash: string
  infoHashV2?: string
}

/**
 * Whether two torrents refer to the same swarm. Prefer full `infoHashV2` when both
 * sides have it; otherwise compare legacy `infoHash` (SHA-1 or BEP 52 truncated v2).
 */
export function sameTorrentIdentity(a: TorrentIdentity, b: TorrentIdentity): boolean {
  if (a.infoHashV2 && b.infoHashV2) return a.infoHashV2 === b.infoHashV2
  return !!(a.infoHash && b.infoHash && a.infoHash === b.infoHash)
}

/** Match a `parse.decode` result to an existing torrent (magnet / hash / buffer). */
export function parsedTorrentMatchesTorrent(
  parsed: { infoHash?: string; infoHashV2?: string },
  torrent: TorrentIdentity
): boolean {
  if (parsed.infoHashV2 && torrent.infoHashV2) return parsed.infoHashV2 === torrent.infoHashV2
  if (parsed.infoHash && torrent.infoHash) return parsed.infoHash === torrent.infoHash
  return false
}
