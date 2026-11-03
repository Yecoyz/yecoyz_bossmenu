import { useEffect, useState } from 'react'
import { fetchNui } from './ui/nui/fetchNui'
import Menu, { type Page } from './Menu'
import { BootContext, ToastProvider } from './lib'
import { TranslationProvider } from './ui/nui/i18n'
import type { Boot } from './api'
import en from '../../locales/en.json'
import { Building2, Lock, User } from 'lucide-react'

interface ScreenData {
  jobLabel: string
  job: string
  label?: string
  user?: string
  clock: { h: number; m: number }
  canUse: boolean
  prompt: string
  locked: string
  inUse: string
  title: string
}

// The monitor's idle screen (DUI). Messages come from SendDuiMessage as { action, data }.
export default function Screen() {
  const [data, setData] = useState<ScreenData | null>(null)
  // While this player is logged in, the monitor shows the same menu as the one they use.
  const [menu, setMenu] = useState<Boot | null>(null)
  const [page, setPage] = useState<Page | undefined>(undefined)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      if (msg?.action === 'screen') setData(msg.data)
      if (msg?.action === 'menu') {
        setPage(undefined)
        setMenu(msg.data.boot)
      }
      if (msg?.action === 'page') setPage(msg.data.page)
      if (msg?.action === 'menuClose') setMenu(null)
    }
    window.addEventListener('message', onMessage)
    fetchNui('screenReady').catch(() => {})
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  if (menu) {
    return (
      <TranslationProvider fallback={en as Record<string, string>}>
        <ToastProvider>
          <BootContext.Provider value={menu}>
            <div className="stage stage-screen mirror">
              <Menu mirror page={page} onClose={() => {}} />
            </div>
          </BootContext.Provider>
        </ToastProvider>
      </TranslationProvider>
    )
  }

  return (
    <div className="screen">
      <div className="screen-glow" />
      <div className="screen-top">
        <span className="label">{data?.title ?? 'Boss Menu'}</span>
        <span className="screen-clock num">{data ? `${pad(data.clock.h)}:${pad(data.clock.m)}` : '--:--'}</span>
      </div>
      <div className="screen-center">
        <div className="screen-logo">
          <Building2 size={64} strokeWidth={1.75} />
        </div>
        <div className="screen-job title">{data?.jobLabel ?? ''}</div>
        {data?.label && <div className="screen-sub label">{data.label}</div>}
      </div>
      <div className="screen-bottom">
        {data?.user ? (
          <div className="screen-state on">
            <User size={22} />
            <span>
              {data.inUse}: <b>{data.user}</b>
            </span>
          </div>
        ) : (
          <div className="screen-state">
            <Lock size={22} />
            <span>{data?.canUse ? data.prompt : data?.locked}</span>
          </div>
        )}
      </div>
    </div>
  )
}
