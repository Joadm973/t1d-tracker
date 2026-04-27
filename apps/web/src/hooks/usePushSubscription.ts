import { useEffect, useCallback, useState } from 'react'
import { getVapidPublicKey, workerSubscribe, workerUnsubscribe } from '@/lib/worker'

export type PushStatus =
  | 'checking'
  | 'unsupported'
  | 'not-installed'
  | 'idle'
  | 'loading'
  | 'subscribed'
  | 'denied'
  | 'error'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i)
  return view
}

function detectSupport() {
  return (
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'serviceWorker' in navigator &&
    'Notification' in window
  )
}

function detectInstalled() {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('checking')
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isSupported = detectSupport()
  const isInstalled = detectInstalled()

  // Detect existing subscription on mount
  useEffect(() => {
    if (!isSupported) { setStatus('unsupported'); return }
    if (!isInstalled) { setStatus('not-installed'); return }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) {
          setSubscription(sub)
          setStatus('subscribed')
        } else {
          setStatus(Notification.permission === 'denied' ? 'denied' : 'idle')
        }
      })
      .catch(() => setStatus('idle'))
  }, [isSupported, isInstalled])

  // Must be called directly from a user-gesture handler (iOS requirement)
  const subscribe = useCallback(async () => {
    if (!isSupported || !isInstalled) return
    setStatus('loading')
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }
      const vapidKey = await getVapidPublicKey()
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await workerSubscribe(sub, navigator.userAgent)
      setSubscription(sub)
      setStatus('subscribed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(msg)
      setStatus('error')
    }
  }, [isSupported, isInstalled])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return
    setStatus('loading')
    setError(null)
    try {
      await workerUnsubscribe(subscription.endpoint)
      await subscription.unsubscribe()
      setSubscription(null)
      setStatus('idle')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(msg)
      setStatus('error')
    }
  }, [subscription])

  return { status, subscription, error, isSupported, isInstalled, subscribe, unsubscribe }
}
