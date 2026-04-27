import { useRef, useEffect } from 'react'
import uPlot from 'uplot'
import type { GlucoseReading } from '@/db/schema'

interface Props {
  readings: GlucoseReading[]
  height?: number
}

export default function GlucoseSparkline({ readings, height = 64 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  useEffect(() => {
    if (!containerRef.current || readings.length < 2) return

    const el = containerRef.current
    const width = el.clientWidth || 300

    const timestamps = readings.map((r) => new Date(r.timestamp).getTime() / 1000)
    const values = readings.map((r) => r.value)

    const opts: uPlot.Options = {
      width,
      height,
      cursor: { show: false },
      legend: { show: false },
      axes: [{ show: false }, { show: false }],
      scales: { x: { time: true }, y: { range: [40, 300] } },
      series: [
        {},
        {
          stroke: 'var(--color-glucose-in-range)',
          fill: 'rgba(61,163,93,0.15)',
          width: 2,
          points: { show: false },
        },
      ],
      hooks: {
        draw: [
          (u) => {
            const ctx = u.ctx
            const { left, width: w } = u.bbox
            // draw in-range band
            const y70 = u.valToPos(70, 'y', true)
            const y180 = u.valToPos(180, 'y', true)
            ctx.save()
            ctx.fillStyle = 'rgba(61,163,93,0.07)'
            ctx.fillRect(left, Math.min(y70, y180), w, Math.abs(y180 - y70))
            ctx.restore()
          },
        ],
      },
    }

    if (plotRef.current) {
      plotRef.current.destroy()
    }
    plotRef.current = new uPlot(opts, [timestamps, values], el)

    const ro = new ResizeObserver(() => {
      if (plotRef.current && el.clientWidth > 0) {
        plotRef.current.setSize({ width: el.clientWidth, height })
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      plotRef.current?.destroy()
      plotRef.current = null
    }
  }, [readings, height])

  if (readings.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs rounded-lg"
        style={{ height, color: 'var(--color-text-muted)', backgroundColor: 'var(--color-border)' }}
      >
        Pas assez de données
      </div>
    )
  }

  return <div ref={containerRef} className="w-full overflow-hidden rounded-lg" />
}
