'use client'

import { type Language, translations } from '@/lib/translations'
import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'language'

function detectLanguage(): Language {
  if (typeof window === 'undefined') return 'en'

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'es') return stored

  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

function resolve(dictionary: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce(
      (value: unknown, segment) =>
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)[segment]
          : undefined,
      dictionary
    )
}

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
})

export function LanguageProvider({
  children,
  initialLanguage,
  onChange,
}: {
  children: React.ReactNode
  initialLanguage?: Language
  onChange?: (language: Language) => Promise<void> | void
}) {
  const [language, setLanguageState] = useState<Language>(
    initialLanguage ?? 'en'
  )

  useEffect(() => {
    if (initialLanguage) return
    setLanguageState(detectLanguage())
  }, [initialLanguage])

  const setLanguage = async (next: Language) => {
    try {
      await onChange?.(next)
    } catch (error: unknown) {
      console.error('Error persisting language:', error)
      return
    }

    setLanguageState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  const t = (key: string, vars?: Record<string, string | number>) => {
    const value = resolve(translations[language], key)
    let text = typeof value === 'string' ? value : key

    if (vars) {
      for (const [varName, varValue] of Object.entries(vars)) {
        text = text.replace(`{${varName}}`, String(varValue))
      }
    }

    return text
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
