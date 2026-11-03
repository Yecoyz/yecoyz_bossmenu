// Number formatting shared by all scripts. Render the result with the `num` class (tabular-nums).

// 4380 -> "1h 13m", 300 -> "5m"
export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

// 4380 -> "01:13:00"
export function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(safe / 3600))}:${pad(Math.floor((safe % 3600) / 60))}:${pad(safe % 60)}`
}

// 185 -> "3:05" (track time)
export function formatTrack(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

// 12500 -> "$12,500"
export function formatMoney(amount: number | undefined, currency = '$') {
  return `${currency}${Math.round(amount || 0).toLocaleString('en-US')}`
}
