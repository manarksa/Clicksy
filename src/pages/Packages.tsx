import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useI18n } from '../context/LanguageContext'
import { usePackages } from '../context/PackagesContext'
import { formatPrice } from '../data/catalog'
import { fill } from '../i18n/messages'

export function Packages() {
  const { lang, t } = useI18n()
  const { packages, status } = usePackages()

  return (
    <div className="page">
      <Navbar />
      <section className="section packages">
        <div className="section-head">
          <p className="eyebrow">{t.packages.eyebrow}</p>
          <h2>{t.packages.title}</h2>
          <p>{t.packages.intro}</p>
        </div>
        <div className="package-grid">
          {status === 'error' && <p className="form-msg">{t.errors.server}</p>}
          {packages.map((pkg) => {
            return (
              <article
                key={pkg.id}
                className={`package-card${pkg.popular ? ' popular' : ''}`}
              >
                {pkg.popular && <span className="badge">{t.packages.popular}</span>}
                <h3>{pkg.name}</h3>
                <p className="package-tag">{pkg.tagline}</p>
                <p className="package-price">
                  <span>{formatPrice(pkg.hourlyRate, lang)}</span>
                  <small>{fill(t.packages.rateLine, { hours: pkg.minHours })}</small>
                </p>
                <ul>
                  {pkg.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link
                  to={`/book?package=${pkg.id}`}
                  className="btn btn-block"
                >
                  {fill(t.packages.select, { name: pkg.name })}
                </Link>
              </article>
            )
          })}
        </div>
      </section>
      <Footer />
    </div>
  )
}
