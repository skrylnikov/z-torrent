import fileResponse from './worker-server.js'

const _self = self as unknown as ServiceWorkerGlobalScope

_self.addEventListener('install', () => {
  _self.skipWaiting()
})

_self.addEventListener('fetch', (event: FetchEvent) => {
  const res = fileResponse(event)
  if (res) event.respondWith(res)
})

_self.addEventListener('activate', () => {
  void _self.clients.claim()
})
