import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useI18n } from '../context/LanguageContext'

export function Home() {
  const { t } = useI18n()

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
          <h1>{t.hero.title}</h1>
          <p className="hero-sub">{t.hero.sub}</p>
          <div className="hero-cta">
            <Link to="/book" className="btn btn-lg">
              {t.hero.quote}
            </Link>
            <Link to="/packages" className="btn-outline btn-lg">
              {t.hero.viewPackages}
            </Link>
          </div>
        </div>
        <div className="hero-meter" aria-hidden>
          <span>ISO 400</span>
          <span>f/1.8</span>
          <span>1/125</span>
        </div>
      </section>

      <section className="strip" aria-label={t.strip.label}>
        <div className="strip-item">
          <strong>{t.strip.browseTitle}</strong>
          <span>{t.strip.browseText}</span>
        </div>
        <div className="strip-item">
          <strong>{t.strip.priceTitle}</strong>
          <span>{t.strip.priceText}</span>
        </div>
        <div className="strip-item">
          <strong>{t.strip.lockTitle}</strong>
          <span>{t.strip.lockText}</span>
        </div>
      </section>

      <section id="how" className="section how">
        <div className="section-head">
          <p className="eyebrow">{t.how.eyebrow}</p>
          <h2>{t.how.title}</h2>
        </div>
        <ol className="steps">
          <li>
            <span className="step-num">01</span>
            <h3>{t.how.oneTitle}</h3>
            <p>{t.how.oneText}</p>
          </li>
          <li>
            <span className="step-num">02</span>
            <h3>{t.how.twoTitle}</h3>
            <p>{t.how.twoText}</p>
          </li>
          <li>
            <span className="step-num">03</span>
            <h3>{t.how.threeTitle}</h3>
            <p>{t.how.threeText}</p>
          </li>
        </ol>
      </section>

      <section className="cta-band">
        <div className="cta-band-inner">
          <h2>{t.cta.title}</h2>
          <p>{t.cta.body}</p>
          <Link to="/book" className="btn btn-lg">
            {t.cta.button}
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
