import type { Lang } from '../i18n/messages'
import type { EventType } from '../types'

// Packages (prices, minimum hours, features) live in the database: tables packages +
// package_features, served by GET /api/packages. See server/packages.js and usePackages().

export const eventTypes: EventType[] = [
  {
    id: 'wedding',
    name: 'Wedding',
    description: 'Ceremony, reception, and the quiet in-between frames.',
  },
  {
    id: 'engagement',
    name: 'Engagement',
    description: 'Soft light, styled portraits, and couple storytelling.',
  },
  {
    id: 'birthday',
    name: 'Birthday',
    description: 'From surprise reveals to dance-floor energy.',
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Conferences, launches, and brand moments that land.',
  },
  {
    id: 'graduation',
    name: 'Graduation',
    description: 'Caps, gowns, and the pride of the day.',
  },
  {
    id: 'private',
    name: 'Private Party',
    description: 'Intimate dinners, rooftops, and custom nights.',
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Name the occasion yourself.',
  },
]

export const currency = 'SAR'

export function formatPrice(amount: number, lang: Lang): string {
  const formatted = amount.toLocaleString('en-US')
  return lang === 'ar' ? `${formatted} ر.س` : `${formatted} ${currency}`
}

export function estimateTotal(hourlyRate: number, hours: number): number {
  return hourlyRate * hours
}
