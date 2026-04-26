import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BottomNav from '@/components/layout/BottomNav'
import DisclaimerModal from '@/components/DisclaimerModal'
import Dashboard from '@/routes/Dashboard'
import Log from '@/routes/Log'
import Charts from '@/routes/Charts'
import History from '@/routes/History'
import SettingsRoute from '@/routes/Settings'
import { useSettingsStore } from '@/stores/settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, gcTime: 1000 * 60 * 60 * 24 },
  },
})

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else if (theme === 'light') {
      root.setAttribute('data-theme', 'light')
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      root.setAttribute('data-theme', mq.matches ? 'dark' : 'light')
      const handler = (e: MediaQueryListEvent) =>
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <div className="flex flex-col min-h-svh max-w-lg mx-auto relative">
            <main className="flex-1 pb-safe">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/log" element={<Log />} />
                <Route path="/charts" element={<Charts />} />
                <Route path="/history" element={<History />} />
                <Route path="/settings" element={<SettingsRoute />} />
              </Routes>
            </main>
            <BottomNav />
          </div>
          <DisclaimerModal />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
