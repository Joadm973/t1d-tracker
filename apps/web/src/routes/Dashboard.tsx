import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { Plus, Droplets, Syringe, UtensilsCrossed, Bell } from 'lucide-react'
import { subHours, subDays, isAfter } from 'date-fns'
import confetti from 'canvas-confetti'
import Header from '@/components/layout/Header'
import GlucoseSparkline from '@/components/charts/GlucoseSparkline'
import TIRBar from '@/components/charts/TIRBar'
import GlucoseMascot from '@/components/GlucoseMascot'
import { db } from '@/db/schema'
import { useSettingsStore } from '@/stores/settings'
import { calculateTIR, glucoseColor, glucoseZone, trendArrow } from '@/lib/calculations'
import { formatGlucose, formatRelative } from '@/lib/utils'
import { useStreak } from '@/hooks/useStreak'
import { motion } from 'framer-motion'

export default function Dashboard() {
  const unit = useSettingsStore((s) => s.unit)
  const navigate = useNavigate()
  const { streak, showCrown } = useStreak()

  const cutoff3h = subHours(new Date(), 3)
  const cutoffToday = subDays(new Date(), 1)

  const recentReadings = useLiveQuery(
    () => db.glucoseReadings.where('timestamp').above(cutoff3h).sortBy('timestamp'),
    [],
  )

  const todayReadings = useLiveQuery(
    () => db.glucoseReadings.where('timestamp').above(cutoffToday).sortBy('timestamp'),
    [],
  )

  const lastMeal = useLiveQuery(
    () => db.mealLogs.orderBy('timestamp').last(),
    [],
  )

  const lastDose = useLiveQuery(
    () => db.insulinDoses.orderBy('timestamp').last(),
    [],
  )

  const nextReminder = useLiveQuery(
    () => db.reminders.where('enabled').equals(1).first(),
    [],
  )

  const latest = recentReadings?.[recentReadings.length - 1]
  const isStale = latest ? !isAfter(new Date(latest.timestamp), cutoff3h) : true
  const tir = calculateTIR((todayReadings ?? []).map((r) => r.value))

  const displayValue = latest
    ? formatGlucose(latest.value, unit)
    : '--'

  const mascotZone = !latest || isStale
    ? 'no-data'
    : glucoseZone(latest.value) === 'in-range'
      ? 'in-range'
      : (glucoseZone(latest.value) === 'low' || glucoseZone(latest.value) === 'very-low')
        ? 'low'
        : 'high'

  // Fire confetti when a new in-range reading arrives
  const prevLatestId = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!latest?.id) return
    if (prevLatestId.current === latest.id) return
    prevLatestId.current = latest.id
    if (glucoseZone(latest.value) === 'in-range') {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.4 } })
    }
  }, [latest?.id, latest?.value])

  return (
    <div className="flex flex-col min-h-full">
      <Header title="T1D Tracker" />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Animated mascot */}
        <GlucoseMascot zone={mascotZone} streak={streak} showCrown={showCrown} />

        {/* Main glucose card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 shadow-sm"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Glycémie actuelle
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-6xl font-bold tabular-nums leading-none"
                  style={{ color: latest && !isStale ? glucoseColor(latest.value) : 'var(--color-text-muted)' }}
                >
                  {displayValue}
                </span>
                <span className="text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {unit}
                </span>
              </div>
            </div>
            <div className="text-4xl font-light" style={{ color: latest ? glucoseColor(latest.value) : 'var(--color-text-muted)' }}>
              {recentReadings && recentReadings.length >= 2 ? trendArrow(recentReadings.map((r) => ({ value: r.value, timestamp: new Date(r.timestamp) }))) : '—'}
            </div>
          </div>

          {latest && (
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {isStale ? 'Aucune mesure récente' : formatRelative(latest.timestamp)} ·{' '}
              <span style={{ color: glucoseColor(latest.value) }}>
                {glucoseZone(latest.value).replace('-', ' ')}
              </span>
            </p>
          )}

          {/* Sparkline */}
          <GlucoseSparkline readings={recentReadings ?? []} height={64} />
        </motion.div>

        {/* TIR today */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl p-4 shadow-sm"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Temps dans la cible — Aujourd'hui
          </p>
          <TIRBar tir={tir} showLabels />
          <div className="flex justify-between mt-2">
            <span className="text-xs" style={{ color: 'var(--color-tir-low)' }}>
              Bas {(tir.veryLow + tir.low).toFixed(0)}%
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-tir-in-range)' }}>
              In-range {tir.inRange.toFixed(0)}%
            </span>
            <span className="text-xs" style={{ color: 'var(--color-tir-high)' }}>
              Haut {(tir.high + tir.veryHigh).toFixed(0)}%
            </span>
          </div>
        </motion.div>

        {/* Quick info cards */}
        <div className="grid grid-cols-3 gap-3">
          <InfoCard
            icon={<UtensilsCrossed size={16} />}
            label="Dernier repas"
            value={lastMeal ? `${lastMeal.carbs}g` : '--'}
            sub={lastMeal ? formatRelative(lastMeal.timestamp) : 'Aucun'}
            color="var(--color-glucose-in-range)"
          />
          <InfoCard
            icon={<Syringe size={16} />}
            label="Dernière insuline"
            value={lastDose ? `${lastDose.units}U` : '--'}
            sub={lastDose ? formatRelative(lastDose.timestamp) : 'Aucune'}
            color="var(--color-primary)"
          />
          <InfoCard
            icon={<Bell size={16} />}
            label="Prochain rappel"
            value={nextReminder ? nextReminder.time : '--'}
            sub={nextReminder ? nextReminder.label : 'Aucun'}
            color="var(--color-glucose-high)"
          />
        </div>

        {/* Empty state if no data */}
        {(recentReadings ?? []).length === 0 && (
          <div
            className="rounded-2xl p-6 text-center border-2 border-dashed"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <Droplets size={32} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Aucune mesure enregistrée
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Appuyez sur + pour enregistrer votre première glycémie
            </p>
          </div>
        )}

        {/* Dummy spacer so FAB doesn't overlap */}
        <div className="h-4" />
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/log')}
        className="fixed bottom-[calc(var(--bottom-nav-height)+var(--safe-area-bottom)+16px)] right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-10"
        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
        aria-label="Enregistrer"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>
    </div>
  )
}

function InfoCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-1 mb-0.5" style={{ color }}>
        {icon}
        <span className="text-[10px] font-medium truncate" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      </div>
      <p className="text-base font-bold leading-none" style={{ color: 'var(--color-text)' }}>
        {value}
      </p>
      <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
        {sub}
      </p>
    </div>
  )
}
