import { calculatePickupDate } from '@/lib/reservationDisplayUtils'

export type SmsTemplateDateLocale = 'ko' | 'en' | 'ja' | 'zh'

export function formatSmsTemplateDate(
  isoDate: string | null | undefined,
  locale: SmsTemplateDateLocale
): string {
  const raw = isoDate?.trim()
  if (!raw) return '—'
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!iso) return raw
  if (locale === 'ja') return `${iso[1]}/${iso[2]}/${iso[3]}`
  if (locale === 'en') return `${iso[2]}/${iso[3]}/${iso[1]}`
  if (locale === 'zh') return `${iso[1]}年${iso[2]}月${iso[3]}日`
  return `${iso[1]}-${iso[2]}-${iso[3]}`
}

export function resolvePickupDateIso(
  tourDate: string | null | undefined,
  pickupTime: string | null | undefined
): string {
  const tour = tourDate?.trim()
  if (!tour) return ''
  const time = pickupTime?.trim()
  if (!time) return tour
  return calculatePickupDate(time, tour)
}

export function formatSmsPickupTime(pickupTime: string | null | undefined): string {
  const raw = pickupTime?.trim()
  if (!raw) return ''
  const m = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return raw
  const h = parseInt(m[1], 10)
  const min = m[2]
  if (h >= 12) {
    const h12 = h === 12 ? 12 : h - 12
    return `${h12}:${min} PM`
  }
  const h12 = h === 0 ? 12 : h
  return `${h12}:${min} AM`
}

export function buildSmsPickupDateTimeLine(
  tourDate: string | null | undefined,
  pickupTime: string | null | undefined,
  locale: SmsTemplateDateLocale
): string {
  const pickupDateIso = resolvePickupDateIso(tourDate, pickupTime)
  const datePart = formatSmsTemplateDate(pickupDateIso, locale)
  const timePart = formatSmsPickupTime(pickupTime)
  if (!timePart || timePart === '') return datePart
  return `${datePart} ${timePart}`.trim()
}

export type SmsDatePlaceholderValues = {
  tourDate: string
  pickupDate: string
  pickupTime: string
  pickupDateTime: string
}

export function buildSmsDatePlaceholderValues(
  tourDate: string | null | undefined,
  pickupTime: string | null | undefined,
  locale: SmsTemplateDateLocale
): SmsDatePlaceholderValues {
  const pickupDateIso = resolvePickupDateIso(tourDate, pickupTime)
  const pickupTimePlain = formatSmsPickupTime(pickupTime) || '—'
  return {
    tourDate: formatSmsTemplateDate(tourDate, locale),
    pickupDate: formatSmsTemplateDate(pickupDateIso, locale),
    pickupTime: pickupTimePlain,
    pickupDateTime: buildSmsPickupDateTimeLine(tourDate, pickupTime, locale),
  }
}

export function applySmsDatePlaceholders(
  bodyTpl: string,
  values: SmsDatePlaceholderValues
): string {
  return bodyTpl
    .replace(/\{\{TOUR_DATE\}\}/g, values.tourDate)
    .replace(/\{\{PICKUP_DATE\}\}/g, values.pickupDate)
    .replace(/\{\{PICKUP_TIME\}\}/g, values.pickupTime)
    .replace(/\{\{PICKUP_DATE_TIME\}\}/g, values.pickupDateTime)
}

export const SMS_DATE_PLACEHOLDER_HINT =
  '{{TOUR_DATE}}, {{PICKUP_DATE}}, {{PICKUP_TIME}}, {{PICKUP_DATE_TIME}}'
