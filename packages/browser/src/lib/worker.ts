import { handleFetch } from './worker-server.js'

const sw = self as unknown as ServiceWorkerGlobalScope

sw.addEventListener('install', () => {
  sw.skipWaiting()
})

sw.addEventListener('fetch', (event: FetchEvent) => {
  const res = handleFetch(event)
  if (res) event.respondWith(res)
})

sw.addEventListener('activate', () => {
  void sw.clients.claim()
})
