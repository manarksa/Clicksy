import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  LANG_KEY,
  messages,
  readStoredLang,
  type Lang,
  type Messages,
} from '../i18n/messages'

interface LanguageContextValue {
  lang: Lang
  t: Messages
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  useEffect(() => {
    const copy = messages[lang]
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = copy.meta.title
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', copy.meta.description)
  }, [lang])

  /** Remember a language only when the visitor chooses it. */
  const choose = (next: Lang) => {
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      /* Keep the in-memory choice if storage is unavailable. */
    }
    setLangState(next)
  }

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      t: messages[lang],
      setLang: choose,
      toggleLang: () => choose(lang === 'ar' ? 'en' : 'ar'),
    }),
    [lang],
  )

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider')
  return ctx
}
