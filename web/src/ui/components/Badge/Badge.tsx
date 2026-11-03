import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../nui/cx'
import './badge.css'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'solid'

// Small uppercase tag. neutral = grades, jobs, frameworks. Colored tones carry meaning (New, Free, Sale).
// solid = sand fill with ink text, for a single "Not saved" / "Changed" flag.
export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cx('badge', tone !== 'neutral' && `badge-${tone}`, className)}>{children}</span>
}

export function Badges({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('badges', className)} {...props} />
}
