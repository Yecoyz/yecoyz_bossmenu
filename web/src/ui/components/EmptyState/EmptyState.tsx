import type { ReactNode } from 'react'
import '../IconTile/icon-tile.css'
import './empty-state.css'

// Shown when a list has nothing in it. Muted icon tile, one muted line, optional action below.
export function EmptyState({ icon, text, action }: { icon?: ReactNode; text: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="icon-tile icon-tile-muted">{icon}</div>}
      <div className="empty-text">{text}</div>
      {action}
    </div>
  )
}
