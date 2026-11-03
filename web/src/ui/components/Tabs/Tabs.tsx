import type { ReactNode } from 'react'
import { cx } from '../../nui/cx'
import './tabs.css'

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
  icon?: ReactNode
}

// Underlined page tabs that sit full-width under a panel header. Active tab: fg text, sand icon, 2px sand underline.
// Use Segmented instead when the choice sits inside the content (filters, categories in a side panel).
export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <nav className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={cx('tab', value === item.id && 'active')}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  )
}
