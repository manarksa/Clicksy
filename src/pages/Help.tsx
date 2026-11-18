import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { useI18n } from '../context/LanguageContext'
import { isIntroDisabled, setIntroDisabled } from '../introPreference'

export function Help() {
  const { t } = useI18n()
  const [glowOff, setGlowOff] = useState(isIntroDisabled)

  function toggleGlow() {
    const next = !glowOff
    setIntroDisabled(next)
    setGlowOff(next)
  }

  return (
    <div className="page">
      <Navbar />
      <section className="section">
        <div className="section-head">
          <p className="eyebrow">{t.help.eyebrow}</p>
          <h2>{t.help.title}</h2>
          <p>{t.help.intro}</p>
        </div>
        <div className="help-list">
          <article>
            <h2>{t.help.bookingTitle}</h2>
            <p>{t.help.bookingBody}</p>
            <p>
              <Link to="/book">{t.nav.book}</Link>
            </p>
          </article>
          <article>
            <h2>{t.help.packagesTitle}</h2>
            <p>{t.help.packagesBody}</p>
            <p>
              <Link to="/packages">{t.nav.packages}</Link>
            </p>
          </article>
          <article>
            <h2>{t.help.flashTitle}</h2>
            <p>{t.help.flashBody}</p>
            <p>{glowOff ? t.help.flashIsOff : t.help.flashIsOn}</p>
            <p>
              <button type="button" className="btn" onClick={toggleGlow}>
                {glowOff ? t.help.flashOn : t.help.flashOff}
              </button>
            </p>
          </article>
        </div>
      </section>
      <Footer />
    </div>
  )
}
