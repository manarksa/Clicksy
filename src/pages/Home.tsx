import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { formatPrice, packages } from '../data/catalog'

export function Home() {
  return (
    <div className="page">
      <Navbar />

      <section className="hero">
        <div className="hero-bg" aria-hidden>
          <div className="hero-grain" />
          <div className="hero-beam" />
          <div className="hero-frame" />
        </div>
        <div className="hero-content">
          <p className="brand-lockup">Clicksy</p>
          <h1>Your night, framed.</h1>
          <p className="hero-sub">
            Premium event crews for weddings, parties, and brand nights —
            booked in minutes, delivered like a studio.
          </p>
          <div className="hero-cta">
            <Link to="/book" className="btn btn-navy btn-lg">
              Build your quote
            </Link>
            <a href="#packages" className="btn btn-ghost-light btn-lg">
              View packages
            </a>
          </div>
        </div>
        <div className="hero-meter" aria-hidden>
          <span>ISO 400</span>
          <span>f/1.8</span>
          <span>1/125</span>
        </div>
      </section>

      <section className="strip" aria-label="Studio promise">
        <div className="strip-item">
          <strong>Browse first</strong>
          <span>No account needed to explore</span>
        </div>
        <div className="strip-item">
          <strong>Live pricing</strong>
          <span>Hours × package, market-aligned</span>
        </div>
        <div className="strip-item">
          <strong>Sign in to lock</strong>
          <span>Confirm only when you are ready</span>
        </div>
      </section>

      <section id="packages" className="section packages">
        <div className="section-head">
          <p className="eyebrow">Packages</p>
          <h2>Three crews. One standard.</h2>
          <p>
            Pick a package, choose your event, set the hours — see a clear
            estimate before you commit.
          </p>
        </div>
        <div className="package-grid">
          {packages.map((pkg) => (
            <article
              key={pkg.id}
              className={`package-card${pkg.popular ? ' popular' : ''}`}
            >
              {pkg.popular && <span className="badge">Most booked</span>}
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
              <Link
                to={`/book?package=${pkg.id}`}
                className="btn btn-navy btn-block"
              >
                Select {pkg.name}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="section how">
        <div className="section-head">
          <p className="eyebrow">How it works</p>
          <h2>From scroll to shoot.</h2>
        </div>
        <ol className="steps">
          <li>
            <span className="step-num">01</span>
            <h3>Choose a package</h3>
            <p>Essential, Signature, or Prestige — matched to your night.</p>
          </li>
          <li>
            <span className="step-num">02</span>
            <h3>Set the scene</h3>
            <p>Event type, hours, date, and location. Watch the quote update.</p>
          </li>
          <li>
            <span className="step-num">03</span>
            <h3>Sign in &amp; lock it</h3>
            <p>Browse freely. We only ask for an account when you confirm.</p>
          </li>
        </ol>
      </section>

      <section className="cta-band">
        <div className="cta-band-inner">
          <h2>Ready when the lights go down.</h2>
          <p>Build a quote in under two minutes. No deposit until we confirm.</p>
          <Link to="/book" className="btn btn-white btn-lg">
            Start booking
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
