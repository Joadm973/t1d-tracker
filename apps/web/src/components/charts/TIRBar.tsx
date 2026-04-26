interface TIRData {
  veryLow: number
  low: number
  inRange: number
  high: number
  veryHigh: number
}

interface Props {
  tir: TIRData
  showLabels?: boolean
  height?: number
}

const SEGMENTS = [
  { key: 'veryLow' as const, color: 'var(--color-tir-very-low)', label: 'Très bas' },
  { key: 'low' as const, color: 'var(--color-tir-low)', label: 'Bas' },
  { key: 'inRange' as const, color: 'var(--color-tir-in-range)', label: 'Cible' },
  { key: 'high' as const, color: 'var(--color-tir-high)', label: 'Haut' },
  { key: 'veryHigh' as const, color: 'var(--color-tir-very-high)', label: 'Très haut' },
]

export default function TIRBar({ tir, showLabels = false, height = 12 }: Props) {
  const total = Object.values(tir).reduce((a, b) => a + b, 0)
  const isEmpty = total === 0

  return (
    <div>
      <div className="flex rounded-full overflow-hidden" style={{ height }}>
        {isEmpty ? (
          <div className="flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
        ) : (
          SEGMENTS.map(({ key, color }) => {
            const pct = tir[key]
            if (pct < 0.5) return null
            return (
              <div
                key={key}
                style={{ width: `${pct}%`, backgroundColor: color }}
                title={`${key}: ${pct.toFixed(1)}%`}
              />
            )
          })
        )}
      </div>
      {showLabels && !isEmpty && (
        <div className="flex gap-3 mt-2 flex-wrap">
          {SEGMENTS.filter(({ key }) => tir[key] >= 0.5).map(({ key, color, label }) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {label} {tir[key].toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
