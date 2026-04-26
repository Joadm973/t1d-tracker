import { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { subHours } from 'date-fns'
import uPlot from 'uplot'
import Header from '@/components/layout/Header'
import TIRBar from '@/components/charts/TIRBar'
import { db } from '@/db/schema'
import { useSettingsStore } from '@/stores/settings'
import { calculateTIR, calculateGMI, glucoseColor } from '@/lib/calculations'
import { formatGlucose } from '@/lib/utils'

type Period = '24h' | '7j' | '14j' | '30j'

const periods: { id: Period; label: string; hours: number }[] = [
  { id: '24h', label: '24h', hours: 24 },
  { id: '7j', label: '7j', hours: 24 * 7 },
  { id: '14j', label: '14j', hours: 24 * 14 },
  { id: '30j', label: '30j', hours: 24 * 30 },
]

function GlucoseChart({
  readings,
  targetLow,
  targetHigh,
}: {
  readings: { timestamp: Date; value: number }[]
  targetLow: number
  targetHigh: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  useEffect(() => {
    if (!containerRef.current || readings.length < 2) return
    const el = containerRef.current
    const width = el.clientWidth || 350
    const height = 200

    const timestamps = readings.map((r) => new Date(r.timestamp).getTime() / 1000)
    const values = readings.map((r) => r.value)

    const opts: uPlot.Options = {
      width,
      height,
      cursor: { sync: { key: 'glucose' } },
      legend: { show: false },
      axes: [
        { stroke: 'var(--color-text-muted)', ticks: { stroke: 'var(--color-border)' }, grid: { stroke: 'var(--color-border)' } },
        { stroke: 'var(--color-text-muted)', ticks: { stroke: 'var(--color-border)' }, grid: { stroke: 'var(--color-border)' }, size: 40 },
      ],
      scales: { x: { time: true }, y: { range: [40, 320] } },
      series: [
        {},
        {
          stroke: 'var(--color-glucose-in-range)',
          fill: 'rgba(61,163,93,0.12)',
          width: 2,
          points: {
            show: (_u, _si, i0, i1) => i1 - i0 < 50,
            size: 5,
            fill: (_u, _si) => values.map((val) => glucoseColor(val)) as unknown as string,
          },
        },
      ],
      hooks: {
        draw: [
          (u) => {
            const ctx = u.ctx
            const { left, width: w } = u.bbox
            const drawLine = (mgdl: number, dashed: boolean, color: string) => {
              const y = u.valToPos(mgdl, 'y', true)
              ctx.save()
              ctx.strokeStyle = color
              ctx.lineWidth = 1
              if (dashed) ctx.setLineDash([4, 4])
              ctx.beginPath()
              ctx.moveTo(left, y)
              ctx.lineTo(left + w, y)
              ctx.stroke()
              ctx.restore()
            }
            // target band
            const yLow = u.valToPos(targetLow, 'y', true)
            const yHigh = u.valToPos(targetHigh, 'y', true)
            ctx.save()
            ctx.fillStyle = 'rgba(61,163,93,0.07)'
            ctx.fillRect(left, Math.min(yLow, yHigh), w, Math.abs(yHigh - yLow))
            ctx.restore()

            drawLine(54, true, 'var(--color-glucose-very-low)')
            drawLine(250, true, 'var(--color-glucose-very-high)')
          },
        ],
      },
    }

    plotRef.current?.destroy()
    plotRef.current = new uPlot(opts, [timestamps, values], el)

    const ro = new ResizeObserver(() => {
      if (plotRef.current && el.clientWidth > 0) {
        plotRef.current.setSize({ width: el.clientWidth, height })
      }
    })
    ro.observe(el)

    return () => { ro.disconnect(); plotRef.current?.destroy(); plotRef.current = null }
  }, [readings, targetLow, targetHigh])

  if (readings.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl text-sm"
        style={{ height: 200, backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
      >
        Pas assez de données
      </div>
    )
  }

  return <div ref={containerRef} className="w-full overflow-hidden rounded-xl" />
}

export default function Charts() {
  const [period, setPeriod] = useState<Period>('24h')
  const unit = useSettingsStore((s) => s.unit)
  const { targetLow, targetHigh } = useSettingsStore()
  const hours = periods.find((p) => p.id === period)!.hours
  const cutoff = subHours(new Date(), hours)

  const readings = useLiveQuery(
    () => db.glucoseReadings.where('timestamp').above(cutoff).sortBy('timestamp'),
    [period],
  )

  const values = (readings ?? []).map((r) => r.value)
  const tir = calculateTIR(values)
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  const gmi = avg ? calculateGMI(avg) : null

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Courbes" />

      <div className="px-4 py-4 space-y-5">
        {/* Period selector */}
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className="flex-1 py-2 rounded-lg text-sm font-medium min-h-[36px] transition-colors"
              style={
                period === p.id
                  ? { backgroundColor: 'var(--color-primary)', color: '#fff' }
                  : { color: 'var(--color-text-muted)' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Stats row */}
        {values.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Moyenne" value={formatGlucose(avg, unit)} unit={unit} />
            <StatCard
              label="GMI"
              value={gmi ? gmi.toFixed(1) : '--'}
              unit="%"
              sub="≈ HbA1c"
            />
            <StatCard
              label="Mesures"
              value={values.length.toString()}
              unit="pts"
            />
          </div>
        )}

        {/* Main chart */}
        <div
          className="rounded-2xl p-4 shadow-sm"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <GlucoseChart
            readings={(readings ?? []).map((r) => ({ timestamp: new Date(r.timestamp), value: r.value }))}
            targetLow={targetLow}
            targetHigh={targetHigh}
          />
        </div>

        {/* TIR */}
        <div
          className="rounded-2xl p-4 shadow-sm"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Temps dans la cible — {period}
          </p>
          <TIRBar tir={tir} showLabels height={16} />
          <div className="flex justify-between mt-3">
            {[
              { label: 'Très bas', pct: tir.veryLow, color: 'var(--color-tir-very-low)' },
              { label: 'Bas', pct: tir.low, color: 'var(--color-tir-low)' },
              { label: 'Cible', pct: tir.inRange, color: 'var(--color-tir-in-range)' },
              { label: 'Haut', pct: tir.high, color: 'var(--color-tir-high)' },
              { label: 'Très haut', pct: tir.veryHigh, color: 'var(--color-tir-very-high)' },
            ].map(({ label, pct, color }) => (
              <div key={label} className="text-center">
                <p className="text-xs font-semibold" style={{ color }}>{pct.toFixed(0)}%</p>
                <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, sub }: { label: string; value: string; unit: string; sub?: string }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{value}</p>
      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{unit}</p>
      {sub && <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
    </div>
  )
}
