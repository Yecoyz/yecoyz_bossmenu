import type { HTMLAttributes } from 'react'
import { cx } from '../../nui/cx'
import './inset.css'

// A card inside a panel: panel-2 at 70%, hairline border, rounded-md. `padded={false}` for rows that set their own padding.
export function Inset({ padded = true, className, ...props }: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return <div className={cx('inset', padded && 'inset-pad', className)} {...props} />
}
