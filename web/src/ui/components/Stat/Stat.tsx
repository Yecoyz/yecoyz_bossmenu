import type { ReactNode } from 'react'
import { cx } from '../../nui/cx'
import '../Inset/inset.css'
import './stat.css'

export interface StatItem {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  accent?: boolean
}

// One stat tile: label on top, big tabular value below. `accent` = the one number that matters (sand).
export function Stat({ label, value, unit, accent }: StatItem) {
  return (
    <div className="stat inset">
      <span className="label">{label}</span>
      <span className={cx('stat-value', accent && 'accent')}>
        {value}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  )
}

// Row of separate tiles (duty: Shifts | Worked | Average).
export function Stats({ items }: { items: StatItem[] }) {
  return (
    <div className="stats" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item, i) => (
        <Stat key={i} {...item} />
      ))}
    </div>
  )
}

// One inset split by hairlines (characters: Age | Gender | Height). Smaller values.
export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="stat-grid inset" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item, i) => (
        <div key={i}>
          <div className="label truncate">{item.label}</div>
          <div className={cx('stat-grid-value', item.accent && 'accent')}>
            {item.value}
            {item.unit && <small>{item.unit}</small>}
          </div>
        </div>
      ))}
    </div>
  )
}
