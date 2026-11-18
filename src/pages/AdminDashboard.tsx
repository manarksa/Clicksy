import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { api, errorCode } from '../api'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Sidebar } from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../context/BookingContext'
import { useI18n } from '../context/LanguageContext'
import { formatPrice, packages } from '../data/catalog'
import { bookingEventTitle, fill, formatDate, packageCopy, statusLabel } from '../i18n/messages'
import type { Booking, BookingStatus, User } from '../types'

const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled']

/* ── Success toast shared by every owner screen ─────────────────────────── */

const ToastContext = createContext<(message: string) => void>(() => {})

function ToastHost({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const show = useCallback((message: string) => setToast({ id: Date.now(), message }), [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-dock" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast toast-floating">
            <span>✓ {toast.message}</span>
            <button type="button" aria-label="×" onClick={() => setToast(null)}>
              ×
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

/* ── Actions on one booking ─────────────────────────────────────────────── */

type Busy = null | 'confirm' | 'status' | 'cancel' | 'delete'

function BookingActions({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const { updateStatus, deleteBooking } = useBookings()
  const { t } = useI18n()
  const toast = useContext(ToastContext)
  const [busy, setBusy] = useState<Busy>(null)
  const [asking, setAsking] = useState<null | 'cancel' | 'delete'>(null)
  const [error, setError] = useState('')
  // Blocks a second click even before React re-renders the disabled button.
  const inFlight = useRef(false)

  async function run(kind: Exclude<Busy, null>, action: () => Promise<string>) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(kind)
    setError('')
    try {
      toast(await action())
      setAsking(null)
    } catch (err) {
      // State in the list is untouched: it only changes after MySQL saved it.
      const code = errorCode(err)
      setError(code === 'network' ? t.errors.network : t.admin.saveFailed)
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  const setStatus = (kind: Exclude<Busy, null>, status: BookingStatus) =>
    run(kind, async () => {
      const { changed } = await updateStatus(booking.id, status)
      if (status === 'confirmed') return changed ? t.admin.confirmedToast : t.admin.alreadyToast
      return t.admin.statusToast
    })

  const disabled = busy !== null
  const pending = booking.status === 'pending'

  if (compact) {
    return pending ? (
      <div className="row-actions">
        <button
          type="button"
          className="btn btn-sm"
          disabled={disabled}
          aria-busy={busy === 'confirm'}
          onClick={() => setStatus('confirm', 'confirmed')}
        >
          {busy === 'confirm' ? <Spinner label={t.admin.confirming} /> : `✓ ${t.admin.confirm}`}
        </button>
        {error && <span className="inline-error" role="alert">{error}</span>}
      </div>
    ) : null
  }

  return (
    <div className="booking-actions">
      <div className="booking-actions-row">
        {pending && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={disabled}
            aria-busy={busy === 'confirm'}
            onClick={() => setStatus('confirm', 'confirmed')}
          >
            {busy === 'confirm' ? <Spinner label={t.admin.confirming} /> : `✓ ${t.admin.confirm}`}
          </button>
        )}
        <label className={`status-select status-${booking.status}`}>
          <span className="sr-only">{t.admin.changeStatus}</span>
          <select
            value={booking.status}
            disabled={disabled}
            aria-label={t.admin.changeStatus}
            onChange={(e) => {
              const next = e.target.value as BookingStatus
              // Cancelling always goes through the extra confirmation.
              if (next === 'cancelled') { setError(''); setAsking('cancel') }
              else setStatus('status', next)
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(t, s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="booking-actions-row booking-actions-quiet">
        {booking.status !== 'cancelled' && (
          <button type="button" className="link-btn" disabled={disabled} onClick={() => { setError(''); setAsking('cancel') }}>
            {t.admin.cancelBooking}
          </button>
        )}
        <button type="button" className="link-btn link-danger" disabled={disabled} onClick={() => { setError(''); setAsking('delete') }}>
          {t.admin.deleteBooking}
        </button>
      </div>

      {asking && (
        <div className="confirm-box" role="alertdialog" aria-label={asking === 'cancel' ? t.admin.sureCancel : t.admin.sureDelete}>
          <p>{asking === 'cancel' ? t.admin.sureCancel : t.admin.sureDelete}</p>
          <div className="booking-actions-row">
            <button
              type="button"
              className="btn btn-sm btn-danger"
              disabled={disabled}
              aria-busy={busy === 'cancel' || busy === 'delete'}
              onClick={() =>
                asking === 'cancel'
                  ? setStatus('cancel', 'cancelled')
                  : run('delete', async () => {
                      await deleteBooking(booking.id)
                      return t.admin.deletedToast
                    })
              }
            >
              {busy === 'cancel' || busy === 'delete' ? (
                <Spinner label={t.admin.working} />
              ) : asking === 'cancel' ? (
                t.admin.yesCancel
              ) : (
                t.admin.yesDelete
              )}
            </button>
            <button type="button" className="btn-outline btn-sm" disabled={disabled} onClick={() => setAsking(null)}>
              {t.admin.keep}
            </button>
          </div>
        </div>
      )}

      {busy === 'status' && <span className="muted"><Spinner label={t.admin.working} /></span>}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <>
      <span className="spinner" aria-hidden /> {label}
    </>
  )
}

/* ── Screens ────────────────────────────────────────────────────────────── */

function AdminOverview() {
  const { bookings } = useBookings()
  const { lang, t } = useI18n()
  const pending = bookings.filter((b) => b.status === 'pending').length
  const revenue = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.totalPrice, 0)

  return (
    <div className="dash-panel">
      <h1>{t.admin.ops}</h1>
      <p className="lede">{t.admin.lede}</p>
      <div className="stat-row">
        <div className="stat">
          <span>{t.admin.totalBookings}</span>
          <strong>{bookings.length}</strong>
        </div>
        <div className="stat">
          <span>{t.admin.pending}</span>
          <strong>{pending}</strong>
        </div>
        <div className="stat">
          <span>{t.admin.pipeline}</span>
          <strong>{formatPrice(revenue, lang)}</strong>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.admin.client}</th>
              <th>{t.admin.event}</th>
              <th>{t.admin.date}</th>
              <th>{t.admin.total}</th>
              <th>{t.admin.status}</th>
              <th>
                <span className="sr-only">{t.admin.confirm}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bookings.slice(0, 6).map((b) => (
              <tr key={b.id}>
                <td>{b.userName}</td>
                <td>
                  {bookingEventTitle(t, b.eventTypeId, b.customEventName, b.eventTypeName)} ·{' '}
                  {b.packageName}
                </td>
                <td>{formatDate(b.eventDate, lang)}</td>
                <td>{formatPrice(b.totalPrice, lang)}</td>
                <td>
                  <span className={`status status-${b.status}`}>{statusLabel(t, b.status)}</span>
                </td>
                <td>
                  <BookingActions booking={b} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bookings.length > 6 && (
        <p className="panel-more">
          <Link to="/admin/bookings">{t.admin.viewAll} →</Link>
        </p>
      )}
    </div>
  )
}

function AdminBookings() {
  const { bookings } = useBookings()
  const { lang, t } = useI18n()
  const [filter, setFilter] = useState<BookingStatus | 'all'>('all')
  const visible = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)
  const count = (status: BookingStatus) => bookings.filter((b) => b.status === status).length

  return (
    <div className="dash-panel">
      <h1>{t.admin.bookings}</h1>
      <div className="filter-chips" role="group" aria-label={t.admin.filter}>
        <button
          type="button"
          className={filter === 'all' ? 'active' : undefined}
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          {t.admin.all} <span>{bookings.length}</span>
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={filter === s ? 'active' : undefined}
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
          >
            {statusLabel(t, s)} <span>{count(s)}</span>
          </button>
        ))}
      </div>
      <div className="booking-list">
        {visible.length === 0 && <p className="muted">{t.admin.emptyFilter}</p>}
        {visible.map((b) => (
          <article key={b.id} className={`booking-item booking-${b.status}`}>
            <div>
              <h3>
                {b.userName} —{' '}
                {bookingEventTitle(t, b.eventTypeId, b.customEventName, b.eventTypeName)}{' '}
                <span className={`status status-${b.status}`}>{statusLabel(t, b.status)}</span>
              </h3>
              <p>
                {b.packageName} · {b.hours}
                {lang === 'ar' ? ' س' : 'h'} · {formatDate(b.eventDate, lang)} · {b.location}
              </p>
              <p className="muted">
                {b.userEmail} · {b.userPhone || t.admin.noPhone}
              </p>
              {b.notes && (
                <p className="booking-notes">
                  <strong>{t.admin.notes}:</strong> {b.notes}
                </p>
              )}
            </div>
            <div className="booking-meta">
              <strong>{formatPrice(b.totalPrice, lang)}</strong>
              <BookingActions booking={b} />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function AdminPackages() {
  const { lang, t } = useI18n()

  return (
    <div className="dash-panel">
      <h1>{t.admin.packages}</h1>
      <p className="lede">{t.admin.ratesNote}</p>
      <div className="package-grid admin-packages">
        {packages.map((pkg) => {
          const copy = packageCopy(t, pkg.id)
          return (
            <article key={pkg.id} className="package-card">
              <h3>{pkg.name}</h3>
              <p className="package-tag">{copy?.tagline}</p>
              <p className="package-price">
                <span>{formatPrice(pkg.hourlyRate, lang)}</span>
                <small>{fill(t.packages.rateLine, { hours: pkg.minHours })}</small>
              </p>
              <ul>
                {copy?.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function AdminClients() {
  const { t } = useI18n()
  const [clients, setClients] = useState<Array<User & { bookingCount: number }>>([])

  useEffect(() => {
    api<{ clients: Array<User & { bookingCount: number }> }>('/clients')
      .then((data) => setClients(data.clients))
      .catch(() => setClients([]))
  }, [])

  return (
    <div className="dash-panel">
      <h1>{t.admin.clients}</h1>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.admin.name}</th>
              <th>{t.admin.email}</th>
              <th>{t.admin.phone}</th>
              <th>{t.admin.bookingCount}</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.bookingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const { user, loading, logout } = useAuth()
  const { t } = useI18n()

  if (loading) return <div className="page-loading" aria-busy="true" />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />

  const items = [
    { to: '/admin', label: t.admin.overview, end: true },
    { to: '/admin/bookings', label: t.admin.bookings },
    { to: '/admin/packages', label: t.admin.packages },
    { to: '/admin/clients', label: t.admin.clients },
  ]

  return (
    <ToastHost>
      <div className="dash-shell dash-owner">
        <Sidebar
          variant="owner"
          title={t.admin.consoleTitle}
          badge={t.admin.ownerBadge}
          items={items}
          footer={
            <button type="button" className="btn-outline btn-block" onClick={logout}>
              {t.admin.signOut}
            </button>
          }
        />
        <div className="dash-main">
          <header className="dash-top">
            <div className="dash-top-title">
              <p className="console-title">{t.admin.consoleTitle}</p>
              <NavLink to="/">{t.admin.back}</NavLink>
            </div>
            <div className="dash-top-actions">
              <LanguageSwitcher />
              <span className="account-chip">
                <span>{user.name}</span>
                <span className="role-badge role-badge-owner">
                  <span aria-hidden>◆</span> {t.admin.ownerBadge}
                </span>
              </span>
            </div>
          </header>
          <Routes>
            <Route index element={<AdminOverview />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="packages" element={<AdminPackages />} />
            <Route path="clients" element={<AdminClients />} />
          </Routes>
        </div>
      </div>
    </ToastHost>
  )
}
