import { formatRentalTimeDisplay } from '@/lib/rentalConfirmationOcrParse'
import { guidePreferredAppLocale } from '@/lib/guideLanguageDetection'
import {
  formatStaffNamesForSms,
  staffNameForSms,
  type RentalCarPickupDropoffCard,
  type RentalCarStaffMember,
} from '@/lib/rentalCarPickupDropoffQueue'

export type RentalCarPickupDropoffSmsKind = 'pickup' | 'return' | 'airport_shuttle'
export type RentalCarPickupDropoffSmsLocale = 'ko' | 'en'

export type RentalCarPickupDropoffSmsParams = {
  recipientName: string
  vehicleLabel: string
  company?: string | null
  location?: string | null
  agreementNumber?: string | null
  startDate?: string | null
  endDate?: string | null
  pickupTime?: string | null
  returnTime?: string | null
  lastUsers?: string | null
  returnCrew?: string | null
  returnVehicleLabel?: string | null
  continuingVehicleLabel?: string | null
  locale?: RentalCarPickupDropoffSmsLocale | string | null
}

export function rentalCarStaffSmsLocale(
  member: {
    languages?: string[] | string | null
    email?: string | null
  },
  fallback: RentalCarPickupDropoffSmsLocale = 'ko'
): RentalCarPickupDropoffSmsLocale {
  const languages = member.languages
  const hasLanguages =
    (Array.isArray(languages) && languages.length > 0) ||
    (typeof languages === 'string' && languages.trim().length > 0)
  if (!hasLanguages) return fallback
  return guidePreferredAppLocale({ languages }, member.email || undefined)
}

function isEn(params: RentalCarPickupDropoffSmsParams): boolean {
  return String(params.locale || 'ko').toLowerCase().startsWith('en')
}

function formatShortDate(raw?: string | null): string {
  const value = String(raw || '').trim()
  if (!value) return '—'
  const parts = value.split('-')
  if (parts.length !== 3) return value
  return `${Number(parts[1])}/${Number(parts[2])}`
}

function formatDateWithTime(rawDate?: string | null, rawTime?: string | null): string {
  const date = formatShortDate(rawDate)
  const time = formatRentalTimeDisplay(rawTime)
  if (date === '—' && !time) return '—'
  return time ? `${date} ${time}` : date
}

function formatClock(rawTime?: string | null): string {
  return formatRentalTimeDisplay(rawTime)
}

export function buildRentalCarPickupSms(params: RentalCarPickupDropoffSmsParams): string {
  if (isEn(params)) {
    const lines = [
      `[Mania Tour] Hi ${params.recipientName}, you are assigned to pick up the rental car today.`,
      `Vehicle: ${params.vehicleLabel}`,
    ]
    if (params.company) lines.push(`Company: ${params.company}`)
    if (params.location) lines.push(`Pickup location: ${params.location}`)
    if (params.pickupTime) lines.push(`Pickup time: ${formatClock(params.pickupTime)}`)
    if (params.agreementNumber) lines.push(`Agreement #: ${params.agreementNumber}`)
    if (params.startDate || params.endDate) {
      lines.push(
        `Period: ${formatDateWithTime(params.startDate, params.pickupTime)} ~ ${formatDateWithTime(params.endDate, params.returnTime)}`
      )
    }
    return lines.join('\n')
  }

  const lines = [
    `[Mania Tour] ${params.recipientName}님, 오늘 렌터카 픽업 담당입니다.`,
    `차량: ${params.vehicleLabel}`,
  ]
  if (params.company) lines.push(`회사: ${params.company}`)
  if (params.location) lines.push(`픽업 장소: ${params.location}`)
  if (params.pickupTime) lines.push(`픽업 시간: ${formatClock(params.pickupTime)}`)
  if (params.agreementNumber) lines.push(`계약번호: ${params.agreementNumber}`)
  if (params.startDate || params.endDate) {
    lines.push(
      `기간: ${formatDateWithTime(params.startDate, params.pickupTime)} ~ ${formatDateWithTime(params.endDate, params.returnTime)}`
    )
  }
  return lines.join('\n')
}

export function buildRentalCarReturnSms(params: RentalCarPickupDropoffSmsParams): string {
  if (isEn(params)) {
    const lines = [
      `[Mania Tour] Hi ${params.recipientName}, please return the rental car today.`,
      `Vehicle: ${params.vehicleLabel}`,
    ]
    if (params.location) lines.push(`Return location: ${params.location}`)
    if (params.returnTime) lines.push(`Return time: ${formatClock(params.returnTime)}`)
    if (params.lastUsers) lines.push(`Last users: ${params.lastUsers}`)
    if (params.company) lines.push(`Company: ${params.company}`)
    return lines.join('\n')
  }

  const lines = [
    `[Mania Tour] ${params.recipientName}님, 오늘 렌터카 반납 부탁드립니다.`,
    `차량: ${params.vehicleLabel}`,
  ]
  if (params.location) lines.push(`반납 장소: ${params.location}`)
  if (params.returnTime) lines.push(`반납 시간: ${formatClock(params.returnTime)}`)
  if (params.lastUsers) lines.push(`마지막 사용자: ${params.lastUsers}`)
  if (params.company) lines.push(`회사: ${params.company}`)
  return lines.join('\n')
}

export function buildRentalCarAirportShuttleSms(params: RentalCarPickupDropoffSmsParams): string {
  if (isEn(params)) {
    const returnCrew = params.returnCrew || 'the return crew'
    const returnVehicle = params.returnVehicleLabel || params.vehicleLabel
    const lines = [
      `[Mania Tour] Hi ${params.recipientName}, please pick up the team at the airport rental car center.`,
      `${returnCrew} is returning ${returnVehicle}.`,
    ]
    if (params.location) lines.push(`Location: ${params.location}`)
    if (params.returnTime) lines.push(`Return time: ${formatClock(params.returnTime)}`)
    if (params.continuingVehicleLabel) {
      lines.push(`Continuing vehicle: ${params.continuingVehicleLabel}`)
    }
    lines.push(`After the return, please pick up ${returnCrew} and bring them back.`)
    return lines.join('\n')
  }

  const returnCrew = params.returnCrew || '반납 팀'
  const returnVehicle = params.returnVehicleLabel || params.vehicleLabel
  const lines = [
    `[Mania Tour] ${params.recipientName}님, 공항 렌터카에서 픽업 부탁드립니다.`,
    `${returnCrew}님이 ${returnVehicle}을(를) 반납합니다.`,
  ]
  if (params.location) lines.push(`장소: ${params.location}`)
  if (params.returnTime) lines.push(`반납 시간: ${formatClock(params.returnTime)}`)
  if (params.continuingVehicleLabel) {
    lines.push(`계속 사용 차량: ${params.continuingVehicleLabel}`)
  }
  lines.push(`반납 후 ${returnCrew}을(를) 태워 와 주세요.`)
  return lines.join('\n')
}

export function buildRentalCarPickupDropoffSms(
  kind: RentalCarPickupDropoffSmsKind,
  params: RentalCarPickupDropoffSmsParams
): string {
  if (kind === 'pickup') return buildRentalCarPickupSms(params)
  if (kind === 'return') return buildRentalCarReturnSms(params)
  return buildRentalCarAirportShuttleSms(params)
}

export function rentalCarPickupDropoffSmsParamsForRecipient(input: {
  kind: RentalCarPickupDropoffSmsKind
  recipient: RentalCarStaffMember
  card: RentalCarPickupDropoffCard
  continuingVehicleLabel?: string | null
  locale?: RentalCarPickupDropoffSmsLocale
  fallbackLocale?: RentalCarPickupDropoffSmsLocale
}): RentalCarPickupDropoffSmsParams {
  const locale =
    input.locale || rentalCarStaffSmsLocale(input.recipient, input.fallbackLocale)
  const lastUsers = formatStaffNamesForSms(
    [input.card.lastTour?.guide, input.card.lastTour?.assistant],
    locale
  )
  return {
    recipientName: staffNameForSms(input.recipient, locale),
    vehicleLabel: input.card.vehicleLabel,
    company: input.card.rentalCompany,
    location: input.kind === 'pickup' ? input.card.pickupLocation : input.card.returnLocation,
    agreementNumber: input.card.agreementNumber,
    startDate: input.card.startDate,
    endDate: input.card.endDate,
    pickupTime: input.card.pickupTime,
    returnTime: input.card.returnTime,
    lastUsers,
    returnCrew: lastUsers || (locale === 'en' ? 'the return crew' : '반납 팀'),
    returnVehicleLabel: input.card.vehicleLabel,
    continuingVehicleLabel: input.continuingVehicleLabel ?? null,
    locale,
  }
}
