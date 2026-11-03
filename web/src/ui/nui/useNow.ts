import { useEffect, useState } from 'react'

// Current time in epoch seconds, refreshed every second while `active`. For live timers.
export function useNow(active = true) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    if (!active) return undefined
    setNow(Math.floor(Date.now() / 1000))
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(timer)
  }, [active])

  return now
}
