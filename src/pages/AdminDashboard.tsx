import { useEffect, useState } from 'react'
import { api, errorCode } from '../api'
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Sidebar } from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../context/BookingContext'
import { useI18n } from '../context/LanguageContext'
import { formatPrice, packages } from '../data/catalog'
import { bookingEventTitle, fill, formatDate, packageCopy, statusLabel } from '../i18n/messages'
import type { BookingStatus, User } from '../types'

const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled']

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
                  <span className={`status status-${b.status}`}>
                    {statusLabel(t, b.status)}
                  </span>
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
  const { bookings, updateStatus } = useBookings()
  const [saveError, setSaveError] = useState('')
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
      {saveError && (
        <p className="form-msg error" role="alert">
          {saveError}
        </p>
      )}
      <div className="booking-list">
        {visible.length === 0 && <p className="muted">{t.admin.emptyFilter}</p>}
        {visible.map((b) => (
          <article key={b.id} className="booking-item">
            <div>
              <h3>
                {b.userName} —{' '}
                {bookingEventTitle(t, b.eventTypeId, b.customEventName, b.eventTypeName)}
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
              <label className={`status-select status-${b.status}`}>
                <span className="sr-only">{t.admin.status}</span>
                <select
                  value={b.status}
                  onChange={(e) =>
                    updateStatus(b.id, e.target.value as BookingStatus).then(
                      () => setSaveError(''),
                      (err) =>
                        setSaveError(
                          (t.errors as Record<string, string>)[errorCode(err)] ?? t.errors.server,
                        ),
                    )
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(t, s)}
                    </option>
                  ))}
                </select>
              </label>
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
    <div className="dash-shell">
      <Sidebar
        title={t.admin.title}
        items={items}
        footer={
          <button type="button" className="btn-outline btn-block" onClick={logout}>
            {t.admin.signOut}
          </button>
        }
      />
      <div className="dash-main">
        <header className="dash-top">
          <NavLink to="/">{t.admin.back}</NavLink>
          <div className="dash-top-actions">
            <LanguageSwitcher />
            <span>
              {t.admin.you} · {user.name}
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
  )
}
