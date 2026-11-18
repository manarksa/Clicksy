import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useI18n } from '../context/LanguageContext'
import { formatPrice, packages } from '../data/catalog'
import { fill, packageCopy } from '../i18n/messages'

export function Packages() {
  const { lang, t } = useI18n()

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
          {packages.map((pkg) => {
            const copy = packageCopy(t, pkg.id)
            return (
              <article
                key={pkg.id}
                className={`package-card${pkg.popular ? ' popular' : ''}`}
              >
                {pkg.popular && <span className="badge">{t.packages.popular}</span>}
                <h3>{pkg.name}</h3>
                <p className="package-tag">{copy?.tagline}</p>
                <p className="package-price">
                  <span>{formatPrice(pkg.hourlyRate, lang)}</span>
                  <small>{fill(t.packages.rateLine, { hours: pkg.minHours })}</small>
                </p>
                <ul>
                  {copy?.features.map((feature) => (
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
