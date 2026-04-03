<script lang="ts">
  import { loadTorrent, getClient, INITIAL_STATE } from '../lib/torrent-loader.js'
  import type { TorrentState } from '../lib/torrent-loader.js'
  import { torrentState } from '../stores/torrent.js'
  import { syncIframeUrl } from '../lib/url.js'
  import LoadingScreen from './LoadingScreen.svelte'

  const ZT_NAMESPACE = 'z-torrent'

  interface SdkMessage {
    type: string
    id: string
    magnetURI?: string
  }

  interface SdkTorrentHandle {
    torrent: any
    progressInterval: ReturnType<typeof setInterval>
  }

  let {
    hash,
    subpath = '',
    onNavigate,
  }: {
    hash: string
    subpath: string
    onNavigate: (hash: string) => void
  } = $props()

  let state = $state<TorrentState>({ ...INITIAL_STATE, phase: 'connecting' })
  let iframeSrc = $state<string | null>(null)
  let iframeEl = $state<HTMLIFrameElement | null>(null)
  let retryCount = $state(0)

  // Plain (non-reactive) map — used from setInterval callbacks where
  // Svelte 5 $state proxy reads may not reflect the latest value.
  const sdkHandles = new Map<string, SdkTorrentHandle>()

  function hasActiveSdkTorrents(): boolean {
    for (const [, h] of sdkHandles) {
      if (!h.torrent.done) return true
    }
    return false
  }

  function syncStore(partial: Partial<TorrentState>): void {
    state = { ...state, ...partial }
    torrentState.set(state)
  }

  $effect(() => {
    torrentState.set(state)
  })

  $effect(() => {
    state = { ...INITIAL_STATE, phase: 'connecting' }
    iframeSrc = null
    let cleanupTorrent: (() => void) | null = null
    const controller = new AbortController()

    cleanupTorrent?.()
    cleanupTorrent = null

    loadTorrent(hash, {
      signal: controller.signal,
      onProgress: (s) => {
        state = { ...s }
      },
      maxRetries: retryCount > 0 ? 1 : 3,
    })
      .then((torrent) => {
        const manifest = state.manifest
        const entry = manifest?.routing?.entry ?? 'index.html'
        const path = subpath || entry
        iframeSrc = `/z-torrent/${hash}/${path}`
        state = {
          ...state,
          phase: torrent.done ? 'seeding' : 'downloading',
          infoHash: hash,
        }

        const updateStats = () => {
          if (controller.signal.aborted) return
          // Don't overwrite the portal stats while an SDK torrent (e.g. video)
          // is actively downloading — its progress interval already updates the store.
          if (hasActiveSdkTorrents()) return
          state = {
            ...state,
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            peerCount: torrent.numPeers,
            downloaded: torrent.downloaded,
            totalSize: torrent.length,
            timeRemaining: torrent.timeRemaining,
            phase: torrent.done ? 'seeding' : 'downloading',
            infoHash: hash,
          }
          torrentState.set(state)
        }

        const interval = setInterval(updateStats, 1000)
        torrent.on('done', updateStats)
        torrent.on('download', updateStats)

        cleanupTorrent = () => {
          clearInterval(interval)
          torrent.off('done', updateStats)
          torrent.off('download', updateStats)
        }
      })
      .catch((err) => {
        if (err.message !== 'Aborted') {
          state = { ...INITIAL_STATE, phase: 'error', error: err.message }
        }
      })

    return () => {
      cleanupTorrent?.()
      controller.abort()
    }
  })

  $effect(() => {
    if (iframeEl && iframeSrc) {
      const handler = () => syncIframeUrl(iframeEl!, hash)
      iframeEl.addEventListener('load', handler)
      return () => iframeEl.removeEventListener('load', handler)
    }
  })

  function sendToIframe(id: string, msg: Record<string, unknown>) {
    const win = iframeEl?.contentWindow
    if (!win) return
    win.postMessage(msg, window.location.origin)
  }

  function handleSdkMessage(event: MessageEvent) {
    if (event.source !== iframeEl?.contentWindow) return
    const data = event.data as SdkMessage | null
    if (!data?.type?.startsWith(ZT_NAMESPACE + ':')) return
    if (data.type !== `${ZT_NAMESPACE}:add-torrent`) return
    if (!data.magnetURI || !data.id) return

    console.log('[portal] SDK add-torrent:', data.id, data.magnetURI?.slice(0, 40))

    const { id, magnetURI } = data

    ;(async () => {
      try {
        const client = await getClient()
        const existing = await client.get(id)
        if (existing) {
          console.log('[portal] SDK torrent already exists:', id)
        }
        if (existing) {
          const files: Record<string, string> = {}
          for (const f of existing.files) {
            files[f.name] = `/z-torrent/${existing.infoHash}/${f.path}`
          }
          sendToIframe(id, {
            type: `${ZT_NAMESPACE}:torrent-added`,
            id,
            infoHash: existing.infoHash,
            files,
          })
          return
        }

        const torrent = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('SDK: torrent add timeout')), 120_000)

          client.add(magnetURI, {}, (t: any) => {
            clearTimeout(timeout)
            console.log('[portal] SDK torrent metadata received:', t.infoHash, 'done:', t.done)
            resolve(t)
          })
        })

        const files: Record<string, string> = {}
        for (const f of torrent.files) {
          files[f.name] = `/z-torrent/${torrent.infoHash}/${f.path}`
        }

        sendToIframe(id, {
          type: `${ZT_NAMESPACE}:torrent-added`,
          id,
          infoHash: torrent.infoHash,
          files,
        })

        const progressInterval = setInterval(() => {
          const phase = torrent.done ? 'ready' : 'downloading'
          sendToIframe(id, {
            type: `${ZT_NAMESPACE}:torrent-progress`,
            id,
            phase,
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            peers: torrent.numPeers,
            downloaded: torrent.downloaded,
            totalSize: torrent.length,
          })

          // Mirror SDK torrent stats to portal status so the user sees
          // P2P download progress for the video in StatusPanel/StatusIndicator.
          if (!torrent.done) {
            console.log(
              '[portal] SDK progress:',
              (torrent.progress * 100).toFixed(1) + '%',
              torrent.downloadSpeed + ' B/s',
              torrent.numPeers + ' peers'
            )
            syncStore({
              phase: 'downloading',
              progress: torrent.progress,
              downloadSpeed: torrent.downloadSpeed,
              uploadSpeed: torrent.uploadSpeed,
              peerCount: torrent.numPeers,
              downloaded: torrent.downloaded,
              totalSize: torrent.length,
              timeRemaining: torrent.timeRemaining,
            })
          }
        }, 500)

        torrent.on('done', () => {
          clearInterval(progressInterval)
          sendToIframe(id, {
            type: `${ZT_NAMESPACE}:torrent-progress`,
            id,
            phase: 'ready',
            progress: 1,
            downloadSpeed: 0,
            peers: torrent.numPeers,
            downloaded: torrent.downloaded,
            totalSize: torrent.length,
          })

          // Restore main torrent stats now that the SDK download finished
          sdkHandles.delete(id)
          if (!hasActiveSdkTorrents()) {
            syncStore({ phase: 'seeding' })
          }
        })

        sdkHandles.set(id, { torrent, progressInterval })
      } catch (err: any) {
        sendToIframe(id, {
          type: `${ZT_NAMESPACE}:torrent-error`,
          id,
          error: err.message || 'Failed to add torrent',
        })
      }
    })()
  }

  $effect(() => {
    window.addEventListener('message', handleSdkMessage)
    return () => {
      window.removeEventListener('message', handleSdkMessage)
      for (const [, handle] of sdkHandles) {
        clearInterval(handle.progressInterval)
      }
      sdkHandles.clear()
    }
  })

  function handleRetry() {
    retryCount++
    state = { ...INITIAL_STATE, phase: 'connecting' }
    iframeSrc = null
    const controller = new AbortController()

    loadTorrent(hash, {
      signal: controller.signal,
      onProgress: (s) => { state = { ...s } },
    }).then((torrent) => {
      const entry = state.manifest?.routing?.entry ?? 'index.html'
      const path = subpath || entry
      iframeSrc = `/z-torrent/${hash}/${path}`
      state = { ...state, phase: torrent.done ? 'seeding' : 'downloading', infoHash: hash }
    }).catch((err) => {
      if (err.message !== 'Aborted') {
        state = { ...INITIAL_STATE, phase: 'error', error: err.message }
      }
    })
  }

  function handleBack() {
    history.pushState(null, '', '/')
    onNavigate('')
  }
</script>

{#if state.phase !== 'ready' && state.phase !== 'downloading' && state.phase !== 'seeding'}
  <LoadingScreen {state} />
  {#if state.phase === 'error'}
    <div class="retry-actions">
      <button class="btn-retry" onclick={handleRetry}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Retry
      </button>
      <button class="btn-back" onclick={handleBack}>Back to portal</button>
    </div>
  {/if}
{/if}

{#if iframeSrc}
  <iframe
    bind:this={iframeEl}
    src={iframeSrc}
    class="viewer-frame"
    class:visible={state.phase === 'downloading' || state.phase === 'seeding'}
    title={state.siteName || 'Z-Torrent Site'}
    allowfullscreen
  ></iframe>
{/if}

<style>
  .viewer-frame {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .viewer-frame.visible {
    opacity: 1;
  }

  .retry-actions {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    z-index: 20;
  }

  .btn-retry {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: var(--accent);
    color: #000;
    font-weight: 600;
    font-size: 0.875rem;
    border-radius: var(--radius-md);
    transition: background 0.2s;
  }

  .btn-retry:hover {
    background: var(--accent-dim);
  }

  .btn-back {
    padding: 10px 20px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 0.875rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    transition: background 0.2s;
  }

  .btn-back:hover {
    background: var(--bg-secondary);
  }
</style>
