// True in a normal browser (npm run dev), false inside FiveM: the NUI frame (has invokeNative) and DUI pages (served
// from https://cfx-nui-<resource>/, without invokeNative).
export const isBrowser =
  typeof window !== 'undefined' &&
  !(window as { invokeNative?: unknown }).invokeNative &&
  !window.location.hostname.startsWith('cfx-nui') &&
  window.location.protocol !== 'nui:'

// The resource name, so the same code works in every script. Falls back to `fallback` in the browser.
// DUI pages have no GetParentResourceName, so it is read from their address (https://cfx-nui-<resource>/...).
export function resourceName(fallback = 'yecoyz_resource'): string {
  const fn = (window as { GetParentResourceName?: () => string }).GetParentResourceName
  if (typeof fn === 'function') return fn()
  const host = window.location.hostname
  return host.startsWith('cfx-nui-') ? host.slice('cfx-nui-'.length) : fallback
}
