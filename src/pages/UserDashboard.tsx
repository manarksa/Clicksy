import { useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Sidebar } from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../context/BookingContext'
import { useI18n } from '../context/LanguageContext'
import { formatPrice } from '../data/catalog'
import { bookingEventTitle, formatDate, roleLabel, statusLabel } from '../i18n/messages'

function todayIso() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function Overview() {
  const { user } = useAuth()
  const { bookings } = useBookings()
  const { lang, t } = useI18n()
  const location = useLocation()
  const [justBooked, setJustBooked] = useState(
    Boolean((location.state as { booked?: boolean } | null)?.booked),
  )
  const today = todayIso()
  const upcoming = bookings
    .filter(
      (b) => (b.status === 'pending' || b.status === 'confirmed') && b.eventDate >= today,
    )
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))

  return (
    <div className="dash-panel">
      <h1>
        {t.dash.hello} {user?.name.split(' ')[0]}
      </h1>
      <p className="lede">{t.dash.lede}</p>
      <p className="panel-cta">
        <Link to="/book" className="btn">
          + {t.dash.newBooking}
        </Link>
      </p>
      {justBooked && (
        <div className="toast" role="status">
          <span>✓ {t.dash.booked}</span>
          <button type="button" aria-label="×" onClick={() => setJustBooked(false)}>
            ×
          </button>
        </div>
      )}
      <div className="stat-row">
        <div className="stat">
          <span>{t.dash.bookingsStat}</span>
          <strong>{bookings.length}</strong>
        </div>
        <div className="stat">
          <span>{t.dash.upcoming}</span>
          <strong>{upcoming.length}</strong>
        </div>
        <div className="stat">
          <span>{t.dash.next}</span>
          <strong>
            {upcoming[0] ? formatDate(upcoming[0].eventDate, lang) : '—'}
          </strong>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.dash.event}</th>
              <th>{t.dash.package}</th>
              <th>{t.dash.date}</th>
              <th>{t.dash.total}</th>
              <th>{t.dash.status}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5}>{t.dash.empty}</td>
              </tr>
            )}
            {bookings.slice(0, 5).map((b) => (
              <tr key={b.id}>
                <td>
                  {bookingEventTitle(t, b.eventTypeId, b.customEventName, b.eventTypeName)}
                </td>
                <td>{b.packageName}</td>
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
    </div>
  )
}

function BookingsList() {
  const { bookings } = useBookings()
  const { lang, t } = useI18n()

  return (
    <div className="dash-panel">
      <h1>{t.dash.bookings}</h1>
      <div className="booking-list">
        {bookings.length === 0 && <p>{t.dash.none}</p>}
        {bookings.map((b) => (
          <article key={b.id} className="booking-item">
            <div>
              <h3>
                {bookingEventTitle(t, b.eventTypeId, b.customEventName, b.eventTypeName)} ·{' '}
                {b.packageName}
              </h3>
              <p>
                {formatDate(b.eventDate, lang)} · {b.hours}
                {lang === 'ar' ? ' س' : 'h'} · {b.location}
              </p>
              {b.notes && <p className="muted">{b.notes}</p>}
            </div>
            <div className="booking-meta">
              <strong>{formatPrice(b.totalPrice, lang)}</strong>
              <span className={`status status-${b.status}`}>
                {statusLabel(t, b.status)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function Profile() {
  const { user } = useAuth()
  const { t } = useI18n()
  if (!user) return null

  return (
    <div className="dash-panel">
      <h1>{t.dash.profile}</h1>
      <dl className="profile-grid">
        <div>
          <dt>{t.dash.name}</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt>{t.dash.email}</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>{t.dash.phone}</dt>
          <dd>{user.phone || '—'}</dd>
        </div>
        <div>
          <dt>{t.dash.role}</dt>
          <dd>{roleLabel(t, user.role)}</dd>
        </div>
      </dl>
    </div>
  )
}

export function UserDashboard() {
  const { user, loading, logout } = useAuth()
  const { t } = useI18n()

  if (loading) return <div className="page-loading" aria-busy="true" />
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />

  const items = [
    { to: '/dashboard', label: t.dash.overview, end: true },
    { to: '/dashboard/bookings', label: t.dash.bookings },
    { to: '/dashboard/profile', label: t.dash.profile },
    { to: '/book', label: `+ ${t.dash.newBooking}`, cta: true },
  ]

  return (
    <div className="dash-shell dash-client">
      <Sidebar
        variant="client"
        title={t.dash.clientTitle}
        badge={t.dash.clientBadge}
        items={items}
        footer={
          <button type="button" className="btn-outline btn-block" onClick={logout}>
            {t.dash.signOut}
          </button>
        }
      />
      <div className="dash-main">
        <header className="dash-top">
          <div className="dash-top-title">
            <p className="console-title">{t.dash.clientTitle}</p>
            <NavLink to="/">{t.dash.back}</NavLink>
          </div>
          <div className="dash-top-actions">
            <LanguageSwitcher />
            <span className="account-chip">
              <span>{user.email}</span>
              <span className="role-badge role-badge-client">
                <span aria-hidden>●</span> {t.dash.clientBadge}
              </span>
            </span>
          </div>
        </header>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="bookings" element={<BookingsList />} />
          <Route path="profile" element={<Profile />} />
        </Routes>
      </div>
    </div>
  )
}
