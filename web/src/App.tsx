import { useEffect, useState } from 'react'
import { useNuiEvent } from './ui/nui/useNuiEvent'
import { fetchNui } from './ui/nui/fetchNui'
import { warpMatrix } from './warp'
import { BootContext, ToastProvider } from './lib'
import type { Boot } from './api'
import Menu from './Menu'
import Creator, { type CreatorData } from './Creator'

export const STAGE_W = 1280
export const STAGE_H = 770

interface OpenData {
  boot: Boot
  mode: 'screen' | 'fullscreen'
  quad?: [number, number][] // 0..1 screen coords: top-left, top-right, bottom-right, bottom-left
  // Opened hidden while the camera moves in (so the data is loaded), then shown with 'reveal'.
  hidden?: boolean
}

function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

export default function App() {
  const [open, setOpen] = useState<OpenData | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [creator, setCreator] = useState<CreatorData | null>(null)
  const view = useViewport()

  useNuiEvent<OpenData>('open', (d) => {
    setLeaving(false)
    setOpen(d)
  })
  useNuiEvent<{ quad?: [number, number][] }>('reveal', (d) => setOpen((cur) => (cur ? { ...cur, hidden: false, quad: d?.quad ?? cur.quad } : cur)))
  // Fade out, then unmount.
  // instant: screen mode, where the monitor already shows the same page, so the camera can move away right after.
  useNuiEvent<{ instant?: boolean }>('close', (d) => {
    if (d?.instant) {
      setOpen(null)
      setLeaving(false)
      return
    }
    setLeaving(true)
    setTimeout(() => {
      setOpen(null)
      setLeaving(false)
    }, 220)
  })
  useNuiEvent<CreatorData>('creator', setCreator)
  useNuiEvent('creatorClose', () => setCreator(null))

  // Dev bridge: what is on screen, and clicking things.
  useNuiEvent<{ selector?: string }>('probe', (d) => {
    const root = d?.selector ? document.querySelector(d.selector) : document.getElementById('root')
    const stage = document.querySelector('.stage') as HTMLElement | null
    const rect = stage?.getBoundingClientRect()
    fetchNui('probe', {
      text: (root as HTMLElement | null)?.innerText ?? null,
      transform: stage?.style.transform ?? null,
      size: stage ? [stage.offsetWidth, stage.offsetHeight] : null,
      rect: rect ? [Math.round(rect.left), Math.round(rect.top), Math.round(rect.right), Math.round(rect.bottom)] : null,
      view: [window.innerWidth, window.innerHeight],
    })
  })
  useNuiEvent<{ selector?: string; text?: string }>('click', (d) => {
    const all = Array.from(document.querySelectorAll<HTMLElement>(d.selector || 'button'))
    const el = d.text ? all.find((e) => e.innerText.trim().toLowerCase().includes(d.text!.toLowerCase())) : all[0]
    el?.click()
  })

  let stageStyle: React.CSSProperties = {}
  if (open) {
    if (open.mode === 'screen' && open.quad) {
      const quad = open.quad.map(([x, y]) => [x * view.w, y * view.h] as [number, number])
      stageStyle = { transform: warpMatrix(STAGE_W, STAGE_H, quad), transformOrigin: '0 0', left: 0, top: 0 }
    } else {
      const scale = Math.min((view.w * 0.86) / STAGE_W, (view.h * 0.86) / STAGE_H)
      stageStyle = {
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
        left: (view.w - STAGE_W * scale) / 2,
        top: (view.h - STAGE_H * scale) / 2,
      }
    }
  }

  return (
    <ToastProvider>
      {open && (
        <BootContext.Provider value={open.boot}>
          {open.mode === 'fullscreen' && <div className="backdrop" />}
          <div className={`stage stage-${open.mode}${open.hidden ? ' hidden' : ''}${leaving ? ' leaving' : ''}`} style={stageStyle}>
            <Menu onClose={() => fetchNui('close')} onPage={(page) => fetchNui('page', { page })} />
          </div>
        </BootContext.Provider>
      )}
      {creator && <Creator data={creator} />}
    </ToastProvider>
  )
}
