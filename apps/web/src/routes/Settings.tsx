import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, AlertTriangle, Download, Bell, BellRing } from 'lucide-react'
import Header from '@/components/layout/Header'
import { db } from '@/db/schema'
import type { Reminder } from '@/db/schema'
import { useSettingsStore } from '@/stores/settings'
import type { GlucoseUnit } from '@/stores/settings'
import { mgToMmol } from '@/lib/calculations'
import {
  workerCreateReminder,
  workerToggleReminder,
  workerDeleteReminder,
} from '@/lib/worker'
import { usePushSubscription } from '@/hooks/usePushSubscription'

const DISCLAIMER =
  "Cette application est un outil de suivi personnel uniquement. Elle n'est pas un dispositif médical et ne remplace pas les conseils de votre équipe soignante. Ne l'utilisez pas pour prendre des décisions de traitement en cas d'hypoglycémie sévère ou d'urgence médicale."

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ── CSV export ────────────────────────────────────────────────────────────────
async function exportCSV() {
  const glucose = await db.glucoseReadings.orderBy('timestamp').toArray()
  const insulin = await db.insulinDoses.orderBy('timestamp').toArray()
  const meals = await db.mealLogs.orderBy('timestamp').toArray()
  const notes = await db.noteEntries.orderBy('timestamp').toArray()

  const disclaimer = `# ${DISCLAIMER}\n#\n`
  const header = 'type,timestamp,valeur,detail,note\n'
  const csv =
    disclaimer +
    header +
    [
      ...glucose.map((r) => `glycémie,${new Date(r.timestamp).toISOString()},${r.value}mg/dL,${r.source},${r.notes ?? ''}`),
      ...insulin.map((r) => `insuline,${new Date(r.timestamp).toISOString()},${r.units}U,${r.type},${r.notes ?? ''}`),
      ...meals.map((r) => `repas,${new Date(r.timestamp).toISOString()},${r.carbs}g,${r.description ?? ''},${r.glycemicIndex ?? ''}`),
      ...notes.map((r) => `note,${new Date(r.timestamp).toISOString()},,,"${r.content.replace(/"/g, '""')}"`),
    ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `t1d-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-wider px-4 mb-2 mt-6"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {children}
    </p>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-4 rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {children}
    </div>
  )
}

function Row({ label, sub, right }: { label: string; sub?: string; right: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 min-h-[52px]"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{label}</p>
        {sub && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-12 h-7 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center"
      style={{ backgroundColor: value ? 'var(--color-primary)' : 'var(--color-border)' }}
      role="switch"
      aria-checked={value}
    >
      <span
        className="absolute w-5 h-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: value ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

// ── Reminder row ──────────────────────────────────────────────────────────────
function ReminderRow({
  reminder,
  subscriptionEndpoint,
}: {
  reminder: Reminder
  subscriptionEndpoint: string | null
}) {
  const toggle = async () => {
    if (reminder.id === undefined) return
    const next = !reminder.enabled
    await db.reminders.update(reminder.id, { enabled: next })
    if (reminder.workerReminderId && subscriptionEndpoint) {
      workerToggleReminder(reminder.workerReminderId, next).catch(console.error)
    }
  }

  const remove = async () => {
    if (reminder.id === undefined) return
    if (reminder.workerReminderId) {
      workerDeleteReminder(reminder.workerReminderId).catch(console.error)
    }
    await db.reminders.delete(reminder.id)
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 min-h-[56px]"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
            {reminder.label}
          </p>
          {reminder.workerReminderId ? (
            <BellRing size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          ) : null}
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {reminder.time} · {reminder.days.map((d) => DAY_LABELS[d - 1]).join(', ')}
        </p>
      </div>
      <Toggle value={reminder.enabled} onChange={toggle} />
      <button
        onClick={remove}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Supprimer"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

// ── Add reminder sheet ────────────────────────────────────────────────────────
type ReminderDraft = Omit<Reminder, 'id' | 'enabled' | 'workerReminderId' | 'pushSubscriptionId'>

function AddReminderSheet({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (draft: ReminderDraft) => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [time, setTime] = useState('08:00')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [type, setType] = useState<Reminder['type']>('glucose_check')
  const [saving, setSaving] = useState(false)

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    )

  const save = async () => {
    if (!label.trim() || saving) return
    setSaving(true)
    try {
      await onSave({ label: label.trim(), time, days, type })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '16px',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-2xl p-6 pb-10 space-y-4"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <h3 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>
          Nouveau rappel
        </h3>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Libellé
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Mesure glycémie…"
            style={inputStyle}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Heure
            </label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Reminder['type'])}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              <option value="glucose_check">Glycémie</option>
              <option value="injection">Injection</option>
              <option value="meal">Repas</option>
              <option value="custom">Autre</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Jours
          </label>
          <div className="flex gap-2">
            {DAY_LABELS.map((d, i) => (
              <button
                key={d}
                onClick={() => toggleDay(i + 1)}
                className="flex-1 py-2 rounded-lg text-xs font-medium min-h-[36px]"
                style={
                  days.includes(i + 1)
                    ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                    : {
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)',
                      }
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-semibold min-h-[44px] transition-opacity disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
        >
          {saving ? 'Enregistrement…' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

// ── Push notifications section ────────────────────────────────────────────────
function PushSection({
  status,
  error,
  isInstalled,
  subscribe,
  unsubscribe,
}: {
  status: ReturnType<typeof usePushSubscription>['status']
  error: string | null
  isInstalled: boolean
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}) {
  const isSubscribed = status === 'subscribed'
  const isLoading = status === 'loading' || status === 'checking'

  if (status === 'unsupported') return null

  if (!isInstalled) {
    return (
      <Card>
        <div className="flex items-start gap-3 px-4 py-3">
          <Bell size={18} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Notifications push
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Installez l'app via Safari → "Ajouter à l'écran d'accueil" pour activer les notifications.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <Row
        label="Notifications push"
        sub={
          status === 'denied'
            ? 'Refusées — modifiez dans Réglages iOS'
            : isSubscribed
            ? 'Activées'
            : 'Désactivées'
        }
        right={
          isLoading ? (
            <div
              className="w-8 h-4 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--color-border)' }}
            />
          ) : (
            <Toggle
              value={isSubscribed}
              onChange={isSubscribed ? unsubscribe : subscribe}
            />
          )
        }
      />
      {error && (
        <p className="px-4 pb-3 text-xs" style={{ color: 'var(--color-glucose-low)' }}>
          {error}
        </p>
      )}
    </Card>
  )
}

// ── Main route ────────────────────────────────────────────────────────────────
export default function Settings() {
  const { unit, setUnit, targetLow, targetHigh, setTargets, theme, setTheme } = useSettingsStore()
  const reminders = useLiveQuery(() => db.reminders.orderBy('time').toArray(), [])
  const [showAddReminder, setShowAddReminder] = useState(false)

  const { status, subscription, error, isInstalled, subscribe, unsubscribe } =
    usePushSubscription()

  const handleAddReminder = async (draft: ReminderDraft) => {
    const id = await db.reminders.add({ ...draft, enabled: true })
    if (subscription) {
      try {
        const workerId = await workerCreateReminder({
          subscriptionEndpoint: subscription.endpoint,
          label: draft.label,
          type: draft.type,
          time: draft.time,
          days: draft.days,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        if (workerId) await db.reminders.update(id, { workerReminderId: workerId })
      } catch (err) {
        console.error('Worker reminder sync failed:', err)
      }
    }
  }

  const unitOptions: { value: GlucoseUnit; label: string }[] = [
    { value: 'mg/dL', label: 'mg/dL' },
    { value: 'mmol/L', label: 'mmol/L' },
  ]

  const themeOptions = [
    { value: 'system', label: 'Auto' },
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
  ] as const

  return (
    <div className="flex flex-col min-h-full pb-8">
      <Header title="Réglages" />

      {/* Affichage */}
      <SectionTitle>Affichage</SectionTitle>
      <Card>
        <Row
          label="Unités glycémie"
          right={
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              {unitOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setUnit(o.value)}
                  className="px-3 py-2 text-xs font-medium min-h-[36px]"
                  style={
                    unit === o.value
                      ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                      : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          }
        />
        <Row
          label="Thème"
          right={
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              {themeOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setTheme(o.value)}
                  className="px-3 py-2 text-xs font-medium min-h-[36px]"
                  style={
                    theme === o.value
                      ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                      : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          }
        />
      </Card>

      {/* Cibles glycémiques */}
      <SectionTitle>Cibles glycémiques</SectionTitle>
      <Card>
        <Row
          label="Cible basse"
          sub={unit === 'mmol/L' ? `${mgToMmol(targetLow)} mmol/L` : undefined}
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTargets(Math.max(54, targetLow - 5), targetHigh)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >−</button>
              <span className="text-sm font-semibold w-10 text-center" style={{ color: 'var(--color-text)' }}>
                {targetLow}
              </span>
              <button
                onClick={() => setTargets(Math.min(targetHigh - 10, targetLow + 5), targetHigh)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >+</button>
            </div>
          }
        />
        <div style={{ borderBottom: 'none' }}>
          <Row
            label="Cible haute"
            sub={unit === 'mmol/L' ? `${mgToMmol(targetHigh)} mmol/L` : undefined}
            right={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTargets(targetLow, Math.max(targetLow + 10, targetHigh - 5))}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                >−</button>
                <span className="text-sm font-semibold w-10 text-center" style={{ color: 'var(--color-text)' }}>
                  {targetHigh}
                </span>
                <button
                  onClick={() => setTargets(targetLow, Math.min(400, targetHigh + 5))}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                >+</button>
              </div>
            }
          />
        </div>
      </Card>

      {/* Notifications push */}
      <SectionTitle>Notifications</SectionTitle>
      <PushSection
        status={status}
        error={error}
        isInstalled={isInstalled}
        subscribe={subscribe}
        unsubscribe={unsubscribe}
      />

      {/* Rappels */}
      <SectionTitle>Rappels</SectionTitle>
      <div
        className="mx-4 rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {(reminders ?? []).length === 0 && (
          <p className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Aucun rappel configuré
          </p>
        )}
        {(reminders ?? []).map((r) => (
          <ReminderRow
            key={r.id}
            reminder={r}
            subscriptionEndpoint={subscription?.endpoint ?? null}
          />
        ))}
        <button
          onClick={() => setShowAddReminder(true)}
          className="flex items-center gap-2 px-4 py-3 w-full min-h-[52px] text-sm font-medium"
          style={{ color: 'var(--color-primary)' }}
        >
          <Plus size={16} /> Ajouter un rappel
        </button>
      </div>

      {/* Statut push sur les rappels */}
      {status !== 'subscribed' && status !== 'checking' && status !== 'unsupported' && (
        <p className="px-4 mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {status === 'not-installed'
            ? "Installez l'app pour que les rappels envoient des notifications push."
            : "Activez les notifications pour recevoir les rappels même lorsque l'app est fermée."}
        </p>
      )}

      {/* Export */}
      <SectionTitle>Données</SectionTitle>
      <Card>
        <button
          onClick={exportCSV}
          className="flex items-center gap-3 px-4 py-3 w-full min-h-[52px]"
        >
          <Download size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Exporter CSV
          </span>
        </button>
      </Card>

      {/* À propos */}
      <SectionTitle>À propos</SectionTitle>
      <div
        className="mx-4 rounded-2xl p-4 flex gap-3"
        style={{ backgroundColor: '#FFF3CD', border: '1px solid #FFE08A' }}
      >
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#856404' }} />
        <p className="text-xs leading-relaxed" style={{ color: '#856404' }}>
          {DISCLAIMER}
        </p>
      </div>

      {showAddReminder && (
        <AddReminderSheet
          onClose={() => setShowAddReminder(false)}
          onSave={handleAddReminder}
        />
      )}
    </div>
  )
}
