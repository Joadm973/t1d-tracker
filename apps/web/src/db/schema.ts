import Dexie, { type EntityTable } from 'dexie'

export interface GlucoseReading {
  id?: number
  timestamp: Date
  value: number
  source: 'manual' | 'cgm'
  notes?: string
}

export interface InsulinDose {
  id?: number
  timestamp: Date
  units: number
  type: 'basal' | 'bolus' | 'correction'
  notes?: string
}

export interface MealLog {
  id?: number
  timestamp: Date
  carbs: number
  description?: string
  glycemicIndex?: 'low' | 'medium' | 'high'
}

export interface NoteEntry {
  id?: number
  timestamp: Date
  content: string
}

export interface Reminder {
  id?: number
  type: 'glucose_check' | 'injection' | 'meal' | 'custom'
  label: string
  time: string
  days: number[]
  enabled: boolean
  pushSubscriptionId?: number
}

export interface OutboxItem {
  id?: number
  table: string
  action: 'create' | 'update' | 'delete'
  payload: unknown
  createdAt: Date
  status: 'pending' | 'synced' | 'failed'
}

export interface AppSettings {
  id?: number
  key: string
  value: unknown
}

class T1DDatabase extends Dexie {
  glucoseReadings!: EntityTable<GlucoseReading, 'id'>
  insulinDoses!: EntityTable<InsulinDose, 'id'>
  mealLogs!: EntityTable<MealLog, 'id'>
  noteEntries!: EntityTable<NoteEntry, 'id'>
  reminders!: EntityTable<Reminder, 'id'>
  outbox!: EntityTable<OutboxItem, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('t1d-tracker')
    this.version(1).stores({
      glucoseReadings: '++id, timestamp, source',
      insulinDoses: '++id, timestamp, type',
      mealLogs: '++id, timestamp',
      noteEntries: '++id, timestamp',
      reminders: '++id, type, enabled',
      outbox: '++id, status, createdAt',
      settings: '++id, &key',
    })
  }
}

export const db = new T1DDatabase()

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const row = await db.settings.where('key').equals(key).first()
  return row ? (row.value as T) : defaultValue
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const existing = await db.settings.where('key').equals(key).first()
  if (existing?.id !== undefined) {
    await db.settings.update(existing.id, { value })
  } else {
    await db.settings.add({ key, value })
  }
}
