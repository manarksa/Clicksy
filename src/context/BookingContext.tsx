import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api'
import type { Booking, BookingDraft, BookingStatus } from '../types'
import { useAuth } from './AuthContext'

// Only the unfinished quote stays in the browser. Bookings live in MySQL.
const DRAFT_KEY = 'clicksy_draft'

function loadDraft(): BookingDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as BookingDraft) : null
  } catch {
    return null
  }
}

interface BookingContextValue {
  bookings: Booking[]
  loading: boolean
  draft: BookingDraft | null
  saveDraft: (draft: BookingDraft) => void
  clearDraft: () => void
  /** Sends the booking to the server. Throws ApiError on failure. */
  createBooking: (draft: BookingDraft) => Promise<Booking>
  updateStatus: (id: string, status: BookingStatus) => Promise<void>
  reload: () => Promise<void>
}

const BookingContext = createContext<BookingContextValue | null>(null)

export function BookingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<BookingDraft | null>(loadDraft)

  const reload = useCallback(async () => {
    if (!user) {
      setBookings([])
      return
    }
    setLoading(true)
    try {
      const data = await api<{ bookings: Booking[] }>('/bookings')
      setBookings(data.bookings)
    } catch {
      setBookings([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // Fetching on sign-in / sign-out is exactly the external sync effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const saveDraft = useCallback((next: BookingDraft) => {
    setDraft(next)
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
    } catch {
      /* The draft still lives in memory for this visit. */
    }
  }, [])

  const clearDraft = useCallback(() => {
    setDraft(null)
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const createBooking = useCallback(
    async (data: BookingDraft) => {
      const { booking } = await api<{ booking: Booking }>('/bookings', { body: data })
      setBookings((current) => [booking, ...current])
      clearDraft()
      return booking
    },
    [clearDraft],
  )

  const updateStatus = useCallback(async (id: string, status: BookingStatus) => {
    const { booking } = await api<{ booking: Booking }>(`/bookings/${id}`, {
      method: 'PATCH',
      body: { status },
    })
    setBookings((current) => current.map((b) => (b.id === id ? booking : b)))
  }, [])

  const value = useMemo(
    () => ({ bookings, loading, draft, saveDraft, clearDraft, createBooking, updateStatus, reload }),
    [bookings, loading, draft, saveDraft, clearDraft, createBooking, updateStatus, reload],
  )

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
}

export function useBookings() {
  const ctx = useContext(BookingContext)
  if (!ctx) throw new Error('useBookings must be used within BookingProvider')
  return ctx
}
