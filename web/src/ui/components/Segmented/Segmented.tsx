import type { ReactNode } from 'react'
import { cx } from '../../nui/cx'
import './segmented.css'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

// Inline single choice in a panel-2 track.
// variant="neutral" (default): active is panel-3 + strong border. For form choices (Male / Female, categories).
// variant="accent": active is filled sand. For a filter that drives the list below (All / Today / Week / Month).
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  variant = 'neutral',
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  variant?: 'neutral' | 'accent'
}) {
  return (
    <div className={cx('segmented', variant === 'accent' && 'segmented-accent')} role="radiogroup">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={cx('segmented-option', value === option.value && 'active')}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}
