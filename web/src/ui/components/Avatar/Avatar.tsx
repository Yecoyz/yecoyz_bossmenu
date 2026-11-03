import type { ReactNode } from 'react'
import { cx } from '../../nui/cx'
import { IconUser } from '../../icons'
import '../StatusDot/status-dot.css'
import './avatar.css'

// Rounded-md square (never a circle) with a user icon, or an image/initials as children.
// Pass `online` to pin a status dot to the bottom-right corner.
export function Avatar({ online, large, children }: { online?: boolean; large?: boolean; children?: ReactNode }) {
  return (
    <div className={cx('avatar', large && 'avatar-lg')}>
      {children ?? <IconUser size={large ? 26 : 20} />}
      {online !== undefined && <span className={cx('status-dot', online && 'on')} />}
    </div>
  )
}
