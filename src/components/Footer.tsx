import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/LanguageContext'
import { Logo } from './Logo'

const copyrightYear = new Date().getFullYear()

export function Footer() {
  const { t } = useI18n()
  const { user } = useAuth()

  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Logo light />
          <p>{t.footer.blurb}</p>
        </div>
        <div>
          <h4>{t.footer.studio}</h4>
          <ul>
            <li>
              <Link to="/packages">{t.nav.packages}</Link>
            </li>
            <li>
              <Link to="/book">{t.footer.bookCrew}</Link>
            </li>
            <li>
              <Link to={{ pathname: '/', hash: 'how' }}>{t.nav.how}</Link>
            </li>
            <li>
              <Link to="/help">{t.nav.help}</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>{t.footer.account}</h4>
          <ul>
            <li>
              <Link to="/login">{t.nav.signIn}</Link>
            </li>
            {user && (
              <li>
                <Link to={user.role === 'admin' ? '/admin' : '/dashboard'}>{t.nav.desk}</Link>
              </li>
            )}
          </ul>
        </div>
        <div>
          <h4>{t.footer.contact}</h4>
          <ul>
            <li>hello@clicksy.com</li>
            <li>+966 11 000 4455</li>
            <li>{t.footer.cities}</li>
          </ul>
        </div>
      </div>
      <div className="footer-bar">
        <span>
          © {copyrightYear} {t.footer.rights}
        </span>
        <span className="footer-tag">{t.footer.tag}</span>
      </div>
    </footer>
  )
}
