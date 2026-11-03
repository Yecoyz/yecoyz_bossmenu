import { useState } from 'react'

export interface BarPoint {
  label: string // x label (short)
  title: string // tooltip heading (full date)
  value: number
}

// Single series column chart in --chart. Bars are 4px rounded at the top, 2px apart, with a hover tooltip.
export function BarChart({ data, format, height = 120 }: { data: BarPoint[]; format: (n: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const n = data.length

  return (
    <div className="chart" style={{ height }} onMouseLeave={() => setHover(null)}>
      <div className="chart-grid">
        <span />
        <span />
        <span />
      </div>
      <div className="chart-bars" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {data.map((d, i) => (
          <div key={i} className="chart-col" onMouseEnter={() => setHover(i)}>
            <div className={`chart-bar${hover === i ? ' hover' : ''}`} style={{ height: `${d.value > 0 ? Math.max(3, (d.value / max) * 100) : 0}%` }} />
            {hover === i && (
              <div className={`chart-tip${i > n / 2 ? ' left' : ''}`}>
                <span className="label">{d.title}</span>
                <b className="num">{format(d.value)}</b>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="chart-axis" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {data.map((d, i) => (
          <span key={i} className="num">
            {n <= 7 || i % 2 === n % 2 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

// Horizontal bars with the label and value as text (staff per rank).
export function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="barlist">
      {items.map((item, i) => (
        <div key={i} className="barlist-row" title={`${item.label}: ${item.value}`}>
          <span className="barlist-label truncate">{item.label}</span>
          <div className="barlist-track">
            <div className="barlist-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="barlist-value num">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function dayPoints(days: { day: string; time: number }[], value: (d: never) => number): BarPoint[] {
  return days.map((d) => {
    const date = new Date(d.time * 1000)
    return { label: DAYS[date.getDay()], title: d.day, value: value(d as never) }
  })
}
