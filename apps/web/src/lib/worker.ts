const BASE_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) ?? ''

function isConfigured(): boolean {
  return BASE_URL.length > 0
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

export async function getVapidPublicKey(): Promise<string> {
  const data = await apiFetch<{ publicKey: string }>('/api/push/vapid-public-key')
  return data.publicKey
}

export async function workerSubscribe(
  sub: PushSubscription,
  userAgent: string,
): Promise<void> {
  if (!isConfigured()) return
  const json = sub.toJSON() as {
    endpoint: string
    keys: { auth: string; p256dh: string }
  }
  await apiFetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  })
}

export async function workerUnsubscribe(endpoint: string): Promise<void> {
  if (!isConfigured()) return
  await apiFetch('/api/push/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  })
}

export interface WorkerReminderInput {
  subscriptionEndpoint: string
  label: string
  type: 'glucose_check' | 'injection' | 'meal' | 'custom'
  time: string
  days: number[]
  timezone: string
}

export async function workerCreateReminder(data: WorkerReminderInput): Promise<number> {
  if (!isConfigured()) return 0
  const result = await apiFetch<{ ok: boolean; id: number }>('/api/reminders', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return result.id
}

export async function workerToggleReminder(
  workerId: number,
  enabled: boolean,
): Promise<void> {
  if (!isConfigured() || workerId === 0) return
  await apiFetch(`/api/reminders/${workerId}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  })
}

export async function workerDeleteReminder(workerId: number): Promise<void> {
  if (!isConfigured() || workerId === 0) return
  await apiFetch(`/api/reminders/${workerId}`, { method: 'DELETE' })
}
