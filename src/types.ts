export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
}

export interface Package {
  id: string
  name: string
  tagline: string
  hourlyRate: number
  minHours: number
  features: string[]
  popular?: boolean
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
