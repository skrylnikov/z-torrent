import type { ZTManifest } from '@z-torrent/core'

export interface PublishConfig {
  site: ZTManifest['site']
  type: ZTManifest['type']
  routing?: ZTManifest['routing']
  priority?: ZTManifest['priority']
  framework?: ZTManifest['framework']
  buildTool?: ZTManifest['buildTool']
  publish: {
    dir: string
    server?: string
    apiKey?: string
    webSeed?: string
    trackers?: string[][]
    pieceLength?: number
  }
}

export interface PublishResult {
  infoHash: string
  torrentPath: string
  manifest: ZTManifest
  totalSize: number
  fileCount: number
}

export type PublishProgress =
  | { phase: 'scanning' }
  | { phase: 'manifest'; message: string }
  | { phase: 'hashing'; bytesDone: number; bytesTotal: number }
  | { phase: 'writing'; path: string }
  | { phase: 'uploading'; message: string }
  | { phase: 'done'; result: PublishResult }

export interface PublishOptions {
  dir?: string
  config?: string
  output?: string
  server?: string
  apiKey?: string
  webSeed?: string
  trackers?: string[][]
  pieceLength?: number
  dryRun?: boolean
  verbose?: boolean
  onProgress?: (progress: PublishProgress) => void
}

const CONFIG_FILENAMES = [
  'z-torrent.config.json',
  'z-torrent.config.ts',
  'z-torrent.config.js',
  'z-torrent.config.mjs',
]
export { CONFIG_FILENAMES }
