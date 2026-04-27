import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Droplets, Syringe, Utensils, FileText, ArrowLeft, Check } from 'lucide-react'
import Header from '@/components/layout/Header'
import { db } from '@/db/schema'
import { useSettingsStore } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'
import { mmolToMg } from '@/lib/calculations'
import { motion, AnimatePresence } from 'framer-motion'

type Tab = 'glucose' | 'insulin' | 'meal' | 'note'

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'glucose', label: 'Glycémie', icon: <Droplets size={16} /> },
  { id: 'insulin', label: 'Insuline', icon: <Syringe size={16} /> },
  { id: 'meal', label: 'Repas', icon: <Utensils size={16} /> },
  { id: 'note', label: 'Note', icon: <FileText size={16} /> },
]

// ── Schemas ──────────────────────────────────────────────────────────────────
const glucoseSchema = z.object({
  value: z.string().min(1, 'Requis').refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Valeur invalide'),
  notes: z.string().optional(),
  timestamp: z.string(),
})
const insulinSchema = z.object({
  units: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Requis'),
  type: z.enum(['basal', 'bolus', 'correction']),
  notes: z.string().optional(),
  timestamp: z.string(),
})
const mealSchema = z.object({
  carbs: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 0, 'Requis'),
  description: z.string().optional(),
  glycemicIndex: z.enum(['low', 'medium', 'high']).optional(),
  timestamp: z.string(),
})
const noteSchema = z.object({
  content: z.string().min(1, 'Requis'),
  timestamp: z.string(),
})

type GlucoseForm = z.infer<typeof glucoseSchema>
type InsulinForm = z.infer<typeof insulinSchema>
type MealForm = z.infer<typeof mealSchema>
type NoteForm = z.infer<typeof noteSchema>

function nowLocal(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

// ── Sub-forms ─────────────────────────────────────────────────────────────────
function GlucoseFormView({ onSaved }: { onSaved: () => void }) {
  const unit = useSettingsStore((s) => s.unit)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<GlucoseForm>({
    resolver: zodResolver(glucoseSchema),
    defaultValues: { timestamp: nowLocal(), notes: '' },
  })

  const onSubmit = async (data: GlucoseForm) => {
    const raw = Number(data.value)
    const mgValue = unit === 'mmol/L' ? mmolToMg(raw) : raw
    await db.glucoseReadings.add({
      timestamp: new Date(data.timestamp),
      value: mgValue,
      source: 'manual',
      notes: data.notes,
    })
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Glycémie ({unit})
        </label>
        <input
          {...register('value')}
          inputMode="decimal"
          placeholder={unit === 'mg/dL' ? '120' : '6.7'}
          className="input-field"
          style={inputStyle}
        />
        {errors.value && <p className="text-xs text-red-500 mt-1">{errors.value.message}</p>}
      </div>
      <TimestampField register={register} />
      <NotesField register={register} />
      <SubmitBtn isSubmitting={isSubmitting} />
    </form>
  )
}

function InsulinFormView({ onSaved }: { onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<InsulinForm>({
    resolver: zodResolver(insulinSchema),
    defaultValues: { timestamp: nowLocal(), type: 'bolus', notes: '' },
  })

  const onSubmit = async (data: InsulinForm) => {
    await db.insulinDoses.add({
      timestamp: new Date(data.timestamp),
      units: Number(data.units),
      type: data.type,
      notes: data.notes,
    })
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Unités
        </label>
        <input {...register('units')} inputMode="decimal" placeholder="4" className="input-field" style={inputStyle} />
        {errors.units && <p className="text-xs text-red-500 mt-1">{errors.units.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Type</label>
        <select {...register('type')} style={{ ...inputStyle, appearance: 'none' }}>
          <option value="bolus">Bolus (repas)</option>
          <option value="correction">Correction</option>
          <option value="basal">Basal</option>
        </select>
      </div>
      <TimestampField register={register} />
      <NotesField register={register} />
      <SubmitBtn isSubmitting={isSubmitting} />
    </form>
  )
}

function MealFormView({ onSaved }: { onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MealForm>({
    resolver: zodResolver(mealSchema),
    defaultValues: { timestamp: nowLocal(), description: '', glycemicIndex: undefined },
  })

  const onSubmit = async (data: MealForm) => {
    await db.mealLogs.add({
      timestamp: new Date(data.timestamp),
      carbs: Number(data.carbs),
      description: data.description,
      glycemicIndex: data.glycemicIndex,
    })
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Glucides (g)
        </label>
        <input {...register('carbs')} inputMode="decimal" placeholder="45" style={inputStyle} />
        {errors.carbs && <p className="text-xs text-red-500 mt-1">{errors.carbs.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Description</label>
        <input {...register('description')} placeholder="Pâtes, salade…" style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Index glycémique</label>
        <select {...register('glycemicIndex')} style={{ ...inputStyle, appearance: 'none' }}>
          <option value="">Non précisé</option>
          <option value="low">Bas (&lt; 55)</option>
          <option value="medium">Moyen (55–70)</option>
          <option value="high">Élevé (&gt; 70)</option>
        </select>
      </div>
      <TimestampField register={register} />
      <SubmitBtn isSubmitting={isSubmitting} />
    </form>
  )
}

function NoteFormView({ onSaved }: { onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { timestamp: nowLocal(), content: '' },
  })

  const onSubmit = async (data: NoteForm) => {
    await db.noteEntries.add({ timestamp: new Date(data.timestamp), content: data.content })
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Note</label>
        <textarea
          {...register('content')}
          rows={5}
          placeholder="Symptômes, observations…"
          style={{ ...inputStyle, resize: 'none' }}
        />
        {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>}
      </div>
      <TimestampField register={register} />
      <SubmitBtn isSubmitting={isSubmitting} />
    </form>
  )
}

// ── Shared field components ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TimestampField({ register }: { register: any }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Date / heure</label>
      <input {...register('timestamp')} type="datetime-local" style={inputStyle} />
    </div>
  )
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NotesField({ register }: { register: any }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Notes (optionnel)</label>
      <input {...register('notes')} placeholder="Commentaire…" style={inputStyle} />
    </div>
  )
}

function SubmitBtn({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="w-full py-3 rounded-xl text-sm font-semibold min-h-[44px] flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
      style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
    >
      <Check size={16} /> Enregistrer
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '16px',
  outline: 'none',
}

// ── Main route ────────────────────────────────────────────────────────────────
export default function Log() {
  const { activeLogTab, setActiveLogTab } = useUIStore()
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)

  const handleSaved = () => {
    setSaved(true)
    setTimeout(() => { setSaved(false); navigate('/') }, 1200)
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Enregistrer"
        right={
          <button onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ArrowLeft size={20} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        }
      />

      {saved && (
        <div
          className="mx-4 mt-4 rounded-xl p-3 flex items-center gap-2 text-sm font-medium"
          style={{ backgroundColor: 'var(--color-tir-in-range)', color: '#fff' }}
        >
          <Check size={16} /> Enregistré !
        </div>
      )}

      {/* Tab bar */}
      <div
        className="flex mx-4 mt-4 rounded-xl p-1 gap-1"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveLogTab(tab.id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg min-h-[44px] transition-colors text-xs font-medium"
            style={
              activeLogTab === tab.id
                ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                : { color: 'var(--color-text-muted)' }
            }
          >
            {tab.icon}
            <span className="text-[10px]">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Form area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeLogTab}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.15 }}
          className="px-4 pt-5 pb-8"
        >
          {activeLogTab === 'glucose' && <GlucoseFormView onSaved={handleSaved} />}
          {activeLogTab === 'insulin' && <InsulinFormView onSaved={handleSaved} />}
          {activeLogTab === 'meal' && <MealFormView onSaved={handleSaved} />}
          {activeLogTab === 'note' && <NoteFormView onSaved={handleSaved} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
