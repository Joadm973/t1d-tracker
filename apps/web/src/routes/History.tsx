import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Droplets, Syringe, Utensils, FileText, Trash2, X } from 'lucide-react'
import Header from '@/components/layout/Header'
import { db } from '@/db/schema'
import type { GlucoseReading, InsulinDose, MealLog, NoteEntry } from '@/db/schema'
import { useSettingsStore } from '@/stores/settings'
import { glucoseColor } from '@/lib/calculations'
import { formatGlucose, formatDate, formatTime } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'

type Filter = 'all' | 'glucose' | 'insulin' | 'meal' | 'note'

interface EventItem {
  id: string
  timestamp: Date
  type: 'glucose' | 'insulin' | 'meal' | 'note'
  data: GlucoseReading | InsulinDose | MealLog | NoteEntry
}

const filters: { id: Filter; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'Tout', icon: null },
  { id: 'glucose', label: 'Glycémie', icon: <Droplets size={12} /> },
  { id: 'insulin', label: 'Insuline', icon: <Syringe size={12} /> },
  { id: 'meal', label: 'Repas', icon: <Utensils size={12} /> },
  { id: 'note', label: 'Notes', icon: <FileText size={12} /> },
]

function useAllEvents(): EventItem[] {
  const glucose = useLiveQuery(() => db.glucoseReadings.orderBy('timestamp').reverse().limit(200).toArray(), [])
  const insulin = useLiveQuery(() => db.insulinDoses.orderBy('timestamp').reverse().limit(200).toArray(), [])
  const meals = useLiveQuery(() => db.mealLogs.orderBy('timestamp').reverse().limit(200).toArray(), [])
  const notes = useLiveQuery(() => db.noteEntries.orderBy('timestamp').reverse().limit(200).toArray(), [])

  const events: EventItem[] = [
    ...(glucose ?? []).map((d) => ({ id: `g-${d.id}`, timestamp: new Date(d.timestamp), type: 'glucose' as const, data: d })),
    ...(insulin ?? []).map((d) => ({ id: `i-${d.id}`, timestamp: new Date(d.timestamp), type: 'insulin' as const, data: d })),
    ...(meals ?? []).map((d) => ({ id: `m-${d.id}`, timestamp: new Date(d.timestamp), type: 'meal' as const, data: d })),
    ...(notes ?? []).map((d) => ({ id: `n-${d.id}`, timestamp: new Date(d.timestamp), type: 'note' as const, data: d })),
  ]

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

function deleteEvent(event: EventItem) {
  const numId = (event.data as { id?: number }).id
  if (!numId) return
  if (event.type === 'glucose') db.glucoseReadings.delete(numId)
  else if (event.type === 'insulin') db.insulinDoses.delete(numId)
  else if (event.type === 'meal') db.mealLogs.delete(numId)
  else db.noteEntries.delete(numId)
}

function EventRow({ event, onDelete }: { event: EventItem; onDelete: () => void }) {
  const unit = useSettingsStore((s) => s.unit)

  const icon = {
    glucose: <Droplets size={16} />,
    insulin: <Syringe size={16} />,
    meal: <Utensils size={16} />,
    note: <FileText size={16} />,
  }[event.type]

  const iconColor = {
    glucose: glucoseColor((event.data as GlucoseReading).value ?? 0),
    insulin: 'var(--color-primary)',
    meal: 'var(--color-glucose-in-range)',
    note: 'var(--color-text-muted)',
  }[event.type]

  const summary = () => {
    if (event.type === 'glucose') {
      const d = event.data as GlucoseReading
      return `${formatGlucose(d.value, unit)} ${unit}`
    }
    if (event.type === 'insulin') {
      const d = event.data as InsulinDose
      return `${d.units}U · ${d.type}`
    }
    if (event.type === 'meal') {
      const d = event.data as MealLog
      return `${d.carbs}g${d.description ? ` · ${d.description}` : ''}`
    }
    const d = event.data as NoteEntry
    return d.content.slice(0, 60)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-3 px-4 py-3 min-h-[56px]"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${iconColor}22`, color: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
          {summary()}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {formatDate(event.timestamp)} · {formatTime(event.timestamp)}
        </p>
      </div>
      <button
        onClick={onDelete}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Supprimer"
      >
        <Trash2 size={16} />
      </button>
    </motion.div>
  )
}

export default function History() {
  const [activeFilter, setActiveFilter] = useState<Filter>('all')
  const [confirmDelete, setConfirmDelete] = useState<EventItem | null>(null)
  const allEvents = useAllEvents()

  const filtered = activeFilter === 'all' ? allEvents : allEvents.filter((e) => e.type === activeFilter)

  // Group by date label
  const grouped: { date: string; events: EventItem[] }[] = []
  for (const event of filtered) {
    const date = formatDate(event.timestamp)
    const last = grouped[grouped.length - 1]
    if (last?.date === date) {
      last.events.push(event)
    } else {
      grouped.push({ date, events: [event] })
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Historique" />

      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap min-h-[32px] flex-shrink-0"
            style={
              activeFilter === f.id
                ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
            }
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1" style={{ backgroundColor: 'var(--color-bg)' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Aucun événement</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {grouped.map(({ date, events }) => (
              <div key={date}>
                <div
                  className="px-4 py-2 text-xs font-semibold sticky top-14"
                  style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}
                >
                  {date}
                </div>
                {events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onDelete={() => setConfirmDelete(event)}
                  />
                ))}
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Delete confirmation bottom sheet */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-2xl p-6 pb-10 space-y-4"
              style={{ backgroundColor: 'var(--color-bg)' }}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Supprimer cet événement ?</h3>
                <button onClick={() => setConfirmDelete(null)} className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <X size={20} style={{ color: 'var(--color-text-muted)' }} />
                </button>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Cette action est irréversible.</p>
              <button
                className="w-full py-3 rounded-xl text-sm font-semibold min-h-[44px]"
                style={{ backgroundColor: '#E53935', color: '#fff' }}
                onClick={() => { deleteEvent(confirmDelete); setConfirmDelete(null) }}
              >
                Supprimer
              </button>
              <button
                className="w-full py-3 rounded-xl text-sm font-medium min-h-[44px]"
                style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                onClick={() => setConfirmDelete(null)}
              >
                Annuler
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
