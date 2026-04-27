import { buildPushPayload } from '@block65/webcrypto-web-push'
import type { PushSubscription, PushMessage } from '@block65/webcrypto-web-push'

export interface DbSubscription {
  id: number
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

/**
 * Send a push notification to a single subscription.
 * Returns true on success, false when the subscription is expired (410/404).
 * Throws on unexpected errors.
 */
export async function sendPush(
  sub: DbSubscription,
  payload: PushPayload,
  env: Env,
): Promise<boolean> {
  const subscription: PushSubscription = {
    endpoint: sub.endpoint,
    expirationTime: null,
    keys: { auth: sub.auth, p256dh: sub.p256dh },
  }

  const message: PushMessage = {
    data: JSON.parse(JSON.stringify(payload)) as PushMessage['data'],
    options: { ttl: 3600, urgency: 'normal' },
  }

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }

  const req = await buildPushPayload(message, subscription, vapid)

  const res = await fetch(sub.endpoint, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  })

  if (res.status === 410 || res.status === 404) {
    return false // caller must delete this subscription
  }

  if (!res.ok) {
    throw new Error(`Push failed: ${res.status} ${await res.text()}`)
  }

  return true
}

/**
 * Broadcast to every subscription in `subs`.
 * Expired subscriptions (404/410) are collected and returned for bulk deletion.
 */
export async function broadcastPush(
  subs: DbSubscription[],
  payload: PushPayload,
  env: Env,
): Promise<number[]> {
  const expired: number[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        const ok = await sendPush(sub, payload, env)
        if (!ok) expired.push(sub.id)
      } catch (err) {
        console.error(`Push error for sub ${sub.id}:`, err)
      }
    }),
  )

  return expired
}

/** Remove a list of expired subscription IDs from D1. */
export async function purgeExpired(ids: number[], db: D1Database): Promise<void> {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  await db
    .prepare(`DELETE FROM push_subscriptions WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run()
}
