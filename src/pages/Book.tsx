import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../context/BookingContext'
import { useI18n } from '../context/LanguageContext'
import { usePackages } from '../context/PackagesContext'
import { estimateTotal, eventTypes, formatPrice } from '../data/catalog'
import { errorCode } from '../api'
import { eventCopy, fill } from '../i18n/messages'
import type { BookingDraft, Package } from '../types'

const stepIds = ['package', 'event', 'hours', 'details'] as const
const MAX_HOURS = 16

function todayIso() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function maxDateIso() {
  return `${new Date().getFullYear() + 2}-12-31`
}

function validPackageId(packages: Package[], id: string | null | undefined) {
  return id && packages.some((p) => p.id === id) ? id : null
}

/** Packages come from the database; the form opens once they are loaded. */
export function Book() {
  const { packages, status } = usePackages()
  const { t } = useI18n()
  if (!packages.length) {
    return (
      <div className="page">
        <Navbar />
        <main className="book-page">
          {status === 'error' && <p className="form-msg">{t.errors.server}</p>}
        </main>
        <Footer />
      </div>
    )
  }
  return <BookForm packages={packages} />
}

function BookForm({ packages }: { packages: Package[] }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { draft, saveDraft, createBooking } = useBookings()
  const { lang, t } = useI18n()

  const [step, setStep] = useState(0)
  const [packageId, setPackageId] = useState(
    validPackageId(packages, params.get('package')) ??
      validPackageId(packages, draft?.packageId) ??
      (packages.find((p) => p.popular) ?? packages[0]).id,
  )
  const [eventTypeId, setEventTypeId] = useState(
    draft?.eventTypeId || eventTypes[0].id,
  )
  const [hours, setHours] = useState(draft?.hours || 4)
  const [eventDate, setEventDate] = useState(draft?.eventDate || '')
  const [location, setLocation] = useState(draft?.location || '')
  const [notes, setNotes] = useState(draft?.notes || '')
  const [customEventName, setCustomEventName] = useState(draft?.customEventName || '')
  const [eventNameError, setEventNameError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [messageKey, setMessageKey] = useState<'' | 'needDetails' | 'failed' | 'maintenance'>(
    '',
  )

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === packageId) ?? packages[0],
    [packages, packageId],
  )
  const selectedEvent = useMemo(
    () => eventTypes.find((e) => e.id === eventTypeId) ?? eventTypes[0],
    [eventTypeId],
  )
  const selectedEventCopy = eventCopy(t, selectedEvent.id)

  const clampedHours = Math.min(MAX_HOURS, Math.max(hours, selectedPackage.minHours))
  const total = estimateTotal(selectedPackage.hourlyRate, clampedHours)
  const price = (amount: number) => formatPrice(amount, lang)

  function buildDraft(): BookingDraft {
    return {
      packageId,
      eventTypeId,
      customEventName: eventTypeId === 'other' ? customEventName.trim() : '',
      hours: clampedHours,
      eventDate,
      location,
      notes,
    }
  }

  function persistDraft() {
    saveDraft(buildDraft())
  }

  function next() {
    if (step === 1 && eventTypeId === 'other' && !customEventName.trim()) {
      setEventNameError(true)
      return
    }
    setEventNameError(false)
    persistDraft()
    setStep((s) => Math.min(s + 1, stepIds.length - 1))
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault()
    const data = buildDraft()
    if (data.eventTypeId === 'other' && !data.customEventName?.trim()) {
      setEventNameError(true)
      setStep(1)
      return
    }
    if (!data.eventDate || data.eventDate < todayIso() || data.eventDate.length !== 10 || !data.location.trim()) {
      setMessageKey('needDetails')
      return
    }
    saveDraft(data)

    if (!user) {
      navigate('/login?next=/book&intent=confirm')
      return
    }

    if (user.role === 'admin') {
      navigate('/admin')
      return
    }

    setSubmitting(true)
    try {
      await createBooking(data)
    } catch (err) {
      setSubmitting(false)
      const code = errorCode(err)
      setMessageKey(code === 'needDetails' || code === 'maintenance' ? code : 'failed')
      return
    }
    navigate('/dashboard', { state: { booked: true } })
  }

  const confirming = useRef(false)
  useEffect(() => {
    const intent = params.get('intent')
    if (intent !== 'confirm' || !user || confirming.current) return
    confirming.current = true
    if (user.role === 'admin' || !draft) {
      navigate(user.role === 'admin' ? '/admin' : '/book', { replace: true })
      return
    }
    createBooking(draft)
      .then(() => navigate('/dashboard', { replace: true, state: { booked: true } }))
      // Stay on the form so the client can fix the draft.
      .catch(() => navigate('/book', { replace: true }))
  }, [params, user, draft, createBooking, navigate])

  return (
    <div className="page">
      <Navbar />
      <main className="book-page">
        <div className="book-layout">
          <div className="book-main">
            <p className="eyebrow">{t.book.eyebrow}</p>
            <h1>{t.book.title}</h1>
            <p className="lede">{t.book.lede}</p>

            <ol className="stepper" aria-label={t.book.stepsLabel}>
              {stepIds.map((id, i) => (
                <li
                  key={id}
                  className={
                    i === step ? 'active' : i < step ? 'done' : undefined
                  }
                >
                  <button type="button" onClick={() => setStep(i)}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {t.book.steps[id]}
                  </button>
                </li>
              ))}
            </ol>

            {step === 0 && (
              <div className="choice-grid">
                {packages.map((pkg) => {
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      className={`choice-card${packageId === pkg.id ? ' selected' : ''}`}
                      onClick={() => setPackageId(pkg.id)}
                    >
                      <strong>{pkg.name}</strong>
                      <span>{pkg.tagline}</span>
                      <em>
                        {fill(t.book.choiceMeta, {
                          price: price(pkg.hourlyRate),
                          hours: pkg.minHours,
                        })}
                      </em>
                    </button>
                  )
                })}
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="choice-grid events">
                {eventTypes.map((event) => {
                  const copy = eventCopy(t, event.id)
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className={`choice-card${eventTypeId === event.id ? ' selected' : ''}`}
                      onClick={() => setEventTypeId(event.id)}
                    >
                      <strong>{copy?.name}</strong>
                      <span>{copy?.description}</span>
                    </button>
                  )
                })}
                </div>
                {eventTypeId === 'other' && (
                  <label className="other-event">
                    {t.book.eventName}
                    <input
                      type="text"
                      required
                      value={customEventName}
                      placeholder={t.book.eventNamePh}
                      maxLength={80}
                      onChange={(e) => {
                        setCustomEventName(e.target.value)
                        if (e.target.value.trim()) setEventNameError(false)
                      }}
                    />
                  </label>
                )}
                {eventNameError && (
                  <p className="form-msg error">{t.book.needEventName}</p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="hours-panel">
                <label htmlFor="hours">
                  {t.book.hours}
                  <span>
                    {fill(t.book.hoursHint, {
                      min: selectedPackage.minHours,
                      name: selectedPackage.name,
                    })}
                  </span>
                </label>
                <div className="hours-control">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() =>
                      setHours(Math.max(selectedPackage.minHours, clampedHours - 1))
                    }
                    aria-label={t.book.decrease}
                  >
                    −
                  </button>
                  <input
                    id="hours"
                    type="number"
                    min={selectedPackage.minHours}
                    max={MAX_HOURS}
                    value={clampedHours}
                    onChange={(e) =>
                      setHours(Number(e.target.value) || selectedPackage.minHours)
                    }
                  />
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setHours(Math.min(MAX_HOURS, clampedHours + 1))}
                    aria-label={t.book.increase}
                  >
                    +
                  </button>
                </div>
                <div className="hours-track" aria-hidden>
                  <div
                    className="hours-fill"
                    style={{
                      width: `${(clampedHours / MAX_HOURS) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <form className="details-form" onSubmit={handleConfirm}>
                <label>
                  {t.book.date}
                  <input
                    type="date"
                    required
                    min={todayIso()}
                    max={maxDateIso()}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </label>
                <label>
                  {t.book.location}
                  <input
                    type="text"
                    required
                    placeholder={t.book.locationPh}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </label>
                <label>
                  {t.book.notes}
                  <textarea
                    rows={4}
                    placeholder={t.book.notesPh}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                {messageKey && (
                  <p className="form-msg">
                    {messageKey === 'maintenance' ? t.errors.maintenance : t.book[messageKey]}
                  </p>
                )}
                <div className="form-actions">
                  <button type="button" className="btn-outline" onClick={back}>
                    {t.book.back}
                  </button>
                  <button type="submit" className="btn" disabled={submitting}>
                    {user ? t.book.confirm : t.book.signInConfirm}
                  </button>
                </div>
              </form>
            )}

            {step < 3 && (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={back}
                  disabled={step === 0}
                >
                  {t.book.back}
                </button>
                <button type="button" className="btn" onClick={next}>
                  {t.book.continue}
                </button>
              </div>
            )}
          </div>

          <aside className="quote-card" aria-live="polite">
            <p className="quote-label">{t.book.estimate}</p>
            <h2>{price(total)}</h2>
            <ul>
              <li>
                <span>{t.book.package}</span>
                <strong>{selectedPackage.name}</strong>
              </li>
              <li>
                <span>{t.book.event}</span>
                <strong>
                  {eventTypeId === 'other'
                    ? customEventName.trim() || selectedEventCopy?.name
                    : selectedEventCopy?.name}
                </strong>
              </li>
              <li>
                <span>{t.book.hoursLabel}</span>
                <strong>{fill(t.book.hoursValue, { hours: clampedHours })}</strong>
              </li>
              <li>
                <span>{t.book.rate}</span>
                <strong>
                  {fill(t.book.rateValue, {
                    price: price(selectedPackage.hourlyRate),
                  })}
                </strong>
              </li>
            </ul>
            <p className="quote-note">{t.book.note}</p>
            {!user && (
              <p className="quote-auth">
                {t.book.haveAccount}{' '}
                <Link to="/login?next=/book">{t.book.signIn}</Link>
              </p>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}
