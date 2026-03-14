import 'webrtc-polyfill' // Required for WebRTC in some browsers
import { createP2PGraph } from '../lib/p2p-graph'
import prettierBytes from 'prettier-bytes'
import throttle from 'throttleit'

// WebTorrent demo torrent: Sintel.mp4 + wss trackers. Local sintel.torrent is a different
// torrent (4K mkv, no announce) — no peers in browser. Magnet has correct metadata + trackers.
// Актуальные WSS-трекеры (webtorrent.io, fastcast.nz — NS_ERROR_UNKNOWN_HOST, домены недоступны).
const SINTEL_MAGNET =
  'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=wss%3A%2F%2Ftracker.home.dskr.dev&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.webtorrent.dev&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.files.fm%3A7073%2Fannounce&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent'

function formatRemaining(ms: number): string {
  if (ms === Infinity || ms <= 0) return 'Calculating...'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds} seconds remaining.`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} remaining.`
  const hours = Math.floor(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} remaining.`
}

interface TorrentWire {
  peerId: { toString: () => string }
  remoteAddress?: string
  once: (ev: string, fn: () => void) => void
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
  localStorage.debug = 'webtorrent*,bittorrent-tracker*'

  const graph = createP2PGraph('.torrent-graph')
  graph.add({ id: 'You', name: 'You', me: true })

  const { default: WebTorrent } = await import('z-torrent-browser')
  // webSeeds: false — скачивать только через P2P (wss трекеры + WebRTC), не с webtorrent.io
  const client = new WebTorrent({
    webSeeds: false,
    tracker: {
      rtcConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.stunprotocol.org:3478' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { urls: 'stun:stun.nextcloud.com:443' },
          { urls: "stun:stun.arbuz.ru:3478" },
          { urls: "stun:stun.chathelp.ru:3478" },
          { urls: "stun:stun.comtube.ru:3478" },
          { urls: "stun:stun.demos.ru:3478" },
          { urls: "stun:stun.kanet.ru:3478" },
          { urls: "stun:stun.mgn.ru:3478" },
          { urls: "stun:stun.ooonet.ru:3478" },
          { urls: "stun:stun.skylink.ru:3478" },
          {
            urls: ['turn:freeturn.net:3478', 'turn:freeturn.net:5349'],
            username: 'free',
            credential: 'free',
          },
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
      const id = w.peerId.toString()
      graph.add({ id, name: w.remoteAddress || 'Unknown' })
      graph.connect('You', id)
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
