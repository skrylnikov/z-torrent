const NAMESPACE = 'z-torrent'

export interface AddTorrentOptions {
  timeout?: number
  onProgress?: (p: TorrentProgress) => void
}

export interface TorrentProgress {
  phase: 'connecting' | 'metadata' | 'downloading' | 'ready'
  progress: number
  downloadSpeed: number
  peers: number
  downloaded: number
  totalSize: number
}

export interface AddTorrentResult {
  infoHash: string
  files: Record<string, string>
}

interface PendingRequest {
  resolve: (result: AddTorrentResult) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
  onProgress: ((p: TorrentProgress) => void) | undefined
  progressInterval: ReturnType<typeof setInterval> | undefined
}

type MessagePayload = {
  type: string
  id: string
  magnetURI?: string
  infoHash?: string
  files?: Record<string, string>
  error?: string
  phase?: string
  progress?: number
  downloadSpeed?: number
  peers?: number
  downloaded?: number
  totalSize?: number
}

function isPayload(data: unknown): data is MessagePayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as MessagePayload).type === 'string' &&
    typeof (data as MessagePayload).id === 'string' &&
    (data as MessagePayload).type.startsWith(NAMESPACE + ':')
  )
}

export class ZTorrentHost {
  private _parent: WindowProxy | null
  private _pending = new Map<string, PendingRequest>()
  private _onMessage = this._handleMessage.bind(this)

  constructor() {
    if (typeof window === 'undefined') {
      throw new Error('ZTorrentHost requires a browser environment')
    }
    this._parent = window.parent !== window ? window.parent : null
    window.addEventListener('message', this._onMessage)
  }

  get isEmbedded(): boolean {
    return this._parent !== null
  }

  async add(magnetURI: string, opts: AddTorrentOptions = {}): Promise<AddTorrentResult> {
    if (!this._parent) {
      throw new Error('ZTorrentHost.add() can only be called from within an iframe')
    }

    const id = crypto.randomUUID()
    const timeout = opts.timeout ?? 120_000

    return new Promise<AddTorrentResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id)
        reject(new Error(`Timeout: no response from parent portal within ${timeout / 1000}s`))
      }, timeout)

      this._pending.set(id, {
        resolve,
        reject,
        timer,
        onProgress: opts.onProgress,
        progressInterval: undefined,
      })

      this._parent!.postMessage(
        { type: `${NAMESPACE}:add-torrent`, id, magnetURI },
        window.location.origin
      )
    })
  }

  destroy(): void {
    window.removeEventListener('message', this._onMessage)
    for (const [, pending] of this._pending) {
      clearTimeout(pending.timer)
      if (pending.progressInterval) clearInterval(pending.progressInterval)
      pending.reject(new Error('ZTorrentHost destroyed'))
    }
    this._pending.clear()
  }

  private _handleMessage(event: MessageEvent): void {
    if (!this._parent || event.source !== this._parent) return
    if (event.origin !== window.location.origin) return
    if (!isPayload(event.data)) return

    const { type, id } = event.data

    if (!id) return

    const pending = this._pending.get(id)
    if (!pending) return

    switch (type) {
      case `${NAMESPACE}:torrent-added`: {
        clearTimeout(pending.timer)
        if (pending.progressInterval) clearInterval(pending.progressInterval)
        this._pending.delete(id)
        pending.resolve({
          infoHash: event.data.infoHash ?? '',
          files: event.data.files ?? {},
        })
        break
      }

      case `${NAMESPACE}:torrent-progress`: {
        if (pending.onProgress) {
          pending.onProgress({
            phase: (event.data.phase as TorrentProgress['phase']) ?? 'connecting',
            progress: event.data.progress ?? 0,
            downloadSpeed: event.data.downloadSpeed ?? 0,
            peers: event.data.peers ?? 0,
            downloaded: event.data.downloaded ?? 0,
            totalSize: event.data.totalSize ?? 0,
          })
        }
        break
      }

      case `${NAMESPACE}:torrent-error`: {
        clearTimeout(pending.timer)
        if (pending.progressInterval) clearInterval(pending.progressInterval)
        this._pending.delete(id)
        pending.reject(new Error(event.data.error ?? 'Unknown error from parent portal'))
        break
      }
    }
  }
}
