import { useState, useEffect, useCallback } from 'react'
import { workerClient } from '@/lib/worker'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushSubscription() {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [loading, setLoading] = useState(false)
  const supported = 'serviceWorker' in navigator && 'PushManager' in window

  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then(setSubscription)
    })
  }, [supported])

  const subscribe = useCallback(async () => {
    if (!supported) throw new Error('Push non supporté')
    setLoading(true)
    try {
      const vapidKey = await workerClient.getVapidPublicKey()
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await workerClient.subscribe(sub.toJSON())
      setSubscription(sub)
    } finally {
      setLoading(false)
    }
  }, [supported])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return
    setLoading(true)
    try {
      await workerClient.unsubscribe(subscription.endpoint)
      await subscription.unsubscribe()
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }, [subscription])

  return { subscription, loading, supported, subscribe, unsubscribe }
}
