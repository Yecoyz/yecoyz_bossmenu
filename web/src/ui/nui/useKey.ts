import { useEffect, useRef } from 'react'

// Calls `handler` when `key` is pressed while `active`. useKey('Escape', close, visible)
export function useKey(key: string, handler: (event: KeyboardEvent) => void, active = true) {
  const saved = useRef(handler)

  useEffect(() => {
    saved.current = handler
  }, [handler])

  useEffect(() => {
    if (!active) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === key) saved.current(event)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, active])
}
