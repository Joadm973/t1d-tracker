import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { fr } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: Date | string): string {
  return format(new Date(date), 'HH:mm')
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  if (isToday(d)) return "Aujourd'hui"
  if (isYesterday(d)) return 'Hier'
  return format(d, 'd MMM', { locale: fr })
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
}

export function formatGlucose(value: number, unit: 'mg/dL' | 'mmol/L'): string {
  if (unit === 'mmol/L') {
    return (value / 18.018).toFixed(1)
  }
  return Math.round(value).toString()
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function generateMockGlucoseData(hours = 3): { timestamp: Date; value: number }[] {
  const now = new Date()
  const data: { timestamp: Date; value: number }[] = []
  let value = 120

  for (let i = hours * 60; i >= 0; i -= 5) {
    const ts = new Date(now.getTime() - i * 60 * 1000)
    value += (Math.random() - 0.45) * 8
    value = clamp(value, 60, 280)
    data.push({ timestamp: ts, value: Math.round(value) })
  }
  return data
}
