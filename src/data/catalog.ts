import type { Lang } from '../i18n/messages'
import type { EventType, Package } from '../types'

export const packages: Package[] = [
  {
    id: 'essential',
    name: 'Essential',
    tagline: 'Clean coverage for intimate gatherings',
    hourlyRate: 450,
    minHours: 3,
    features: [
      '1 lead photographer',
      'Edited photo gallery',
      'Online delivery in 7 days',
      'Personal usage license',
    ],
  },
  {
    id: 'signature',
    name: 'Signature',
    tagline: 'Photo + film highlights for the full night',
    hourlyRate: 750,
    minHours: 4,
    popular: true,
    features: [
      'Photographer + videographer',
      '60–90s highlight reel',
      'Color-graded stills',
      'Priority delivery in 5 days',
      'Social media cutdowns',
    ],
  },
  {
    id: 'prestige',
    name: 'Prestige',
    tagline: 'Full studio crew. Cinematic everything.',
    hourlyRate: 1200,
    minHours: 6,
    features: [
      '2 photographers + 1 videographer',
      'Drone / cinematic B-roll*',
      'Full event film + album-ready edits',
      'Same-week preview selects',
      'Dedicated creative director',
      'Raw files on request',
    ],
  },
]

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
