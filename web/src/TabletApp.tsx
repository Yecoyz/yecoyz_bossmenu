import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, RefreshCw } from 'lucide-react'
import { fetchNui } from './ui/nui/fetchNui'
import { isBrowser } from './ui/nui/env'
import { useTranslation } from './ui/nui/i18n'
import { EmptyState } from './ui/components/EmptyState/EmptyState'
import { Button } from './ui/components/Button/Button'
import { BootContext } from './lib'
import type { Boot } from './api'
import TabletMenu from './TabletMenu'

// The yecoyz_tablet SDK (sdk/tablet.js), loaded from the tablet resource named in the address (#tablet=<resource>).
interface TabletSdk {
  ready(fn: (info: { visible: boolean }) => void): void
  on(action: 'visibility', fn: (visible: boolean) => void): void
}

function tabletResource() {
  const name = window.location.hash.split('=')[1]
  return name && /^[\w-]+$/.test(name) ? name : 'yecoyz_tablet'
}

function loadSdk(): Promise<TabletSdk | null> {
  const w = window as unknown as { Tablet?: TabletSdk }
  if (w.Tablet) return Promise.resolve(w.Tablet)
  if (isBrowser) return Promise.resolve(null)
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `https://cfx-nui-${tabletResource()}/sdk/tablet.js`
    script.onload = () => resolve(w.Tablet ?? null)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

type State = { kind: 'loading' } | { kind: 'error'; error: string } | { kind: 'open'; boot: Boot; key: number }

// The menu as a tablet app: a session is opened on the server each time the app is shown and closed when it is hidden
// or the tablet is put away (client/tablet.lua).
export default function TabletApp() {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const opening = useRef(false)

  const open = useCallback(async () => {
    if (opening.current) return
    opening.current = true
    setState((cur) => (cur.kind === 'open' ? cur : { kind: 'loading' }))
    const res = await fetchNui<{ boot?: Boot; error?: string }>('tabletOpen').catch(() => ({ error: 'timeout' }) as { boot?: Boot; error?: string })
    opening.current = false
    if (res?.boot) setState((cur) => ({ kind: 'open', boot: res.boot!, key: cur.kind === 'open' ? cur.key + 1 : 0 }))
    else setState({ kind: 'error', error: res?.error ?? 'timeout' })
  }, [])

  useEffect(() => {
    let alive = true
    loadSdk().then((tablet) => {
      if (!alive) return
      if (!tablet) {
        void open() // browser preview
        return
      }
      tablet.ready((info) => {
        if (info.visible) void open()
      })
      tablet.on('visibility', (visible) => {
        if (visible) void open()
        else void fetchNui('tabletClose')
      })
    })
    return () => {
      alive = false
    }
  }, [open])

  if (state.kind !== 'open') {
    return (
      <div className="tablet-app tablet-app-center">
        {state.kind === 'loading' ? (
          <EmptyState icon={<RefreshCw size={20} />} text={t('tablet_loading')} />
        ) : (
          <EmptyState
            icon={<Lock size={20} />}
            text={t(`tablet_error_${state.error}`) !== `tablet_error_${state.error}` ? t(`tablet_error_${state.error}`) : t('tablet_error')}
            action={
              <Button variant="outline" size="sm" onClick={() => void open()}>
                {t('tablet_retry')}
              </Button>
            }
          />
        )}
      </div>
    )
  }

  return (
    <div className="tablet-app">
      <BootContext.Provider value={state.boot}>
        <TabletMenu key={state.key} />
      </BootContext.Provider>
    </div>
  )
}
