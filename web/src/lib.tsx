import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useTranslation } from './ui/nui/i18n'
import { Toast, ToastStack } from './ui/components/Toast/Toast'
import type { Boot, LogRow } from './api'

// The boot data of the open session, shared by every page.
export const BootContext = createContext<Boot | null>(null)
export function useBoot() {
  return useContext(BootContext)!
}

export function useMoney() {
  const boot = useBoot()
  return (n: number | undefined) => `${boot?.currency ?? '$'}${Math.round(n || 0).toLocaleString('en-US')}`
}

export function useCan() {
  const boot = useBoot()
  return (perm: string) => !!boot && boot.perms.includes(perm)
}

// 4380 -> "1h 13m"
export function hours(seconds: number | undefined) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function dateTime(epoch: number | undefined) {
  if (!epoch) return '-'
  const d = new Date(epoch * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ago(epoch: number | undefined, never = 'Never') {
  if (!epoch) return never
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epoch))
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// "Peter hired Anna" from a log row.
export function useLogText() {
  const { t } = useTranslation()
  return (row: LogRow) => {
    const key = `act_${row.action}`
    const text = t(key, row.target_name || '')
    return text === key ? row.action : text
  }
}

// Short messages on top of the menu.
type ToastItem = { id: number; tone: 'success' | 'danger' | 'accent'; text: string; leaving?: boolean }
const ToastContext = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, tone: ToastItem['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setItems((list) => [...list.slice(-3), { id, tone, text }])
    setTimeout(() => setItems((list) => list.map((i) => (i.id === id ? { ...i, leaving: true } : i))), 2800)
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), 3000)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        <ToastStack>
          {items.map((i) => (
            <Toast key={i.id} tone={i.tone} leaving={i.leaving}>
              {i.text}
            </Toast>
          ))}
        </ToastStack>
      </div>
    </ToastContext.Provider>
  )
}

// Shows a server error as a red toast. Returns true when the result was fine.
export function useResult() {
  const toast = useToast()
  const { t } = useTranslation()
  return (result: { error?: string }, success?: string) => {
    if (result.error) {
      toast(t(`err_${result.error}`), 'danger')
      return false
    }
    if (success) toast(success, 'success')
    return true
  }
}

// A picture set in the creator, across the top of a shop card. Hidden if it fails to load.
export function ShopPhoto({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div className="shop-photo">
      <img src={src} alt="" onError={() => setFailed(true)} />
    </div>
  )
}
