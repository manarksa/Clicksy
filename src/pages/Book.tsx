import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../context/BookingContext'
import {
  estimateTotal,
  eventTypes,
  formatPrice,
  packages,
} from '../data/catalog'
import type { BookingDraft } from '../types'

const steps = ['Package', 'Event', 'Hours', 'Details'] as const

export function Book() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { draft, saveDraft, createBooking } = useBookings()

  const [step, setStep] = useState(0)
  const [packageId, setPackageId] = useState(
    params.get('package') || draft?.packageId || packages[1].id,
  )
  const [eventTypeId, setEventTypeId] = useState(
    draft?.eventTypeId || eventTypes[0].id,
  )
  const [hours, setHours] = useState(draft?.hours || 4)
  const [eventDate, setEventDate] = useState(draft?.eventDate || '')
  const [location, setLocation] = useState(draft?.location || '')
  const [notes, setNotes] = useState(draft?.notes || '')
  const [message, setMessage] = useState('')

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === packageId) ?? packages[0],
    [packageId],
  )
  const selectedEvent = useMemo(
    () => eventTypes.find((e) => e.id === eventTypeId) ?? eventTypes[0],
    [eventTypeId],
  )

  const clampedHours = Math.max(hours, selectedPackage.minHours)
  const total = estimateTotal(selectedPackage.hourlyRate, clampedHours)

  useEffect(() => {
    if (hours < selectedPackage.minHours) {
      setHours(selectedPackage.minHours)
    }
  }, [hours, selectedPackage.minHours])

  function buildDraft(): BookingDraft {
    return {
      packageId,
      eventTypeId,
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
    persistDraft()
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function handleConfirm(e: FormEvent) {
    e.preventDefault()
    const data = buildDraft()
    if (!data.eventDate || !data.location.trim()) {
      setMessage('Please add an event date and location.')
      return
    }
    saveDraft(data)

    if (!user) {
      navigate('/login?next=/book&intent=confirm')
      return
    }

    createBooking(user, data)
    setMessage('Booking submitted. We will confirm shortly.')
    navigate(user.role === 'admin' ? '/admin' : '/dashboard')
  }

  const confirming = useRef(false)
  useEffect(() => {
    const intent = params.get('intent')
    if (intent === 'confirm' && user && draft && !confirming.current) {
      confirming.current = true
      createBooking(user, draft)
      navigate(user.role === 'admin' ? '/admin' : '/dashboard')
    }
  }, [params, user, draft, createBooking, navigate])

  return (
    <div className="page">
      <Navbar />
      <main className="book-page">
        <div className="book-layout">
          <div className="book-main">
            <p className="eyebrow">Booking</p>
            <h1>Compose your night</h1>
            <p className="lede">
              Browse every option freely. Sign in only when you are ready to
              lock the booking.
            </p>

            <ol className="stepper" aria-label="Booking steps">
              {steps.map((label, i) => (
                <li
                  key={label}
                  className={
                    i === step ? 'active' : i < step ? 'done' : undefined
                  }
                >
                  <button type="button" onClick={() => setStep(i)}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {label}
                  </button>
                </li>
              ))}
            </ol>

            {step === 0 && (
              <div className="choice-grid">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    className={`choice-card${packageId === pkg.id ? ' selected' : ''}`}
                    onClick={() => setPackageId(pkg.id)}
                  >
                    <strong>{pkg.name}</strong>
                    <span>{pkg.tagline}</span>
                    <em>
                      {formatPrice(pkg.hourlyRate)} / hr · min {pkg.minHours}h
                    </em>
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="choice-grid events">
                {eventTypes.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={`choice-card${eventTypeId === event.id ? ' selected' : ''}`}
                    onClick={() => setEventTypeId(event.id)}
                  >
                    <strong>{event.name}</strong>
                    <span>{event.description}</span>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="hours-panel">
                <label htmlFor="hours">
                  Coverage hours
                  <span>
                    Minimum {selectedPackage.minHours}h for{' '}
                    {selectedPackage.name}
                  </span>
                </label>
                <div className="hours-control">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setHours((h) => Math.max(selectedPackage.minHours, h - 1))
                    }
                    aria-label="Decrease hours"
                  >
                    −
                  </button>
                  <input
                    id="hours"
                    type="number"
                    min={selectedPackage.minHours}
                    max={16}
                    value={clampedHours}
                    onChange={(e) =>
                      setHours(
                        Math.max(
                          selectedPackage.minHours,
                          Number(e.target.value) || selectedPackage.minHours,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setHours((h) => Math.min(16, h + 1))}
                    aria-label="Increase hours"
                  >
                    +
                  </button>
                </div>
                <div className="hours-track" aria-hidden>
                  <div
                    className="hours-fill"
                    style={{
                      width: `${((clampedHours - 1) / 15) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <form className="details-form" onSubmit={handleConfirm}>
                <label>
                  Event date
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </label>
                <label>
                  Location
                  <input
                    type="text"
                    required
                    placeholder="Venue or city"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </label>
                <label>
                  Notes for the crew
                  <textarea
                    rows={4}
                    placeholder="Timeline, dress code, must-have shots…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                {message && <p className="form-msg">{message}</p>}
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={back}>
                    Back
                  </button>
                  <button type="submit" className="btn btn-navy">
                    {user ? 'Confirm booking' : 'Sign in to confirm'}
                  </button>
                </div>
              </form>
            )}

            {step < 3 && (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={back}
                  disabled={step === 0}
                >
                  Back
                </button>
                <button type="button" className="btn btn-navy" onClick={next}>
                  Continue
                </button>
              </div>
            )}
          </div>

          <aside className="quote-card" aria-live="polite">
            <p className="quote-label">Live estimate</p>
            <h2>{formatPrice(total)}</h2>
            <ul>
              <li>
                <span>Package</span>
                <strong>{selectedPackage.name}</strong>
              </li>
              <li>
                <span>Event</span>
                <strong>{selectedEvent.name}</strong>
              </li>
              <li>
                <span>Hours</span>
                <strong>{clampedHours}h</strong>
              </li>
              <li>
                <span>Rate</span>
                <strong>{formatPrice(selectedPackage.hourlyRate)}/hr</strong>
              </li>
            </ul>
            <p className="quote-note">
              Preliminary market-aligned pricing. Final quote confirmed by the
              studio after review.
            </p>
            {!user && (
              <p className="quote-auth">
                Already have an account? <Link to="/login?next=/book">Sign in</Link>
              </p>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}
