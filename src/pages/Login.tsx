import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Logo } from '../components/Logo'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/LanguageContext'
import { suggestEmail } from '../data/emailTypos'
import { fill, type AuthErrorCode, type Messages } from '../i18n/messages'
import type { UserRole } from '../types'

/** Only allow redirects to paths inside this site (blocks `//evil.com`). */
function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function homeFor(role: UserRole) {
  return role === 'admin' ? '/admin' : '/dashboard'
}

function errorText(t: Messages, code: string) {
  return (t.errors as Record<string, string>)[code] ?? t.errors.server
}

export function Login() {
  const { user, login, register, verify, resend } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const intent = params.get('intent')

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthErrorCode | string>('')
  const [notice, setNotice] = useState('')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)

  // Already signed in (and not in the middle of our own redirect): open the right desk.
  if (user && !redirecting) return <Navigate to={homeFor(user.role)} replace />

  function redirectAfterAuth(role: UserRole) {
    setRedirecting(true)
    // The owner desk never books on behalf of itself.
    if (role === 'admin') {
      navigate('/admin', { replace: true })
      return
    }
    if (intent === 'confirm' && next === '/book') {
      navigate('/book?intent=confirm', { replace: true })
      return
    }
    navigate(next ?? '/dashboard', { replace: true })
  }

  function switchMode(nextMode: 'login' | 'register') {
    setMode(nextMode)
    setError('')
    setSuggestion(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setSuggestion(null)
    // Catch gamil.com / gmail.con before the code is sent to an address that cannot receive it.
    const fixed = mode === 'register' ? suggestEmail(email) : null
    if (fixed) {
      setError('emailTypo')
      setSuggestion(fixed)
      return
    }
    setBusy(true)
    const result =
      mode === 'login'
        ? await login(email, password)
        : await register({ name, email, phone, password })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setCode('')
    setStep('code')
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const result = await verify(email, code)
    setBusy(false)
    if (!result.ok || !result.user) {
      setError(result.ok ? 'server' : result.error)
      return
    }
    redirectAfterAuth(result.user.role)
  }

  async function handleResend() {
    setError('')
    setNotice('')
    const result = await resend(email)
    if (result.ok) setNotice(t.login.resent)
    else setError(result.error)
  }

  return (
    <div className="page">
      <Navbar />
      <main className="auth-page">
        <div className="auth-shell reveal">
          <aside className="auth-aside" aria-hidden>
            <div className="auth-aside-inner">
              <Logo light size="lg" />
              <p className="auth-aside-title">{t.hero.title}</p>
              <p className="auth-aside-sub">{t.hero.sub}</p>
              <div className="auth-aside-meter">
                <span>ISO 400</span>
                <span>f/1.8</span>
                <span>1/125</span>
              </div>
            </div>
          </aside>

          <div className="auth-card">
            {step === 'code' ? (
              <form onSubmit={handleVerify} className="auth-form" key="code">
                <div className="auth-mail-icon" aria-hidden>
                  ✉
                </div>
                <h1>{t.login.codeTitle}</h1>
                <p className="auth-lede">{fill(t.login.codeSent, { email })}</p>
                <p className="auth-note">{t.login.checkSpam}</p>
                <label>
                  {t.login.code}
                  <input
                    className="code-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    required
                    autoFocus
                    maxLength={6}
                    pattern="\d{6}"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                  />
                </label>
                {error && (
                  <p className="form-msg error" role="alert">
                    {errorText(t, error)}
                  </p>
                )}
                {notice && (
                  <p className="form-msg" role="status">
                    {notice}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn btn-lg btn-block"
                  disabled={busy || code.length !== 6}
                >
                  {busy ? t.login.wait : t.login.verify}
                </button>
                <div className="auth-code-actions">
                  <button type="button" className="link-btn" onClick={handleResend}>
                    {t.login.resend}
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setStep('form')
                      setError('')
                      setNotice('')
                    }}
                  >
                    {t.login.changeEmail}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h1>{mode === 'login' ? t.login.welcome : t.login.join}</h1>
                {intent === 'confirm' && <p className="auth-note">{t.login.confirmNote}</p>}

                <div className="auth-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'login'}
                    className={mode === 'login' ? 'active' : undefined}
                    onClick={() => switchMode('login')}
                  >
                    {t.login.signIn}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'register'}
                    className={mode === 'register' ? 'active' : undefined}
                    onClick={() => switchMode('register')}
                  >
                    {t.login.create}
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                  {mode === 'register' && (
                    <>
                      <label>
                        {t.login.name}
                        <input
                          required
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t.login.namePh}
                        />
                      </label>
                      <label>
                        {t.login.phone}
                        <input
                          type="tel"
                          autoComplete="tel"
                          dir="ltr"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+966 5x xxx xxxx"
                        />
                      </label>
                    </>
                  )}
                  <label>
                    {t.login.email}
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                    />
                  </label>
                  <label>
                    {t.login.password}
                    <input
                      type="password"
                      required
                      minLength={mode === 'register' ? 6 : undefined}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.login.passwordPh}
                    />
                  </label>
                  {error && (
                    <p className="form-msg error" role="alert">
                      {errorText(t, error)}
                      {suggestion && (
                        <>
                          {' '}
                          <span dir="auto">{fill(t.login.didYouMean, { email: suggestion })}</span>{' '}
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => {
                              setEmail(suggestion)
                              setSuggestion(null)
                              setError('')
                            }}
                          >
                            {t.login.useSuggestion}
                          </button>
                        </>
                      )}
                    </p>
                  )}
                  <button type="submit" className="btn btn-lg btn-block" disabled={busy}>
                    {busy ? t.login.wait : mode === 'login' ? t.login.signIn : t.login.create}
                  </button>
                </form>
              </>
            )}

            <p className="auth-foot">
              <Link to="/book">{t.login.back}</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
