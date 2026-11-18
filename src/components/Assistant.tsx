import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { assistantTurn, emptySlots, type Ask, type Slots } from '../assistantReply'
import { useI18n } from '../context/LanguageContext'
import { eventTypes, packages } from '../data/catalog'
import { eventCopy, fill } from '../i18n/messages'

type ChatMessage = {
  id: number
  from: 'user' | 'assistant'
  text: string
  packageId?: string
}

export function Assistant() {
  const { pathname } = useLocation()
  const { lang, t } = useI18n()
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const launchRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [ask, setAsk] = useState<Ask>(null)
  const [slots, setSlots] = useState<Slots>(emptySlots)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageLang, setMessageLang] = useState(lang)
  const nextId = useRef(1)
  const publicSite = !pathname.startsWith('/dashboard') && !pathname.startsWith('/admin')

  if (messageLang !== lang) {
    setMessageLang(lang)
    setMessages([])
    setSlots(emptySlots())
    setAsk(null)
  }

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        launchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!publicSite) return null

  function pushAssistant(text: string, packageId?: string) {
    const id = nextId.current++
    setMessages((current) => [...current, { id, from: 'assistant', text, packageId }])
  }

  function ensureGreeting() {
    setMessages((current) => {
      if (current.length > 0) return current
      return [{ id: nextId.current++, from: 'assistant', text: t.assistant.greeting }]
    })
  }

  function toggle() {
    setOpen((current) => {
      const next = !current
      if (next) ensureGreeting()
      else launchRef.current?.focus()
      return next
    })
  }

  function send(text: string) {
    const value = text.trim().slice(0, 400)
    if (!value) return
    const id = nextId.current++
    setMessages((current) => [...current, { id, from: 'user', text: value }])
    setDraft('')
    const result = assistantTurn(value, slots, t, lang)
    setSlots(result.slots)
    setAsk(result.ask)
    pushAssistant(result.text, result.packageId)
  }

  const suggestions =
    messages.length <= 1
      ? [t.assistant.choose, t.assistant.wedding, t.assistant.booking]
      : ask === 'event'
        ? eventTypes.map((event) => eventCopy(t, event.id)?.name ?? event.name)
        : ask === 'guests'
          ? [t.assistant.small, t.assistant.mid, t.assistant.large]
          : ask === 'coverage'
            ? [t.assistant.photos, t.assistant.film, t.assistant.full]
            : []

  return (
    <div className="assistant">
      {open && (
        <section className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
          <header className="assistant-head">
            <div>
              <h2 id={titleId}>{t.assistant.title}</h2>
              <p>{t.assistant.subtitle}</p>
            </div>
            <button type="button" className="assistant-close" onClick={toggle} aria-label={t.assistant.close}>
              ×
            </button>
          </header>
          <div className="assistant-log" role="log" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`assistant-bubble assistant-bubble-${message.from}`}>
                <p>{message.text}</p>
                {message.packageId && (
                  <Link to={`/book?package=${message.packageId}`} className="btn">
                    {fill(t.assistant.book, {
                      name: packages.find((item) => item.id === message.packageId)?.name ?? message.packageId,
                    })}
                  </Link>
                )}
              </div>
            ))}
          </div>
          {suggestions.length > 0 && (
            <div className="assistant-suggestions">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form
            className="assistant-form"
            onSubmit={(event) => {
              event.preventDefault()
              send(draft)
            }}
          >
            <label className="sr-only" htmlFor="assistant-input">
              {t.assistant.placeholder}
            </label>
            <input
              id="assistant-input"
              ref={inputRef}
              value={draft}
              maxLength={400}
              placeholder={t.assistant.placeholder}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="btn">
              {t.assistant.send}
            </button>
          </form>
        </section>
      )}
      <button
        ref={launchRef}
        type="button"
        className="assistant-launch"
        aria-expanded={open}
        aria-label={open ? t.assistant.close : t.assistant.open}
        data-tooltip={open ? t.assistant.close : t.assistant.open}
        onClick={toggle}
      >
        <span aria-hidden="true">✦</span>
      </button>
    </div>
  )
}
