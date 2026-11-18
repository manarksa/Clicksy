import { useI18n } from '../context/LanguageContext'

export function LanguageSwitcher() {
  const { t, toggleLang } = useI18n()

  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={toggleLang}
      aria-label={t.lang.switchLabel}
    >
      {t.lang.switchTo}
    </button>
  )
}
