import { create } from 'zustand'

interface UIState {
  showDisclaimer: boolean
  activeLogTab: 'glucose' | 'insulin' | 'meal' | 'note'
  setShowDisclaimer: (show: boolean) => void
  setActiveLogTab: (tab: UIState['activeLogTab']) => void
}

export const useUIStore = create<UIState>((set) => ({
  showDisclaimer: true,
  activeLogTab: 'glucose',
  setShowDisclaimer: (show) => set({ showDisclaimer: show }),
  setActiveLogTab: (tab) => set({ activeLogTab: tab }),
}))
