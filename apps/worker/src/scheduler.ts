import type { Bindings } from './types'
import { sendNotification } from './push'

type ReminderWithSub = {
  label: string
  time: string
  days: string
  timezone: string
  endpoint: string
  p256dh: string
  auth: string
}

export async function handleScheduled(
  _event: ScheduledEvent,
  env: Bindings,
  ctx: ExecutionContext,
): Promise<void> {
  ctx.waitUntil(runReminders(env))
}

async function runReminders(env: Bindings): Promise<void> {
  const { results } = await env.DB.prepare(`
    SELECT sr.label, sr.time, sr.days, sr.timezone,
           ps.endpoint, ps.p256dh, ps.auth
    FROM scheduled_reminders sr
    JOIN push_subscriptions ps ON ps.id = sr.subscription_id
    WHERE sr.enabled = 1
  `).all<ReminderWithSub>()

  const due = results.filter((r) => shouldFire(r.time, r.days, r.timezone))

  await Promise.allSettled(
    due.map((r) =>
      sendNotification(
        { endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth },
        { title: 'T1D Tracker', body: r.label, url: '/' },
        env,
      )
    )
  )
}

function shouldFire(time: string, daysJson: string, timezone: string): boolean {
  const now = new Date()

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now)

  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'

  const currentTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  // Tracker: 1=Lun, 2=Mar, …, 6=Sam, 7=Dim
  const weekdayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  }
  const dayOfWeek = weekdayMap[weekday] ?? 1

  let days: number[]
  try {
    days = JSON.parse(daysJson) as number[]
  } catch {
    return false
  }

  return currentTime === time && days.includes(dayOfWeek)
}
