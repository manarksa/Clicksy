import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { estimateTotal, eventTypes, packages } from '../data/catalog'
import type { Booking, BookingDraft, BookingStatus, User } from '../types'

const BOOKINGS_KEY = 'clicksy_bookings'
const DRAFT_KEY = 'clicksy_draft'

const seedBookings: Booking[] = [
  {
    id: 'bk-1001',
    userId: 'user-1',
    userName: 'Sara Alharbi',
    userEmail: 'sara@email.com',
    userPhone: '+966 55 111 2222',
    packageId: 'signature',
    packageName: 'Signature',
    eventTypeId: 'engagement',
    eventTypeName: 'Engagement',
    hours: 5,
    eventDate: '2026-12-12',
    location: 'Riyadh — Al Nakheel',
    notes: 'Golden hour portraits before dinner.',
    totalPrice: 3750,
    status: 'confirmed',
    createdAt: '2026-10-20T10:00:00.000Z',
  },
]

function loadBookings(): Booking[] {
  const raw = localStorage.getItem(BOOKINGS_KEY)
  if (!raw) {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(seedBookings))
    return seedBookings
  }
  try {
    return JSON.parse(raw) as Booking[]
  } catch {
    return seedBookings
  }
}

function loadDraft(): BookingDraft | null {
  const raw = localStorage.getItem(DRAFT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as BookingDraft
  } catch {
    return null
  }
}

interface BookingContextValue {
  bookings: Booking[]
  draft: BookingDraft | null
  saveDraft: (draft: BookingDraft) => void
  clearDraft: () => void
  createBooking: (user: User, draft: BookingDraft) => Booking
  updateStatus: (id: string, status: BookingStatus) => void
  getUserBookings: (userId: string) => Booking[]
}

const BookingContext = createContext<BookingContextValue | null>(null)

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(loadBookings)
  const [draft, setDraft] = useState<BookingDraft | null>(loadDraft)

  const persist = useCallback((next: Booking[]) => {
    setBookings(next)
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(next))
  }, [])

  const saveDraft = useCallback((next: BookingDraft) => {
    setDraft(next)
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
  }, [])

  const clearDraft = useCallback(() => {
    setDraft(null)
    localStorage.removeItem(DRAFT_KEY)
  }, [])

  const createBooking = useCallback(
    (user: User, data: BookingDraft) => {
      const pkg = packages.find((p) => p.id === data.packageId)
      const event = eventTypes.find((e) => e.id === data.eventTypeId)
      if (!pkg || !event) {
        throw new Error('Invalid package or event type')
      }

      const booking: Booking = {
        id: `bk-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone,
        packageId: pkg.id,
        packageName: pkg.name,
        eventTypeId: event.id,
        eventTypeName: event.name,
        hours: data.hours,
        eventDate: data.eventDate,
        location: data.location,
        notes: data.notes,
        totalPrice: estimateTotal(pkg.hourlyRate, data.hours),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }

      persist([booking, ...bookings])
      clearDraft()
      return booking
    },
    [bookings, clearDraft, persist],
  )

  const updateStatus = useCallback(
    (id: string, status: BookingStatus) => {
      persist(
        bookings.map((b) => (b.id === id ? { ...b, status } : b)),
      )
    },
    [bookings, persist],
  )

  const getUserBookings = useCallback(
    (userId: string) => bookings.filter((b) => b.userId === userId),
    [bookings],
  )

  const value = useMemo(
    () => ({
      bookings,
      draft,
      saveDraft,
      clearDraft,
      createBooking,
      updateStatus,
      getUserBookings,
    }),
    [
      bookings,
      draft,
      saveDraft,
      clearDraft,
      createBooking,
      updateStatus,
      getUserBookings,
    ],
  )

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  )
}

export function useBookings() {
  const ctx = useContext(BookingContext)
  if (!ctx) throw new Error('useBookings must be used within BookingProvider')
  return ctx
}
