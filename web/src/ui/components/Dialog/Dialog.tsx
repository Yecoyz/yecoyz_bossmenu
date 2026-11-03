import type { ReactNode } from 'react'
import { cx } from '../../nui/cx'
import { useKey } from '../../nui/useKey'
import { Panel, PanelBody, PanelFooter, PanelHeader, type Tone } from '../Panel/Panel'
import { Button, ButtonRow } from '../Button/Button'
import { CloseButton } from '../IconButton/IconButton'
import './dialog.css'

export interface DialogProps {
  title: ReactNode
  meta?: ReactNode
  tone?: Tone
  width?: number
  leaving?: boolean
  onClose?: () => void
  footer?: ReactNode
  // false: no dimming or blur behind it (a dialog over a panel in the game, where the backdrop would darken the
  // whole screen). Clicks outside still close it.
  backdrop?: boolean
  children: ReactNode
}

// Modal over a 60% black backdrop with a 2px blur (backdrop={false}: none). Esc and the close button call onClose.
// Render it at the root (outside transformed wrappers) so it covers the screen.
// For close animations wrap with usePresence and pass `leaving`.
export function Dialog({ title, meta, tone, width = 400, leaving, onClose, footer, backdrop = true, children }: DialogProps) {
  useKey('Escape', () => onClose?.(), !!onClose && !leaving)

  return (
    <div className={cx('dialog-backdrop', !backdrop && 'bare', leaving && 'leaving')} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <Panel tone={tone} className="dialog animate-pop" style={{ width }} role="dialog" aria-modal="true">
        <PanelHeader title={title} meta={meta}>
          {onClose && <CloseButton onClick={onClose} />}
        </PanelHeader>
        <PanelBody>{children}</PanelBody>
        {footer && <PanelFooter>{footer}</PanelFooter>}
      </Panel>
    </div>
  )
}

// Yes / no question. tone="danger" turns the bar and the confirm button red (delete, kick, reset).
// `amount` shows a big centered number (purchase confirm).
export function ConfirmDialog({
  title,
  meta,
  text,
  note,
  amount,
  amountLabel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone,
  busy,
  leaving,
  backdrop,
  onConfirm,
  onCancel,
}: {
  title: ReactNode
  meta?: ReactNode
  text: ReactNode
  note?: ReactNode
  amount?: ReactNode
  amountLabel?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  tone?: 'accent' | 'danger'
  busy?: boolean
  leaving?: boolean
  backdrop?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useKey('Enter', () => !busy && onConfirm(), !leaving)

  return (
    <Dialog
      title={title}
      meta={meta}
      tone={tone}
      leaving={leaving}
      backdrop={backdrop}
      width={360}
      footer={
        <ButtonRow>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? '...' : confirmLabel}
          </Button>
        </ButtonRow>
      }
    >
      {amount !== undefined ? (
        <div className="dialog-center">
          {amountLabel && <span className="label">{amountLabel}</span>}
          <div className="dialog-amount num">{amount}</div>
          <p className="body">{text}</p>
        </div>
      ) : (
        <>
          <p className="body">{text}</p>
          {note && <p className="dialog-note">{note}</p>}
        </>
      )}
    </Dialog>
  )
}
