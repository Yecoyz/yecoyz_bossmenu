import { forwardRef, type InputHTMLAttributes, type ReactNode, type HTMLAttributes } from 'react'
import { cx } from '../../nui/cx'
import { IconSearch } from '../../icons'
import './input.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

// 40px text input on panel-2. Border goes line-strong on hover, sand on focus, red on error.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ error, className, ...props }, ref) {
  return <input ref={ref} spellCheck={false} className={cx('input', error && 'input-error', className)} {...props} />
})

// Label above, input (or any control) in the middle, error or hint below.
export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode
  error?: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('field', className)}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

// Two fields side by side (First name | Last name).
export function FieldRow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('field-row', className)} {...props} />
}

// Input with a search icon on the left.
export const SearchInput = forwardRef<HTMLInputElement, InputProps>(function SearchInput(props, ref) {
  return (
    <div className="search">
      <IconSearch />
      <Input ref={ref} type="text" {...props} />
    </div>
  )
})
