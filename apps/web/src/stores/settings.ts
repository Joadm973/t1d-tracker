import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type GlucoseUnit = 'mg/dL' | 'mmol/L'

interface SettingsState {
  unit: GlucoseUnit
  targetLow: number
  targetHigh: number
  theme: 'light' | 'dark' | 'system'
  setUnit: (unit: GlucoseUnit) => void
  setTargets: (low: number, high: number) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      unit: 'mg/dL',
      targetLow: 70,
      targetHigh: 180,
      theme: 'system',
      setUnit: (unit) => set({ unit }),
      setTargets: (low, high) => set({ targetLow: low, targetHigh: high }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 't1d-settings' }
  )
)
