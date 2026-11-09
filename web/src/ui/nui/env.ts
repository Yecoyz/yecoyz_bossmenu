// True in a normal browser (npm run dev), false inside FiveM: the NUI frame (has invokeNative) and DUI pages (served
// from https://cfx-nui-<resource>/, without invokeNative).
export const isBrowser =
  typeof window !== 'undefined' &&
  !(window as { invokeNative?: unknown }).invokeNative &&
  !window.location.hostname.startsWith('cfx-nui') &&
  window.location.protocol !== 'nui:'

// The resource name, so the same code works in every script. Falls back to `fallback` in the browser.
// Read from the page's own address (https://cfx-nui-<resource>/...) first: DUI pages have no GetParentResourceName,
// and a page shown inside another resource's DUI (a yecoyz_tablet app) gets that resource's name from it.
export function resourceName(fallback = 'yecoyz_resource'): string {
  const host = window.location.hostname
  if (host.startsWith('cfx-nui-')) return host.slice('cfx-nui-'.length)
  const fn = (window as { GetParentResourceName?: () => string }).GetParentResourceName
  return typeof fn === 'function' ? fn() : fallback
}
