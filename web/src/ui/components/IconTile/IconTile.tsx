import type { ReactNode } from 'react'
import { cx } from '../../nui/cx'
import './icon-tile.css'

// 36px square that holds the script icon next to a header title. Sand icon; `muted` for empty states.
export function IconTile({ children, muted, className }: { children: ReactNode; muted?: boolean; className?: string }) {
  return <div className={cx('icon-tile', muted && 'icon-tile-muted', className)}>{children}</div>
}
