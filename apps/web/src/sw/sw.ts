/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore __WB_MANIFEST is injected at build time by vite-plugin-pwa
precacheAndRoute((self as unknown as { __WB_MANIFEST: unknown[] }).__WB_MANIFEST ?? [])

// ── Push handler ────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'T1D Tracker', body: event.data?.text() ?? '' }
  }

  const title = data.title ?? 'T1D Tracker'
  const options: NotificationOptions = {
    body: data.body ?? 'Rappel',
    icon: '/icons/pwa-192x192.png',
    badge: '/icons/pwa-192x192.png',
    data: { url: data.url ?? '/' },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = (event.notification.data as { url: string })?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})

// ── Push subscription change ─────────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  const e = event as ExtendableEvent & {
    oldSubscription?: PushSubscription
    newSubscription?: PushSubscription
  }
  e.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: (e.oldSubscription as PushSubscription & { options: PushSubscriptionOptions })?.options?.applicationServerKey,
    }).then((sub) => {
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
    })
  )
})

// ── Background sync (outbox) ─────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  const syncEvent = event as ExtendableEvent & { tag: string }
  if (syncEvent.tag === 'outbox-sync') {
    syncEvent.waitUntil(syncOutbox())
  }
})

async function syncOutbox() {
  // Dexie can't be imported directly in SW; use IDB directly for the outbox
  const request = indexedDB.open('t1d-tracker')
  return new Promise<void>((resolve) => {
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('outbox', 'readwrite')
      const store = tx.objectStore('outbox')
      const pending = store.index('status').getAll('pending')
      pending.onsuccess = async () => {
        for (const item of pending.result) {
          try {
            await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
            })
            store.put({ ...item, status: 'synced' })
          } catch {
            store.put({ ...item, status: 'failed' })
          }
        }
        resolve()
      }
    }
    request.onerror = () => resolve()
  })
}
