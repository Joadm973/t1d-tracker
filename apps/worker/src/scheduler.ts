import { broadcastPush, purgeExpired } from './push.js'
import type { DbSubscription } from './push.js'

interface ReminderRow {
  id: number
  subscription_id: number
  label: string
  type: string
  time: string        // "HH:MM"
  days: string        // JSON "[1,2,3,4,5]"
  timezone: string
  // endpoint / keys joined from push_subscriptions
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Returns "HH:MM" in the given IANA timezone for a UTC Date.
 * Falls back to "00:00" if the timezone is invalid.
 */
function localHHMM(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date)
    const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
    const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
    return `${h}:${m}`
  } catch {
    return '00:00'
  }
}

/**
 * Returns the ISO weekday (1=Mon … 7=Sun) in the given timezone.
 */
function localWeekday(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
    }).formatToParts(date)
    const name = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
    const map: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    }
    return map[name] ?? 1
  } catch {
    return 1
  }
}

const LABEL: Record<string, string> = {
  glucose_check: 'Mesure de glycémie',
  injection: 'Injection d\'insuline',
  meal: 'Heure du repas',
  custom: 'Rappel',
}

export async function handleScheduled(env: Env): Promise<void> {
  const now = new Date()

  // Fetch all enabled reminders joined with their subscription
  const { results } = await env.DB.prepare(`
    SELECT
      r.id, r.subscription_id, r.label, r.type, r.days, r.timezone,
      s.endpoint, s.p256dh, s.auth
    FROM scheduled_reminders r
    JOIN push_subscriptions s ON s.id = r.subscription_id
    WHERE r.enabled = 1
  `).all<ReminderRow>()

  // Group by timezone so we only call localHHMM / localWeekday once per tz
  const tzCache = new Map<string, { hhmm: string; weekday: number }>()
  const getTz = (tz: string) => {
    if (!tzCache.has(tz)) {
      tzCache.set(tz, { hhmm: localHHMM(now, tz), weekday: localWeekday(now, tz) })
    }
    return tzCache.get(tz)!
  }

  // Collect subs to notify, keyed by unique payload string to allow batching
  const batches = new Map<string, { subs: DbSubscription[]; label: string; type: string }>()

  for (const row of results) {
    const { hhmm, weekday } = getTz(row.timezone)

    // Current minute must match reminder time
    if (row.time !== hhmm) continue

    // Current weekday must be in the reminder's days array
    let days: number[]
    try { days = JSON.parse(row.days) as number[] } catch { continue }
    if (!days.includes(weekday)) continue

    const key = `${row.label}|${row.type}`
    if (!batches.has(key)) {
      batches.set(key, { subs: [], label: row.label, type: row.type })
    }
    batches.get(key)!.subs.push({
      id: row.subscription_id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
    })
  }

  // Send all batches and purge expired subscriptions
  for (const { subs, label, type } of batches.values()) {
    const title = LABEL[type] ?? 'T1D Tracker'
    const expired = await broadcastPush(
      subs,
      { title, body: label, url: '/log' },
      env,
    )
    await purgeExpired(expired, env.DB)
  }
}
