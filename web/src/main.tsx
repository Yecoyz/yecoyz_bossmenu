import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles/index.css'
import './app.css'
import App from './App'
import Screen from './Screen'
import { TranslationProvider } from './ui/nui/i18n'
import { isBrowser } from './ui/nui/env'
import en from '../../locales/en.json'
import { installMocks } from './mock'

// The same page is the menu (NUI) and the monitor's screen (DUI, #screen).
const isScreen = window.location.hash === '#screen'

// Mock data only in a real browser (npm run dev), never on cfx-nui pages (the menu or the monitor's DUI).
const inGame = window.location.hostname.startsWith('cfx-nui') || window.location.protocol === 'nui:'
if (isBrowser && !inGame) installMocks(isScreen)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isScreen ? (
      <Screen />
    ) : (
      <TranslationProvider fallback={en as Record<string, string>}>
        <App />
      </TranslationProvider>
    )}
  </StrictMode>,
)
