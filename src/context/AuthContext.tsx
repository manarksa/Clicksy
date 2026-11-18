import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, errorCode } from '../api'
import type { User } from '../types'

type Result = { ok: true; user?: User } | { ok: false; error: string }

interface AuthContextValue {
  user: User | null
  /** True until the first "who am I?" check with the server finishes. */
  loading: boolean
  /** Step 1: checks the password and emails a 6-digit code. */
  login: (email: string, password: string) => Promise<Result>
  /** Step 1 for new clients: creates the account and emails a code. */
  register: (data: {
    name: string
    email: string
    phone: string
    password: string
  }) => Promise<Result>
  /** Step 2: checks the code and starts the session. */
  verify: (email: string, code: string) => Promise<Result>
  resend: (email: string) => Promise<Result>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function attempt<T>(run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await run() }
  } catch (err) {
    return { ok: false, error: errorCode(err) }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api<{ user: User }>('/auth/me')
      .then((data) => alive && setUser(data.user))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<Result> => {
    if (!email.trim() || !password) return { ok: false, error: 'required' }
    const r = await attempt(() => api('/auth/login', { body: { email, password } }))
    return r.ok ? { ok: true } : r
  }, [])

  const register = useCallback(
    async (data: { name: string; email: string; phone: string; password: string }): Promise<Result> => {
      if (!data.name.trim() || !data.email.trim()) return { ok: false, error: 'required' }
      if (data.password.length < 6) return { ok: false, error: 'short' }
      const r = await attempt(() => api('/auth/register', { body: data }))
      return r.ok ? { ok: true } : r
    },
    [],
  )

  const verify = useCallback(async (email: string, code: string): Promise<Result> => {
    const r = await attempt(() => api<{ user: User }>('/auth/verify', { body: { email, code } }))
    if (!r.ok) return r
    setUser(r.value.user)
    return { ok: true, user: r.value.user }
  }, [])

  const resend = useCallback(async (email: string): Promise<Result> => {
    const r = await attempt(() => api('/auth/resend', { body: { email } }))
    return r.ok ? { ok: true } : r
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, verify, resend, logout }),
    [user, loading, login, register, verify, resend, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
