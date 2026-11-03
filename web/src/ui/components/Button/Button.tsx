import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { cx } from '../../nui/cx'
import './button.css'

export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'outline-danger' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
}

// 40px, uppercase, wide-tracked. Only ONE primary per view.
export function Button({ variant = 'primary', size = 'md', block, className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className)}
      {...props}
    />
  )
}

// Equal-width buttons side by side (Cancel | Save). Primary goes last (right).
export function ButtonRow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('btn-row', className)} {...props} />
}
