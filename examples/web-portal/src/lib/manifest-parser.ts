import type { ZTManifest } from './manifest.js'

interface TorrentFile {
  name: string
  path: string
  length: number
  done: boolean
  select(priority?: number): void
  blob(): Promise<Blob>
}

interface TorrentLike {
  files: TorrentFile[]
}

export async function parseManifest(torrent: TorrentLike): Promise<ZTManifest | null> {
  const manifestFile = torrent.files.find((f) => f.name === 'zt-manifest.json')
  if (!manifestFile) return null

  try {
    const blob = await manifestFile.blob()
    const text = await blob.text()
    const data = JSON.parse(text) as ZTManifest
    if (data.version !== 1 || !data.site?.name) return null
    return data
  } catch {
    return null
  }
}
