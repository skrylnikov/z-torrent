const SINTEL_MAGNET = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel'

const NS = 'z-torrent'

interface PendingRequest {
  resolve: (result: AddTorrentResult) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
  onProgress?: ((p: TorrentProgress) => void) | undefined
}

interface AddTorrentOptions {
  timeout?: number
  onProgress?: (p: TorrentProgress) => void
}

interface TorrentProgress {
  phase: 'connecting' | 'metadata' | 'downloading' | 'ready'
  progress: number
  downloadSpeed: number
  peers: number
  downloaded: number
  totalSize: number
}

interface AddTorrentResult {
  infoHash: string
  files: Record<string, string>
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector)
}

function show(el: HTMLElement | null) {
  el?.classList.remove('hidden')
}

function hide(el: HTMLElement | null) {
  el?.classList.add('hidden')
}

class HostSDK {
  private _pending = new Map<string, PendingRequest>()
  private _onMessage = this._handleMessage.bind(this)

  constructor() {
    window.addEventListener('message', this._onMessage)
  }

  get isEmbedded(): boolean {
    return window.parent !== window
  }

  add(magnetURI: string, opts: AddTorrentOptions = {}): Promise<AddTorrentResult> {
    if (!this.isEmbedded) {
      return Promise.reject(new Error('HostSDK.add() can only be called from within an iframe'))
    }

    const id = crypto.randomUUID()
    const timeout = opts.timeout ?? 120_000

    return new Promise<AddTorrentResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id)
        reject(new Error(`Timeout: no response within ${timeout / 1000}s`))
      }, timeout)

      this._pending.set(id, { resolve, reject, timer, onProgress: opts.onProgress })
      window.parent.postMessage({ type: `${NS}:add-torrent`, id, magnetURI }, '*')
    })
  }

  destroy(): void {
    window.removeEventListener('message', this._onMessage)
    this._pending.forEach((p) => {
      clearTimeout(p.timer)
      p.reject(new Error('HostSDK destroyed'))
    })
    this._pending.clear()
  }

  private _handleMessage(event: MessageEvent): void {
    const d = event.data
    if (!d || typeof d.type !== 'string' || !d.type.startsWith(NS + ':') || !d.id) return
    const p = this._pending.get(d.id)
    if (!p) return

    if (d.type === `${NS}:torrent-added`) {
      clearTimeout(p.timer)
      this._pending.delete(d.id)
      p.resolve({ infoHash: d.infoHash || '', files: d.files || {} })
    } else if (d.type === `${NS}:torrent-progress` && p.onProgress) {
      p.onProgress({
        phase: d.phase || 'connecting',
        progress: d.progress || 0,
        downloadSpeed: d.downloadSpeed || 0,
        peers: d.peers || 0,
        downloaded: d.downloaded || 0,
        totalSize: d.totalSize || 0,
      })
    } else if (d.type === `${NS}:torrent-error`) {
      clearTimeout(p.timer)
      this._pending.delete(d.id)
      p.reject(new Error(d.error || 'Unknown error'))
    }
  }
}

export function initPlayer(): void {
  const host = new HostSDK()
  const watchBtn = qs<HTMLButtonElement>('#watchBtn')
  const playerSection = qs<HTMLElement>('#playerSection')
  const loadingOverlay = qs<HTMLElement>('#loadingOverlay')
  const errorOverlay = qs<HTMLElement>('#errorOverlay')
  const video = qs<HTMLVideoElement>('#videoPlayer')
  const progressFill = qs<HTMLElement>('#progressFill')
  const loadingText = qs<HTMLParagraphElement>('#loadingText')
  const loadingDetail = qs<HTMLParagraphElement>('#loadingDetail')
  const errorText = qs<HTMLParagraphElement>('#errorText')
  const retryBtn = qs<HTMLButtonElement>('#retryBtn')
  const torrentStats = qs<HTMLElement>('#torrentStats')

  if (!watchBtn || !playerSection || !video) return

  function updateProgress(p: TorrentProgress): void {
    const pct = Math.round(p.progress * 100)
    if (progressFill) progressFill.style.width = `${pct}%`

    switch (p.phase) {
      case 'connecting':
        loadingText && (loadingText.textContent = 'Connecting to peers...')
        break
      case 'metadata':
        loadingText && (loadingText.textContent = 'Receiving torrent metadata...')
        break
      case 'downloading':
        loadingText && (loadingText.textContent = 'Downloading...')
        loadingDetail &&
          (loadingDetail.textContent = `${pct}% — ${fmtBytes(p.downloaded)} / ${fmtBytes(p.totalSize)} — ${p.peers} peer${p.peers === 1 ? '' : 's'} — ${fmtBytes(p.downloadSpeed)}/s`)
        if (torrentStats) {
          torrentStats.innerHTML =
            `<span class="stat">${fmtBytes(p.downloaded)} / ${fmtBytes(p.totalSize)}</span>` +
            `<span class="stat">${p.peers} peer${p.peers === 1 ? '' : 's'}</span>` +
            `<span class="stat">${fmtBytes(p.downloadSpeed)}/s</span>`
        }
        break
      case 'ready':
        loadingText && (loadingText.textContent = 'Ready — starting playback...')
        break
    }
  }

  function startStreaming(): void {
    show(playerSection)
    show(loadingOverlay)
    hide(errorOverlay)
    if (progressFill) progressFill.style.width = '0%'
    if (loadingText) loadingText.textContent = 'Loading torrent metadata...'
    if (loadingDetail) loadingDetail.textContent = ''
    if (torrentStats) torrentStats.textContent = ''
    watchBtn.disabled = true
    watchBtn.textContent = 'Loading...'
    playerSection.scrollIntoView({ behavior: 'smooth' })

    host
      .add(SINTEL_MAGNET, {
        timeout: 120_000,
        onProgress: updateProgress,
      })
      .then((result) => {
        hide(loadingOverlay)
        watchBtn.disabled = false
        watchBtn.innerHTML = '\u25B6 Now Playing'

        const videoUrl = Object.entries(result.files).find(([name]) => name.endsWith('.mp4'))?.[1]
        if (!videoUrl) throw new Error('No video file found in torrent')

        video.src = videoUrl
        video.muted = true

        const handleError = (): void => {
          hide(loadingOverlay)
          show(errorOverlay)
          if (errorText)
            errorText.textContent =
              'Failed to load video. The torrent data may not be available yet.'
          watchBtn.disabled = false
          watchBtn.innerHTML = '\u25B6 Watch via P2P'
        }

        video.addEventListener('error', handleError, { once: true })
        video.addEventListener('stalled', handleError, { once: true })
        video.play().catch(() => {})

        const unmute = () => {
          video.muted = false
          video.removeEventListener('click', unmute)
        }
        video.addEventListener('click', unmute)
      })
      .catch((err) => {
        hide(loadingOverlay)
        show(errorOverlay)
        if (errorText) errorText.textContent = err.message || 'Failed to load video'
        watchBtn.disabled = false
        watchBtn.innerHTML = '\u25B6 Watch via P2P'
      })
  }

  watchBtn.addEventListener('click', startStreaming)
  retryBtn?.addEventListener('click', () => {
    hide(errorOverlay)
    startStreaming()
  })
}
