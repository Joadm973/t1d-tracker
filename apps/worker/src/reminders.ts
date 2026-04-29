import { Hono } from 'hono'
import type { Bindings, ReminderRow } from './types'

export const reminderRoutes = new Hono<{ Bindings: Bindings }>()

type ReminderBody = {
  endpoint: string
  label: string
  time: string       // "HH:MM"
  days: number[]     // [1-7] (1=Lun…7=Dim)
  type: string
  timezone?: string
  enabled?: boolean
}

// POST /api/reminders — créer un rappel lié à un abonnement push
reminderRoutes.post('/', async (c) => {
  const body = await c.req.json<ReminderBody>()

  if (!body.endpoint || !body.label || !body.time || !body.days?.length) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const sub = await c.env.DB.prepare(
    'SELECT id FROM push_subscriptions WHERE endpoint = ?'
  )
    .bind(body.endpoint)
    .first<{ id: number }>()

  if (!sub) return c.json({ error: 'Subscription not found' }, 404)

  const result = await c.env.DB.prepare(
    `INSERT INTO scheduled_reminders (subscription_id, label, time, days, type, timezone)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      sub.id,
      body.label,
      body.time,
      JSON.stringify(body.days),
      body.type ?? 'custom',
      body.timezone ?? 'Europe/Paris',
    )
    .run()

  return c.json({ id: result.meta.last_row_id }, 201)
})

// PUT /api/reminders/:id — mettre à jour un rappel
reminderRoutes.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<ReminderBody> & { enabled?: boolean }>()

  const existing = await c.env.DB.prepare(
    'SELECT id FROM scheduled_reminders WHERE id = ?'
  )
    .bind(id)
    .first<ReminderRow>()

  if (!existing) return c.json({ error: 'Reminder not found' }, 404)

  const fields: string[] = []
  const values: (string | number)[] = []

  if (body.label !== undefined) { fields.push('label = ?'); values.push(body.label) }
  if (body.time !== undefined) { fields.push('time = ?'); values.push(body.time) }
  if (body.days !== undefined) { fields.push('days = ?'); values.push(JSON.stringify(body.days)) }
  if (body.type !== undefined) { fields.push('type = ?'); values.push(body.type) }
  if (body.timezone !== undefined) { fields.push('timezone = ?'); values.push(body.timezone) }
  if (body.enabled !== undefined) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0) }

  if (!fields.length) return c.json({ ok: true })

  await c.env.DB.prepare(
    `UPDATE scheduled_reminders SET ${fields.join(', ')} WHERE id = ?`
  )
    .bind(...values, id)
    .run()

  return c.json({ ok: true })
})

// DELETE /api/reminders/:id — supprimer un rappel
reminderRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))

  await c.env.DB.prepare('DELETE FROM scheduled_reminders WHERE id = ?')
    .bind(id)
    .run()

  return c.json({ ok: true })
})
