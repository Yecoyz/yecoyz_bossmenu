import { cx } from '../../nui/cx'
import './status-dot.css'

// 8px square-ish dot. Green with a glow when on, dim when off. Pair it with a label ("On duty").
export function StatusDot({ on, className }: { on?: boolean; className?: string }) {
  return <span className={cx('status-dot', on && 'on', className)} />
}
