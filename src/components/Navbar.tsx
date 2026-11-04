import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from './Logo'

export function Navbar() {
  const { user, logout } = useAuth()

  return (
    <header className="header">
      <div className="nav-inner">
        <Logo />
        <nav className="nav-links" aria-label="Primary">
          <a href="/#packages">Packages</a>
          <a href="/#how">How it works</a>
          <NavLink to="/book">Book</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin">Admin</NavLink>
          )}
          {user?.role === 'user' && (
            <NavLink to="/dashboard">My Studio</NavLink>
          )}
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-user">{user.name.split(' ')[0]}</span>
              <button type="button" className="btn-outline" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn">
              Sign in
            </NavLink>
          )}
        </div>
      </div>
    </header>
  )
}
