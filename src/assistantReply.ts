import { estimateTotal, formatPrice } from './data/catalog'
import { eventCopy, fill, type Lang, type Messages } from './i18n/messages'
import type { Package } from './types'

export type Ask = 'event' | 'guests' | 'coverage' | null

export type Slots = {
  choosing: boolean
  eventId?: string
  guests?: 'small' | 'mid' | 'large'
  coverage?: 'photos' | 'film' | 'full'
  budget?: number
}

const emptySlots = (): Slots => ({ choosing: false })

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word.toLowerCase()))
}

function eventFromText(text: string, t: Messages) {
  const pairs: Array<[string, string[]]> = [
    ['wedding', ['wedding', 'عرس', 'زفاف', eventCopy(t, 'wedding')?.name ?? '']],
    ['engagement', ['engagement', 'خطوبة', 'ملكة', eventCopy(t, 'engagement')?.name ?? '']],
    ['birthday', ['birthday', 'ميلاد', eventCopy(t, 'birthday')?.name ?? '']],
    ['corporate', ['corporate', 'شركات', 'مؤتمر', eventCopy(t, 'corporate')?.name ?? '']],
    ['graduation', ['graduation', 'تخرج', eventCopy(t, 'graduation')?.name ?? '']],
    ['private', ['private party', 'حفل خاص', eventCopy(t, 'private')?.name ?? '']],
    ['other', ['other', 'أخرى', eventCopy(t, 'other')?.name ?? '']],
  ]
  return pairs.find(([, words]) => includesAny(text, words.filter(Boolean)))?.[0]
}

function readSlots(text: string, t: Messages, current: Slots): Slots {
  const next: Slots = { ...current }
  const eventId = eventFromText(text, t)
  if (eventId) next.eventId = eventId

  if (text === t.assistant.small.toLowerCase() || includesAny(text, ['under 50', 'أقل من 50', '<50'])) {
    next.guests = 'small'
  } else if (text === t.assistant.large.toLowerCase() || includesAny(text, ['more than 150', 'أكثر من 150', '150+'])) {
    next.guests = 'large'
  } else if (text === t.assistant.mid.toLowerCase() || includesAny(text, ['50 to 150', '50 إلى 150', 'من 50'])) {
    next.guests = 'mid'
  }

  if (text === t.assistant.photos.toLowerCase() || includesAny(text, ['photos only', 'صور فقط'])) {
    next.coverage = 'photos'
  } else if (text === t.assistant.full.toLowerCase() || includesAny(text, ['full crew', 'طاقم كامل', 'drone', 'درون', 'جوي'])) {
    next.coverage = 'full'
  } else if (text === t.assistant.film.toLowerCase() || includesAny(text, ['photos and film', 'صور وفيلم', 'video', 'فيديو', 'فيلم'])) {
    next.coverage = 'film'
  }

  const amount = text.match(/(\d[\d,]*)/)
  const value = amount ? Number(amount[1].replace(/,/g, '')) : NaN
  if (Number.isFinite(value) && (value >= 1000 || includesAny(text, ['budget', 'ميزانية', 'ريال', 'sar']))) {
    next.budget = value
  }

  return next
}

function idealPackage(slots: Slots) {
  if (slots.coverage === 'full') return 'prestige'
  if (slots.coverage === 'film') return 'signature'
  if (slots.guests === 'large' && (slots.eventId === 'wedding' || slots.eventId === 'corporate')) {
    return 'prestige'
  }
  if (slots.eventId === 'wedding' || slots.eventId === 'corporate') return 'signature'
  return 'essential'
}

function packageFacts(packages: Package[], id: string, lang: Lang) {
  const pkg = packages.find((item) => item.id === id) ?? packages[0]
  return {
    name: pkg.name,
    price: formatPrice(pkg.hourlyRate, lang),
    hours: pkg.minHours,
    minimum: formatPrice(estimateTotal(pkg.hourlyRate, pkg.minHours), lang),
    tagline: pkg.tagline,
    features: pkg.features.join(lang === 'ar' ? '، ' : ', '),
  }
}

function recommend(packages: Package[], slots: Slots, t: Messages, lang: Lang) {
  const ideal = packages.find((item) => item.id === idealPackage(slots)) ?? packages[0]
  const idealMin = estimateTotal(ideal.hourlyRate, ideal.minHours)
  const entry = packages[0]
  const entryMin = estimateTotal(entry.hourlyRate, entry.minHours)

  if (slots.budget != null && slots.budget < entryMin) {
    const facts = packageFacts(packages, entry.id, lang)
    return {
      packageId: entry.id,
      text: fill(t.assistant.budgetLow, facts),
    }
  }

  let chosen = ideal
  if (slots.budget != null && slots.budget < idealMin) {
    const affordable = [...packages]
      .filter((item) => estimateTotal(item.hourlyRate, item.minHours) <= slots.budget!)
      .sort((a, b) => b.hourlyRate - a.hourlyRate)
    chosen = affordable[0] ?? entry
  }

  const facts = packageFacts(packages, chosen.id, lang)
  return {
    packageId: chosen.id,
    text: fill(t.assistant.recommend, facts),
  }
}

/** packages: the active packages from the database, in the current language (cheapest first). */
export function assistantTurn(
  raw: string,
  slots: Slots,
  t: Messages,
  lang: Lang,
  packages: Package[],
) {
  const text = raw.trim().slice(0, 400).toLowerCase()
  let next = readSlots(text, t, slots)

  const wantsBooking =
    text === t.assistant.booking.toLowerCase() ||
    includesAny(text, ['how does booking', 'booking work', 'كيف يتم الحجز', 'خطوات الحجز'])
  if (wantsBooking && !next.choosing) {
    return { slots: next, text: t.assistant.bookingReply, ask: null as Ask, packageId: undefined }
  }

  const wantsChoice =
    text === t.assistant.choose.toLowerCase() ||
    text === t.assistant.wedding.toLowerCase() ||
    includesAny(text, ['package', 'باقة', 'choose', 'اختيار', 'ساعد'])
  if (wantsChoice || next.eventId) next = { ...next, choosing: true }

  if (!next.choosing) {
    return { slots: next, text: t.assistant.unknown, ask: null as Ask, packageId: undefined }
  }

  if (!next.eventId) {
    return { slots: next, text: t.assistant.askEvent, ask: 'event' as Ask, packageId: undefined }
  }
  if (!next.guests) {
    return { slots: next, text: t.assistant.askGuests, ask: 'guests' as Ask, packageId: undefined }
  }
  if (!next.coverage) {
    return { slots: next, text: t.assistant.askCoverage, ask: 'coverage' as Ask, packageId: undefined }
  }

  if (!packages.length) {
    return { slots: next, text: t.errors.server, ask: null as Ask, packageId: undefined }
  }
  const result = recommend(packages, next, t, lang)
  return { slots: { ...next, choosing: false }, ...result, ask: null as Ask }
}

export { emptySlots }
