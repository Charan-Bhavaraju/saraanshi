const CACHE_NAME = 'saaranshi-shell-v1'

const SHELL_ASSETS = [
  '/',
  '/today',
  '/contacts',
  '/tasks',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
]

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(SHELL_ASSETS).catch(() => {
        // Non-fatal: shell assets may not exist at install time in dev
      }),
    ),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  // Only intercept same-origin GET requests
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return
  }

  const url = new URL(event.request.url)

  // API routes + auth callbacks go network-only
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/_next')
  ) {
    return
  }

  // Shell pages: network-first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache fresh responses for shell routes
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request)),
  )
})
