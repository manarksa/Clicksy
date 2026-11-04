import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '../types'

const USERS_KEY = 'clicksy_users'
const SESSION_KEY = 'clicksy_session'

const seedUsers: User[] = [
  {
    id: 'admin-1',
    name: 'Studio Admin',
    email: 'admin@clicksy.com',
    phone: '+966 50 000 0000',
    role: 'admin',
  },
  {
    id: 'user-1',
    name: 'Sara Alharbi',
    email: 'sara@email.com',
    phone: '+966 55 111 2222',
    role: 'user',
  },
]

function loadUsers(): User[] {
  const raw = localStorage.getItem(USERS_KEY)
  if (!raw) {
    localStorage.setItem(USERS_KEY, JSON.stringify(seedUsers))
    return seedUsers
  }
  try {
    return JSON.parse(raw) as User[]
  } catch {
    return seedUsers
  }
}

function loadSession(): User | null {
  const id = localStorage.getItem(SESSION_KEY)
  if (!id) return null
  return loadUsers().find((u) => u.id === id) ?? null
}

interface AuthContextValue {
  user: User | null
  users: User[]
  login: (
    email: string,
    password: string,
  ) => { ok: boolean; error?: string; user?: User }
  register: (data: {
    name: string
    email: string
    phone: string
    password: string
  }) => { ok: boolean; error?: string; user?: User }
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(loadUsers)
  const [user, setUser] = useState<User | null>(loadSession)

  const persistUsers = useCallback((next: User[]) => {
    setUsers(next)
    localStorage.setItem(USERS_KEY, JSON.stringify(next))
  }, [])

  const login = useCallback(
    (email: string, _password: string) => {
      const found = users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
      )
      if (!found) {
        return { ok: false, error: 'No account found with that email.' }
      }
      setUser(found)
      localStorage.setItem(SESSION_KEY, found.id)
      return { ok: true, user: found }
    },
    [users],
  )

  const register = useCallback(
    (data: {
      name: string
      email: string
      phone: string
      password: string
    }) => {
      if (!data.name.trim() || !data.email.trim()) {
        return { ok: false, error: 'Name and email are required.' }
      }
      const exists = users.some(
        (u) => u.email.toLowerCase() === data.email.trim().toLowerCase(),
      )
      if (exists) {
        return { ok: false, error: 'An account with this email already exists.' }
      }
      const nextUser: User = {
        id: `user-${Date.now()}`,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        role: 'user',
      }
      const next = [...users, nextUser]
      persistUsers(next)
      setUser(nextUser)
      localStorage.setItem(SESSION_KEY, nextUser.id)
      return { ok: true, user: nextUser }
    },
    [persistUsers, users],
  )

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
  }, [])

  const value = useMemo(
    () => ({ user, users, login, register, logout }),
    [user, users, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
