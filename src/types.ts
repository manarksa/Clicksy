export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
}

/** A package as shown on the page, in the current language. */
export interface Package {
  id: string
  name: string
  tagline: string
  hourlyRate: number
  minHours: number
  features: string[]
  popular?: boolean
}

/** A package as /api/packages sends it: both languages (from the packages + package_features tables). */
export interface PackageRecord {
  id: string
  name: string
  hourlyRate: number
  minHours: number
  popular: boolean
  tagline: { en: string; ar: string }
  features: { en: string[]; ar: string[] }
}

export interface EventType {
  id: string
  name: string
  description: string
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Booking {
  id: string
  userId: string
  userName: string
  userEmail: string
  userPhone: string
  packageId: string
  packageName: string
  eventTypeId: string
  eventTypeName: string
  customEventName?: string
  hours: number
  eventDate: string
  location: string
  notes: string
  totalPrice: number
  status: BookingStatus
  createdAt: string
}

export interface BookingDraft {
  packageId: string
  eventTypeId: string
  customEventName?: string
  hours: number
  eventDate: string
  location: string
  notes: string
}
