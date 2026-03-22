/** Extensions whose MIME types are often missing from mime/lite (e.g. video/x-*). */
const STREAMING_MIME_BY_EXT: Record<string, string> = {
  mkv: 'video/x-matroska',
  mka: 'audio/x-matroska',
}

function fileExtension(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, '')
  const i = base.lastIndexOf('.')
  if (i <= 0 || i === base.length - 1) return ''
  return base.slice(i + 1).toLowerCase()
}

/** MIME from the streaming map only (basename or path). */
export function streamingMimeFromFileName(fileName: string): string | undefined {
  const ext = fileExtension(fileName)
  return ext ? STREAMING_MIME_BY_EXT[ext] : undefined
}

/**
 * Prefer a non-generic type from mime/lite; fall back to the streaming map, then octet-stream.
 */
export function resolveTorrentFileMime(fileName: string, mimeLiteType: string | null): string {
  if (mimeLiteType && mimeLiteType !== 'application/octet-stream') {
    return mimeLiteType
  }
  return streamingMimeFromFileName(fileName) ?? mimeLiteType ?? 'application/octet-stream'
}

function getContentType(headers: Record<string, string>): string | undefined {
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'content-type') return v
  }
  return undefined
}

function setContentType(headers: Record<string, string>, value: string): void {
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === 'content-type') {
      delete headers[k]
    }
  }
  headers['Content-Type'] = value
}

/**
 * If Content-Type is missing, empty, or application/octet-stream, set it from the URL path
 * (last segment extension). For use in the service worker before `new Response`.
 */
export function normalizeSwResponseContentType(
  requestUrl: string,
  headers: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = { ...headers }
  const current = getContentType(next)
  const needsFix =
    current === undefined ||
    current.trim() === '' ||
    current.toLowerCase() === 'application/octet-stream'

  if (!needsFix) return next

  let pathname: string
  try {
    pathname = new URL(requestUrl).pathname
  } catch {
    return next
  }

  const lastSeg = pathname.split('/').pop() ?? ''
  let decoded = lastSeg
  try {
    decoded = decodeURIComponent(lastSeg)
  } catch {
    // keep lastSeg
  }

  const mime = streamingMimeFromFileName(decoded)
  if (mime) setContentType(next, mime)
  return next
}
