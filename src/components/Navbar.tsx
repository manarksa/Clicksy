import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/LanguageContext'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Logo } from './Logo'

export function Navbar() {
  const { user, logout } = useAuth()
  const { t } = useI18n()

  return (
    <header className="header">
      <div className="nav-inner">
        <Logo />
        <nav className="nav-links" aria-label={t.nav.primary}>
          <NavLink to="/" end>
            {t.nav.home}
          </NavLink>
          <NavLink to="/packages">{t.nav.packages}</NavLink>
          <NavLink to="/book">{t.nav.book}</NavLink>
          <NavLink to="/help">{t.nav.help}</NavLink>
          {user && (
            <NavLink to={user.role === 'admin' ? '/admin' : '/dashboard'}>
              {t.nav.desk}
            </NavLink>
          )}
        </nav>
        <div className="nav-actions">
          <LanguageSwitcher />
          {user ? (
            <>
              <span className="nav-user">{user.name.split(' ')[0]}</span>
              <button type="button" className="btn-outline" onClick={logout}>
                {t.nav.signOut}
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn">
              {t.nav.signIn}
            </NavLink>
          )}
        </div>
      </div>
    </header>
  )
}
