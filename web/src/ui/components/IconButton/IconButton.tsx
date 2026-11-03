import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../nui/cx'
import { IconX } from '../../icons'
import './icon-button.css'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md'
  active?: boolean
  label: string
}

// Square icon-only button. sm = 30px (panel headers, rails), md = 36px (large headers).
// `label` is required: it becomes the tooltip and aria-label.
export function IconButton({ size = 'sm', active, label, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={cx('icon-btn', size === 'md' && 'icon-btn-md', active && 'icon-btn-active', className)}
      {...props}
    />
  )
}

export function CloseButton({ label = 'Close', ...props }: Omit<IconButtonProps, 'label'> & { label?: string }) {
  return (
    <IconButton label={label} {...props}>
      <IconX size={props.size === 'md' ? 18 : 15} />
    </IconButton>
  )
}
