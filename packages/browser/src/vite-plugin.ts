import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

const swPath = join(dirname(fileURLToPath(import.meta.url)), 'sw.min.js')

export interface ZTorrentSWOptions {
  /** Output filename at site root (default: `sw.min.js`) */
  fileName?: string
}

/**
 * Vite plugin: serves and emits the Z-Torrent service worker at `/{fileName}`.
 * Use with `navigator.serviceWorker.register('/sw.min.js', { scope: '/' })`.
 */
export function zTorrentSW(options: ZTorrentSWOptions = {}): Plugin[] {
  const fileName = options.fileName ?? 'sw.min.js'
  return [
    {
      name: 'z-torrent-sw:serve',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const pathOnly = req.url?.split('?')[0] ?? ''
          if (pathOnly === `/${fileName}`) {
            res.setHeader('Content-Type', 'application/javascript')
            res.setHeader('Service-Worker-Allowed', '/')
            res.end(readFileSync(swPath, 'utf-8'))
            return
          }
          next()
        })
      },
    },
    {
      name: 'z-torrent-sw:build',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName,
          source: readFileSync(swPath, 'utf-8'),
        })
      },
    },
  ]
}
