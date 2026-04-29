import { Hono } from 'hono'
import { buildPushPayload } from '@block65/webcrypto-web-push'
import type { Bindings, PushSubRow } from './types'

export const pushRoutes = new Hono<{ Bindings: Bindings }>()

// GET /api/push/vapid-public-key
pushRoutes.get('/vapid-public-key', (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY })
})

// POST /api/push/subscribe
pushRoutes.post('/subscribe', async (c) => {
  const body = await c.req.json<{
    endpoint: string
    keys: { p256dh: string; auth: string }
  }>()

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: 'Invalid subscription' }, 400)
  }

  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth)
     VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
  )
    .bind(body.endpoint, body.keys.p256dh, body.keys.auth)
    .run()

  return c.json({ ok: true }, 201)
})

// DELETE /api/push/subscribe
pushRoutes.delete('/subscribe', async (c) => {
  const { endpoint } = await c.req.json<{ endpoint: string }>()

  if (!endpoint) return c.json({ error: 'Missing endpoint' }, 400)

  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
    .bind(endpoint)
    .run()

  return c.json({ ok: true })
})

// POST /api/push/test
pushRoutes.post('/test', async (c) => {
  const { endpoint } = await c.req.json<{ endpoint: string }>()

  if (!endpoint) return c.json({ error: 'Missing endpoint' }, 400)

  const sub = await c.env.DB.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = ?'
  )
    .bind(endpoint)
    .first<PushSubRow>()

  if (!sub) return c.json({ error: 'Subscription not found' }, 404)

  try {
    await sendNotification(
      sub,
      { title: 'T1D Tracker', body: '🔔 Notification test — tout fonctionne !', url: '/settings' },
      c.env,
    )
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Push failed' }, 502)
  }

  return c.json({ ok: true })
})

// ── Shared helper ────────────────────────────────────────────────────────────

export async function sendNotification(
  sub: Pick<PushSubRow, 'endpoint' | 'p256dh' | 'auth'>,
  data: { title: string; body: string; url?: string },
  env: Bindings,
): Promise<void> {
  const payload = new TextEncoder().encode(JSON.stringify(data))

  const requestInit = await buildPushPayload(
    payload,
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
  )

  const res = await fetch(sub.endpoint, requestInit)

  if (res.status === 404 || res.status === 410) {
    // Abonnement expiré — purger
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
      .bind(sub.endpoint)
      .run()
    throw new Error('Subscription expired and removed')
  }

  if (!res.ok) {
    throw new Error(`Push service returned ${res.status}`)
  }
}
