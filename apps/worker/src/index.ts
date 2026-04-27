import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sendPush, purgeExpired } from './push.js'
import { handleScheduled } from './scheduler.js'

// ── Zod schemas ──────────────────────────────────────────────────────────────
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
  userAgent: z.string().optional(),
  timezone: z.string().optional(),
})

const reminderSchema = z.object({
  subscriptionEndpoint: z.string().url(),
  label: z.string().min(1).max(100),
  type: z.enum(['glucose_check', 'injection', 'meal', 'custom']),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.number().int().min(1).max(7)).min(1),
  timezone: z.string().default('Europe/Paris'),
})

const testPushSchema = z.object({
  endpoint: z.string().url(),
  title: z.string().optional(),
  body: z.string().optional(),
})

// ── App ──────────────────────────────────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN ?? '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
  return corsMiddleware(c, next)
})

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ ok: true, service: 't1d-tracker-worker' }))

// ── VAPID public key (frontend needs this to subscribe) ─────────────────────
app.get('/api/push/vapid-public-key', (c) => {
  const key = c.env.VAPID_PUBLIC_KEY
  if (!key) return c.json({ error: 'VAPID keys not configured' }, 500)
  return c.json({ publicKey: key })
})

// ── Subscribe ────────────────────────────────────────────────────────────────
app.post('/api/push/subscribe', zValidator('json', subscribeSchema), async (c) => {
  const body = c.req.valid('json')

  await c.env.DB.prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh     = excluded.p256dh,
      auth       = excluded.auth,
      user_agent = excluded.user_agent,
      updated_at = unixepoch()
  `)
    .bind(body.endpoint, body.keys.p256dh, body.keys.auth, body.userAgent ?? null)
    .run()

  return c.json({ ok: true })
})

// ── Unsubscribe ───────────────────────────────────────────────────────────────
app.delete('/api/push/subscribe', async (c) => {
  const { endpoint } = await c.req.json<{ endpoint: string }>()
  if (!endpoint) return c.json({ error: 'endpoint required' }, 400)

  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
    .bind(endpoint)
    .run()

  return c.json({ ok: true })
})

// ── Sync a reminder (upsert by subscription + label + time) ──────────────────
app.post('/api/reminders', zValidator('json', reminderSchema), async (c) => {
  const body = c.req.valid('json')

  // Resolve subscription id
  const sub = await c.env.DB.prepare(
    'SELECT id FROM push_subscriptions WHERE endpoint = ?',
  )
    .bind(body.subscriptionEndpoint)
    .first<{ id: number }>()

  if (!sub) return c.json({ error: 'Subscription not found — subscribe first' }, 404)

  const result = await c.env.DB.prepare(`
    INSERT INTO scheduled_reminders (subscription_id, label, type, time, days, timezone)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
    .bind(
      sub.id,
      body.label,
      body.type,
      body.time,
      JSON.stringify(body.days),
      body.timezone,
    )
    .run()

  return c.json({ ok: true, id: result.meta.last_row_id })
})

// ── Toggle reminder enabled ───────────────────────────────────────────────────
app.put('/api/reminders/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const { enabled } = await c.req.json<{ enabled: boolean }>()

  await c.env.DB.prepare(
    'UPDATE scheduled_reminders SET enabled = ? WHERE id = ?',
  )
    .bind(enabled ? 1 : 0, id)
    .run()

  return c.json({ ok: true })
})

// ── Delete reminder ───────────────────────────────────────────────────────────
app.delete('/api/reminders/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM scheduled_reminders WHERE id = ?')
    .bind(id)
    .run()
  return c.json({ ok: true })
})

// ── Test push (dev only — remove or gate in production) ───────────────────────
app.post('/api/push/test', zValidator('json', testPushSchema), async (c) => {
  const { endpoint, title = 'Test T1D', body: body_ = 'Test push OK' } = c.req.valid('json')

  const sub = await c.env.DB.prepare(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = ?',
  )
    .bind(endpoint)
    .first<{ id: number; endpoint: string; p256dh: string; auth: string }>()

  if (!sub) return c.json({ error: 'Subscription not found' }, 404)

  const ok = await sendPush(sub, { title, body: body_, url: '/' }, c.env)
  if (!ok) {
    await purgeExpired([sub.id], c.env.DB)
    return c.json({ error: 'Subscription expired — deleted' }, 410)
  }

  return c.json({ ok: true })
})

// ── Cron entrypoint ───────────────────────────────────────────────────────────
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(env))
  },
}
