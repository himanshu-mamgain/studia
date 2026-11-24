// The Studia site's service worker: it shows the daily plan's reminders, and keeps the last copy
// of the site so the installed app still opens offline. Pages come from the network first (so
// you always get the latest), and from this copy only when there's no connection. Supabase and
// /api calls are never cached. The push function sends { id, title, body, url, tag }; tapping a
// notification opens that page.

const CACHE = 'studia-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  ),
)

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  // Built files never change (their names carry a hash): the saved copy is fine.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          }),
      ),
    )
    return
  }
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          if (res.ok) caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(async () => (await caches.match('/index.html')) || Response.error()),
    )
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Studia', {
      body: data.body || '',
      // One per kind: the 17:00 nudge replaces an unread 11:00 list.
      tag: data.tag || 'studia',
      icon: '/apple-touch-icon.png',
      data: { url: data.url || '/today' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/today', self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        try {
          await client.focus()
          await client.navigate(target.href)
          return
        } catch {
          // Not ours to steer: open a new window instead.
        }
      }
      await self.clients.openWindow(target.href)
    })(),
  )
})

// The push service replaced the subscription (rare): move this browser's reminders to the new one.
self.addEventListener('pushsubscriptionchange', (event) => {
  const old = event.oldSubscription
  const key = old && old.options && old.options.applicationServerKey
  if (!key) return
  event.waitUntil(
    (async () => {
      const fresh = event.newSubscription || (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }))
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: fresh.toJSON(), previousEndpoint: old.endpoint }),
      })
    })(),
  )
})
