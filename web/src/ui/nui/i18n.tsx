import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchNui } from './fetchNui'

type Dict = Record<string, string>

interface Translation {
  t: (key: string, ...args: (string | number)[]) => string
}

const TranslationContext = createContext<Translation>({ t: (key) => key })

export const useTranslation = () => useContext(TranslationContext)

// Loads locales from Lua once (RegisterNUICallback('getLocale', ...) returning a key/value table).
// `fallback` is the English text, used for missing keys and in the browser.
// t('price_text', 1500) replaces %s in order.
export function TranslationProvider({
  children,
  fallback = {},
  event = 'getLocale',
}: {
  children: ReactNode
  fallback?: Dict
  event?: string
}) {
  const [dict, setDict] = useState<Dict>({})

  useEffect(() => {
    fetchNui<Dict>(event)
      .then((res) => {
        if (res && typeof res === 'object') setDict(res)
      })
      .catch(() => {})
  }, [event])

  const t = (key: string, ...args: (string | number)[]) => {
    let text = dict[key] || fallback[key] || key
    for (const arg of args) text = text.replace('%s', String(arg))
    return text
  }

  return <TranslationContext.Provider value={{ t }}>{children}</TranslationContext.Provider>
}
