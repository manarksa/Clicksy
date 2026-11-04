import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../context/BookingContext'
import { formatPrice } from '../data/catalog'

const items = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/dashboard/bookings', label: 'My bookings' },
  { to: '/dashboard/profile', label: 'Profile' },
  { to: '/book', label: 'New booking' },
]

function Overview() {
  const { user } = useAuth()
  const { getUserBookings } = useBookings()
  const bookings = user ? getUserBookings(user.id) : []
  const upcoming = bookings.filter((b) => b.status !== 'cancelled')

  return (
    <div className="dash-panel">
      <h1>Hello, {user?.name.split(' ')[0]}</h1>
      <p className="lede">Your shoots, status, and studio details in one place.</p>
      <div className="stat-row">
        <div className="stat">
          <span>Bookings</span>
          <strong>{bookings.length}</strong>
        </div>
        <div className="stat">
          <span>Active</span>
          <strong>{upcoming.length}</strong>
        </div>
        <div className="stat">
          <span>Next date</span>
          <strong>
            {upcoming[0]?.eventDate
              ? new Date(upcoming[0].eventDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })
              : '—'}
          </strong>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Package</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5}>No bookings yet. Start from the Book page.</td>
              </tr>
            )}
            {bookings.slice(0, 5).map((b) => (
              <tr key={b.id}>
                <td>{b.eventTypeName}</td>
                <td>{b.packageName}</td>
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

function BookingsList() {
  const { user } = useAuth()
  const { getUserBookings } = useBookings()
  const bookings = user ? getUserBookings(user.id) : []

  return (
    <div className="dash-panel">
      <h1>My bookings</h1>
      <div className="booking-list">
        {bookings.length === 0 && <p>No bookings yet.</p>}
        {bookings.map((b) => (
          <article key={b.id} className="booking-item">
            <div>
              <h3>
                {b.eventTypeName} · {b.packageName}
              </h3>
              <p>
                {b.eventDate} · {b.hours}h · {b.location}
              </p>
              {b.notes && <p className="muted">{b.notes}</p>}
            </div>
            <div className="booking-meta">
              <strong>{formatPrice(b.totalPrice)}</strong>
              <span className={`status status-${b.status}`}>{b.status}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function Profile() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="dash-panel">
      <h1>Profile</h1>
      <dl className="profile-grid">
        <div>
          <dt>Name</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{user.phone || '—'}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{user.role}</dd>
        </div>
      </dl>
    </div>
  )
}

export function UserDashboard() {
  const { user, logout } = useAuth()

  if (!user) return <Navigate to="/login?next=/dashboard" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />

  return (
    <div className="dash-shell">
      <Sidebar
        title="My Studio"
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
          <span>{user.email}</span>
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
