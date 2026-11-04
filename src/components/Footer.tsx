import { Link } from 'react-router-dom'
import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Logo light />
          <p>
            Event photography &amp; film for nights worth remembering.
            White gloves. Black frames. Zero noise.
          </p>
        </div>
        <div>
          <h4>Studio</h4>
          <ul>
            <li>
              <a href="/#packages">Packages</a>
            </li>
            <li>
              <Link to="/book">Book a crew</Link>
            </li>
            <li>
              <a href="/#how">How it works</a>
            </li>
          </ul>
        </div>
        <div>
          <h4>Account</h4>
          <ul>
            <li>
              <Link to="/login">Sign in</Link>
            </li>
            <li>
              <Link to="/dashboard">My Studio</Link>
            </li>
            <li>
              <Link to="/admin">Admin</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>Contact</h4>
          <ul>
            <li>hello@clicksy.com</li>
            <li>+966 11 000 4455</li>
            <li>Riyadh · Jeddah · Dammam</li>
          </ul>
        </div>
      </div>
      <div className="footer-bar">
        <span>© {new Date().getFullYear()} Clicksy Studio</span>
        <span className="footer-tag">Shoot. Edit. Deliver.</span>
      </div>
    </footer>
  )
}
