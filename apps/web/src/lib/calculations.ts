import type { InsulinDose } from '@/db/schema'

export const calculateGMI = (avgGlucose: number): number =>
  3.31 + 0.02392 * avgGlucose

export const calculateTIR = (readings: number[]) => {
  if (readings.length === 0) return { veryLow: 0, low: 0, inRange: 0, high: 0, veryHigh: 0 }
  const n = readings.length
  return {
    veryLow:  (readings.filter(v => v < 54).length / n) * 100,
    low:      (readings.filter(v => v >= 54 && v < 70).length / n) * 100,
    inRange:  (readings.filter(v => v >= 70 && v <= 180).length / n) * 100,
    high:     (readings.filter(v => v > 180 && v <= 250).length / n) * 100,
    veryHigh: (readings.filter(v => v > 250).length / n) * 100,
  }
}

// OpenAPS exponential model: peak 75 min, DIA 5h
export const calculateIOB = (doses: InsulinDose[], now: Date): number => {
  const DIA_MS = 5 * 60 * 60 * 1000
  const PEAK_MS = 75 * 60 * 1000

  return doses
    .filter(d => d.type !== 'basal')
    .reduce((total, dose) => {
      const elapsed = now.getTime() - new Date(dose.timestamp).getTime()
      if (elapsed < 0 || elapsed >= DIA_MS) return total
      const t = elapsed / DIA_MS
      const peak = PEAK_MS / DIA_MS
      const activity = t < peak
        ? t / peak
        : (1 - t) / (1 - peak)
      const remaining = 1 - (activity * (elapsed / DIA_MS))
      return total + dose.units * Math.max(0, remaining)
    }, 0)
}

export const mgToMmol = (mg: number): number => Math.round((mg / 18.018) * 10) / 10
export const mmolToMg = (mmol: number): number => Math.round(mmol * 18.018)

export const glucoseZone = (value: number): 'very-low' | 'low' | 'in-range' | 'high' | 'very-high' => {
  if (value < 54) return 'very-low'
  if (value < 70) return 'low'
  if (value <= 180) return 'in-range'
  if (value <= 250) return 'high'
  return 'very-high'
}

export const glucoseColor = (value: number): string => {
  const zone = glucoseZone(value)
  return `var(--color-glucose-${zone})`
}

export const trendArrow = (readings: { value: number; timestamp: Date }[]): string => {
  if (readings.length < 2) return '→'
  const sorted = [...readings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const recent = sorted.slice(-3)
  const delta = recent[recent.length - 1].value - recent[0].value
  if (delta > 10) return '↑↑'
  if (delta > 5) return '↑'
  if (delta > 2) return '↗'
  if (delta < -10) return '↓↓'
  if (delta < -5) return '↓'
  if (delta < -2) return '↘'
  return '→'
}
