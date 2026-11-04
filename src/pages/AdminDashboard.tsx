import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../context/BookingContext'
import { formatPrice, packages } from '../data/catalog'
import type { BookingStatus } from '../types'

const items = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/bookings', label: 'All bookings' },
  { to: '/admin/packages', label: 'Packages' },
  { to: '/admin/clients', label: 'Clients' },
]

function AdminOverview() {
  const { bookings } = useBookings()
  const pending = bookings.filter((b) => b.status === 'pending').length
  const revenue = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.totalPrice, 0)

  return (
    <div className="dash-panel">
      <h1>Studio ops</h1>
      <p className="lede">Confirm shoots, track revenue, keep the calendar clean.</p>
      <div className="stat-row">
        <div className="stat">
          <span>Total bookings</span>
          <strong>{bookings.length}</strong>
        </div>
        <div className="stat">
          <span>Pending</span>
          <strong>{pending}</strong>
        </div>
        <div className="stat">
          <span>Pipeline</span>
          <strong>{formatPrice(revenue)}</strong>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Event</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.slice(0, 6).map((b) => (
              <tr key={b.id}>
                <td>{b.userName}</td>
                <td>
                  {b.eventTypeName} · {b.packageName}
                </td>
                <td>{b.eventDate}</td>
                <td>{formatPrice(b.totalPrice)}</td>
                <td>
                  <span className={`status status-${b.status}`}>{b.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminBookings() {
  const { bookings, updateStatus } = useBookings()
  const statuses: BookingStatus[] = [
    'pending',
    'confirmed',
    'completed',
    'cancelled',
  ]

  return (
    <div className="dash-panel">
      <h1>All bookings</h1>
      <div className="booking-list">
        {bookings.map((b) => (
          <article key={b.id} className="booking-item">
            <div>
              <h3>
                {b.userName} — {b.eventTypeName}
              </h3>
              <p>
                {b.packageName} · {b.hours}h · {b.eventDate} · {b.location}
              </p>
              <p className="muted">
                {b.userEmail} · {b.userPhone || 'No phone'}
              </p>
            </div>
            <div className="booking-meta">
              <strong>{formatPrice(b.totalPrice)}</strong>
              <label className="status-select">
                <span className="sr-only">Status</span>
                <select
                  value={b.status}
                  onChange={(e) =>
                    updateStatus(b.id, e.target.value as BookingStatus)
                  }
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
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
  return (
    <div className="dash-panel">
      <h1>Packages</h1>
      <p className="lede">Current public rates (edit in catalog data for now).</p>
      <div className="package-grid admin-packages">
        {packages.map((pkg) => (
          <article key={pkg.id} className="package-card">
            <h3>{pkg.name}</h3>
            <p className="package-tag">{pkg.tagline}</p>
            <p className="package-price">
              <span>{formatPrice(pkg.hourlyRate)}</span>
              <small>/ hour · min {pkg.minHours}h</small>
            </p>
            <ul>
              {pkg.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  )
}

function AdminClients() {
  const { users } = useAuth()
  const clients = users.filter((u) => u.role === 'user')
  const { getUserBookings } = useBookings()

  return (
    <div className="dash-panel">
      <h1>Clients</h1>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Bookings</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>{c.phone || '—'}</td>
                <td>{getUserBookings(c.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const { user, logout } = useAuth()

  if (!user) return <Navigate to="/login?next=/admin" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />

  return (
    <div className="dash-shell">
      <Sidebar
        title="Admin"
        items={items}
        footer={
          <button type="button" className="btn-outline btn-block" onClick={logout}>
            Sign out
          </button>
        }
      />
      <div className="dash-main">
        <header className="dash-top">
          <NavLink to="/">← Back to site</NavLink>
          <span>Admin · {user.name}</span>
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
