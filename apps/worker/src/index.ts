import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { pushRoutes } from './push'
import { reminderRoutes } from './reminders'
import { handleScheduled } from './scheduler'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

// CORS — autorise uniquement l'origine configurée (ou * en dev)
app.use('*', async (c, next) => {
  const origin = c.env.CORS_ORIGIN || '*'
  return cors({
    origin,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })(c, next)
})

app.route('/api/push', pushRoutes)
app.route('/api/reminders', reminderRoutes)

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }))

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal error' }, 500)
})

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
}
