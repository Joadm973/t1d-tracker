export type Bindings = {
  DB: D1Database
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  CORS_ORIGIN: string
}

export type PushSubRow = {
  id: number
  endpoint: string
  p256dh: string
  auth: string
}

export type ReminderRow = {
  id: number
  subscription_id: number
  label: string
  time: string
  days: string
  type: string
  enabled: number
  timezone: string
}
