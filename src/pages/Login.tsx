import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Logo } from '../components/Logo'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/dashboard'
  const intent = params.get('intent')

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function redirectAfterAuth(role: 'user' | 'admin') {
    if (intent === 'confirm' && next === '/book') {
      navigate('/book?intent=confirm')
      return
    }
    if (next === '/dashboard' && role === 'admin') {
      navigate('/admin')
      return
    }
    navigate(next)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (mode === 'login') {
      const result = login(email, password)
      if (!result.ok || !result.user) {
        setError(result.error || 'Could not sign in.')
        return
      }
      redirectAfterAuth(result.user.role)
      return
    }

    const result = register({ name, email, phone, password })
    if (!result.ok || !result.user) {
      setError(result.error || 'Could not create account.')
      return
    }
    redirectAfterAuth(result.user.role)
  }

  return (
    <div className="page">
      <Navbar />
      <main className="auth-page">
        <div className="auth-card">
          <Logo size="sm" />
          <h1>{mode === 'login' ? 'Welcome back' : 'Join Clicksy'}</h1>
          <p>
            {intent === 'confirm'
              ? 'Sign in to lock your booking. Your quote is saved.'
              : 'Demo tip: admin@clicksy.com or sara@email.com — any password.'}
          </p>

          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : undefined}
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : undefined}
              onClick={() => setMode('register')}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <>
                <label>
                  Full name
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+966 …"
                  />
                </label>
              </>
            )}
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Any password for demo"
              />
            </label>
            {error && <p className="form-msg error">{error}</p>}
            <button type="submit" className="btn btn-navy btn-block">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="auth-foot">
            <Link to="/book">Back to booking</Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
