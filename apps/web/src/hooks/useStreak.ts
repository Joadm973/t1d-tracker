import { useLiveQuery } from 'dexie-react-hooks'
import { subDays, startOfDay, format } from 'date-fns'
import { db } from '@/db/schema'
import { calculateTIR } from '@/lib/calculations'

export function useStreak() {
  const streak = useLiveQuery(async () => {
    const cutoff = subDays(new Date(), 30)
    const readings = await db.glucoseReadings
      .where('timestamp')
      .above(cutoff)
      .sortBy('timestamp')

    if (readings.length === 0) return 0

    // Group readings by day
    const byDay = new Map<string, number[]>()
    for (const r of readings) {
      const day = format(startOfDay(new Date(r.timestamp)), 'yyyy-MM-dd')
      const arr = byDay.get(day) ?? []
      arr.push(r.value)
      byDay.set(day, arr)
    }

    // Walk backwards from yesterday, counting consecutive days with TIR >= 70%
    let count = 0
    let cursor = startOfDay(new Date())
    // Start from today and go back
    for (let i = 0; i < 30; i++) {
      const day = format(subDays(cursor, i), 'yyyy-MM-dd')
      const values = byDay.get(day)
      if (!values || values.length === 0) break
      const tir = calculateTIR(values)
      if (tir.inRange >= 70) {
        count++
      } else {
        break
      }
    }

    return count
  }, []) ?? 0

  return { streak, showCrown: streak >= 7 }
}
