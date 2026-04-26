import { NavLink } from 'react-router-dom'
import { Home, BookOpen, TrendingUp, Clock, Settings } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Accueil' },
  { to: '/log', icon: BookOpen, label: 'Journal' },
  { to: '/charts', icon: TrendingUp, label: 'Courbes' },
  { to: '/history', icon: Clock, label: 'Historique' },
  { to: '/settings', icon: Settings, label: 'Réglages' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderTop: '1px solid var(--color-border)',
        paddingBottom: 'var(--safe-area-bottom)',
        height: 'calc(var(--bottom-nav-height) + var(--safe-area-bottom))',
      }}
    >
      <div className="flex items-start justify-around pt-2 h-16">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center px-3 rounded-lg transition-colors ${
                isActive
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)]'
              }`
            }
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
