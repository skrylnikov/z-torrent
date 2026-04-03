/** v1 (40 hex) or BEP 52 v2 (64 hex) info hash */
const INFO_HASH_REGEX = /^[a-f0-9]{40}([a-f0-9]{24})?$/i

export interface ParsedRoute {
  hash: string | null
  subpath: string
}

export function parseRoute(pathname: string): ParsedRoute {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return { hash: null, subpath: '' }

  const first = segments[0]
  if (INFO_HASH_REGEX.test(first)) {
    return {
      hash: first.toLowerCase(),
      subpath: segments.slice(1).join('/'),
    }
  }

  return { hash: null, subpath: '' }
}

export function extractHash(input: string): string | null {
  const trimmed = input.trim()
  if (INFO_HASH_REGEX.test(trimmed)) return trimmed.toLowerCase()

  const magnetMatch = trimmed.match(/btih:([a-f0-9]{40}|[a-f0-9]{64})/i)
  if (magnetMatch) return magnetMatch[1].toLowerCase()

  const urlMatch = trimmed.match(/z-torrent\.xyz\/([a-f0-9]{40}|[a-f0-9]{64})/i)
  if (urlMatch) return urlMatch[1].toLowerCase()

  return null
}

export function buildPortalUrl(hash: string, subpath = ''): string {
  const base = `/${hash}`
  return subpath ? `${base}/${subpath}` : base
}

export function syncIframeUrl(iframe: HTMLIFrameElement, infoHash: string): void {
  try {
    const iframePath = iframe.contentWindow?.location.pathname ?? ''
    const prefix = `/z-torrent/${infoHash}/`
    const subpath = iframePath.startsWith(prefix) ? iframePath.slice(prefix.length) : ''
    if (subpath) {
      history.replaceState(null, '', buildPortalUrl(infoHash, subpath))
    }
  } catch {
    // cross-origin — ignore
  }
}
