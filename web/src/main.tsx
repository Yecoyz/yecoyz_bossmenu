import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles/index.css'
import './app.css'
import App from './App'
import Screen from './Screen'
import TabletApp from './TabletApp'
import { TranslationProvider } from './ui/nui/i18n'
import { isBrowser } from './ui/nui/env'
import en from '../../locales/en.json'
import { installMocks } from './mock'

// The same page is the menu (NUI) and the monitor's screen (DUI, #screen).
const isScreen = window.location.hash === '#screen'
// The yecoyz_tablet app (#tablet=<tablet resource>), shown in a frame on the tablet (client/tablet.lua).
const isTablet = window.location.hash.startsWith('#tablet')

// Mock data only in a real browser (npm run dev), never on cfx-nui pages (the menu or the monitor's DUI).
const inGame = window.location.hostname.startsWith('cfx-nui') || window.location.protocol === 'nui:'
if (isBrowser && !inGame) installMocks(isScreen)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isScreen ? (
      <Screen />
    ) : (
      <TranslationProvider fallback={en as Record<string, string>}>
        {isTablet ? <TabletApp /> : <App />}
      </TranslationProvider>
    )}
  </StrictMode>,
)
