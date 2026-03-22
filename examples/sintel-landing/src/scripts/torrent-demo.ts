import 'webrtc-polyfill' // Required for WebRTC in some browsers
import { createP2PGraph } from '../lib/p2p-graph'
import { WSS_TRACKERS } from '../config/trackers'
import prettierBytes from 'prettier-bytes'
import throttle from 'throttleit'

// Public Sintel demo magnet (Sintel.mp4). WSS trackers from config (client.tracker.announce).
// Local sintel.torrent is a different torrent (4K mkv, no announce) — no peers in browser.
// ws/xs — metadata source (webtorrent.io).
const SINTEL_MAGNET =
  'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel'

function formatRemaining(ms: number): string {
  if (ms === Infinity || ms <= 0) return 'Calculating...'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds} seconds remaining.`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} remaining.`
  const hours = Math.floor(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} remaining.`
}

function readExtendedClientV(hs: Record<string, unknown>): string {
  const v = hs.v
  if (typeof v === 'string') return v
  if (v instanceof Uint8Array) return new TextDecoder().decode(v)
  return ''
}

interface TorrentWire {
  peerId: string | { toString: () => string }
  remoteAddress?: string
  uploaded: number
  downloaded: number
  once: (ev: string, fn: (...args: unknown[]) => void) => void
  on: (ev: string, fn: (...args: unknown[]) => void) => void
}

interface Torrent {
  files: { name: string; streamTo: (el: HTMLMediaElement) => HTMLMediaElement }[]
  on: (ev: string, fn: (...args: unknown[]) => void) => void
  numPeers: number
  progress: number
  downloaded: number
  length: number
  timeRemaining: number
  done: boolean
}

export async function initTorrentDemo() {
  const hero = document.querySelector<HTMLElement>('#hero')
  if (!hero) return

  const startDemo = async () => {
    hero.classList.add('loading')
    await runDemo()
  }

  if (window.innerWidth <= 899) {
    const beginButton = document.createElement('a')
    beginButton.href = '#'
    beginButton.id = 'begin'
    beginButton.className = 'btn large'
    beginButton.textContent = 'Begin Demo'
    beginButton.addEventListener('click', (e) => {
      e.preventDefault()
      beginButton.remove()
      startDemo()
    })
    hero.appendChild(beginButton)
  } else {
    startDemo()
  }
}

async function runDemo(): Promise<void> {
  localStorage.debug = '@z-torrent/*,-@z-torrent/protocol:wire'

  const graph = createP2PGraph('.torrent-graph')
  graph.add({ id: 'You', name: 'You', me: true })

  const { ZTorrent } = await import('@z-torrent/browser')
  // webSeeds: false — скачивать только через P2P (wss трекеры + WebRTC), не с webtorrent.io
  const client = new ZTorrent({
    // webSeeds: false,
    tracker: {
      announce: WSS_TRACKERS,
      rtcConfig: {
        // Fewer iceServers entries avoids Chrome: "Using five or more STUN/TURN servers..."
        // Merge extra STUN URLs into the first `urls` array; TURN needs its own entry (credentials).
        iceServers: [
          {
            urls: [
              'stun:turn.z-torrent.xyz:3478',
              'stun:stun.l.google.com:19302',
              // 'stun:stun.cloudflare.com:3478',
            ],
          },
          {
            urls: ['turn:turn.z-torrent.xyz:3478', 'turns:turn.z-torrent.xyz:5349'],
            username: 'z-torrent',
            credential: '7hEo08aCalKZMllCsU7DUnQ71/gSS0tAQ6hrQnVtL9vCqYc5',
          },
          // More STUN: append to the first `urls` array, not as new iceServers entries:
          // 'stun:stun.skylink.ru:3478',
          // 'stun:stun1.l.google.com:19302',
          // 'stun:stun2.l.google.com:19302',
          // 'stun:stun3.l.google.com:19302',
          // 'stun:stun4.l.google.com:19302',
          // 'stun:stun.stunprotocol.org:3478',
          // 'stun:global.stun.twilio.com:3478',
          // 'stun:stun.nextcloud.com:443',
          // 'stun:stun.arbuz.ru:3478',
          // 'stun:stun.chathelp.ru:3478',
          // 'stun:stun.comtube.ru:3478',
          // 'stun:stun.demos.ru:3478',
          // 'stun:stun.kanet.ru:3478',
          // 'stun:stun.mgn.ru:3478',
          // 'stun:stun.ooonet.ru:3478',
          // Extra TURN (different credentials) = separate iceServers object:
          // {
          //   urls: ['turn:freeturn.net:3478', 'turn:freeturn.net:5349'],
          //   username: 'free',
          //   credential: 'free',
          // },
        ],
      },
    },
  })
  client.on('warning', (err: Error) => console.warn(err))
  client.on('error', (err: Error) => {
    if (err) {
      window.alert(String(err))
      console.error(err)
    }
  })

  const reg = await navigator.serviceWorker.register('/sw.min.js', { scope: '/' })
  await navigator.serviceWorker.ready
  client.createServer({ controller: reg as unknown as ServiceWorkerRegistration })

  const $body = document.body
  const $progressBar = document.querySelector<HTMLElement>('#progressBar')
  const $numPeers = document.querySelector<HTMLElement>('#numPeers')
  const $downloaded = document.querySelector<HTMLElement>('#downloaded')
  const $total = document.querySelector<HTMLElement>('#total')
  const $remaining = document.querySelector<HTMLElement>('#remaining')
  const videoWrap = document.querySelector<HTMLElement>('#videoWrap')
  const videoContainer = document.querySelector<HTMLElement>('#videoWrap .video')
  const videoOverlay = document.querySelector<HTMLElement>('.videoOverlay')

  client.add(SINTEL_MAGNET, (torrent: Torrent) => {
    const file = torrent.files.find((f) => f.name.endsWith('.mp4'))
    if (!file || !videoContainer) return

    const video = document.createElement('video')
    video.controls = true
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    videoContainer.appendChild(video)

    file.streamTo(video)
    videoWrap?.classList.add('canplay', 'muted')

    if (videoOverlay) {
      const unmute = () => {
        videoOverlay.removeEventListener('click', unmute)
        video.muted = false
        videoWrap?.classList.remove('muted')
      }
      videoOverlay.addEventListener('click', unmute)
    }

    torrent.on('wire', (wire: unknown) => {
      const w = wire as TorrentWire
      const rawPeerId = w.peerId
      const id = typeof rawPeerId === 'string' ? rawPeerId : rawPeerId.toString()
      const shortId = id.slice(0, 6)
      const initialName = w.remoteAddress ?? shortId
      graph.add({ id, name: initialName })
      graph.connect('You', id)

      w.on('extended', (...args: unknown[]) => {
        const extName = args[0]
        const hs = args[1]
        if (extName !== 'handshake') return
        if (w.remoteAddress) return
        const clientStr = readExtendedClientV(hs as Record<string, unknown>)
        if (clientStr) graph.updatePeer(id, { name: `${clientStr} (${shortId})` })
      })

      const throttledPeerStats = throttle(() => {
        graph.updatePeer(id, { downloaded: w.downloaded, uploaded: w.uploaded })
      }, 500) as () => void
      w.on('download', throttledPeerStats)
      w.on('upload', throttledPeerStats)

      w.once('close', () => {
        graph.disconnect('You', id)
        graph.remove(id)
      })
    })

    const onProgress = () => {
      if (!$progressBar || !$numPeers || !$downloaded || !$total || !$remaining) return
      const percent = Math.round(torrent.progress * 100 * 100) / 100
      $progressBar.style.width = `${percent}%`
      $numPeers.innerHTML = `${torrent.numPeers} ${torrent.numPeers === 1 ? 'peer' : 'peers'}`
      $downloaded.innerHTML = prettierBytes(torrent.downloaded)
      $total.innerHTML = prettierBytes(torrent.length)
      $remaining.innerHTML = torrent.done ? 'Done.' : formatRemaining(torrent.timeRemaining)
    }

    torrent.on('download', throttle(onProgress, 250) as () => void)
    torrent.on('upload', throttle(onProgress, 250) as () => void)
    setInterval(onProgress, 5000)
    onProgress()

    torrent.on('done', () => {
      $body.classList.add('is-seed')
      onProgress()
    })
  })
}
