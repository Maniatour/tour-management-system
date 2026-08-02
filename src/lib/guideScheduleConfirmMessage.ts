import { detectGuidePreferredLanguage, type SupportedLocale } from '@/lib/guideLanguageDetection'
import { fetchAdminSmsTemplatesForKey } from '@/lib/adminSmsTemplateDb'
import {
  getBuiltinGuideScheduleConfirmSmsTemplate,
  substituteGuideScheduleConfirmSmsTemplate,
} from '@/lib/guideScheduleConfirmSmsTemplate'
import { supabaseAdmin } from '@/lib/supabase'
import { formatTimeWithAMPM } from '@/lib/utils'
import { formatPhoneToE164 } from '@/utils/formatPhoneToE164'
import { calculatePickupDate } from '@/lib/reservationDisplayUtils'
import { isTourCancelled, isTourDeleted } from '@/utils/tourStatusUtils'
import { normalizeReservationIds } from '@/utils/tourUtils'

export type GuideScheduleConfirmRecipientRole = 'guide' | 'assistant'

export type GuideScheduleConfirmRecipient = {
  role: GuideScheduleConfirmRecipientRole
  email: string
  displayName: string
  phone: string | null
  phoneE164: string | null
  locale: SupportedLocale
}

export type GuideScheduleConfirmRecipientPreview = GuideScheduleConfirmRecipient & {
  smsBody: string
  siteMessageBody: string
  siteTitle: string
}

export type GuideScheduleConfirmPreview = {
  tourId: string
  tourDate: string
  productName: string
  firstPickupTime: string | null
  firstPickupHotelLabel: string | null
  officeArrivalTime: string | null
  recipients: GuideScheduleConfirmRecipientPreview[]
  warnings: string[]
}

type ReservationRow = {
  id: string
  status: string | null
  pickup_time: string | null
  pickup_hotel: string | null
}

type PickupHotelRow = { id: string; hotel: string | null }

type ProductRow = { name?: string | null; name_ko?: string | null; name_en?: string | null }

type TeamRow = {
  email: string
  name_ko: string | null
  nick_name: string | null
  phone: string | null
  languages?: string[] | string | null
}

export function guideScheduleConfirmLocaleLabel(locale: SupportedLocale): string {
  switch (locale) {
    case 'ko':
      return '한국어'
    case 'en':
      return 'English'
    case 'ja':
      return '日本語'
    case 'zh':
      return '中文'
    default:
      return locale
  }
}

function teamDisplayName(member: TeamRow | undefined, fallbackEmail: string): string {
  if (!member) return fallbackEmail
  return member.nick_name?.trim() || member.name_ko?.trim() || member.email || fallbackEmail
}

function productNameForLocale(product: ProductRow | null, locale: SupportedLocale): string {
  const fallback = product?.name?.trim() || product?.name_ko?.trim() || product?.name_en?.trim() || '—'
  if (locale === 'ko') return product?.name_ko?.trim() || product?.name?.trim() || fallback
  if (locale === 'en') return product?.name_en?.trim() || product?.name?.trim() || fallback
  return product?.name_en?.trim() || product?.name?.trim() || fallback
}

function parsePickupMinutes(time: string): number | null {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

function formatPickupTimeDisplay(time: string | null | undefined): string | null {
  const raw = time?.trim()
  if (!raw) return null
  const formatted = formatTimeWithAMPM(raw)
  return formatted || raw
}

function formatMinutesAsTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hh = Math.floor(normalized / 60)
  const mm = normalized % 60
  return formatTimeWithAMPM(`${hh}:${String(mm).padStart(2, '0')}`)
}

export function formatGuideScheduleTourDateLabel(date: string, locale: SupportedLocale): string {
  return formatTourDateLabel(date, locale)
}

function formatTourDateLabel(date: string, locale: SupportedLocale): string {
  const parts = date.split('-')
  if (parts.length !== 3) return date
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return date
  if (locale === 'ko') return `${month}월 ${day}일`
  if (locale === 'ja' || locale === 'zh') return `${month}月${day}日`
  return `${month}/${day}`
}

function isActiveReservation(status: string | null | undefined): boolean {
  if (!status) return true
  const s = status.toLowerCase()
  return !s.includes('cancel') && s !== 'deleted'
}

function findEarliestPickup(reservations: ReservationRow[]): {
  pickupTime: string | null
  pickupHotelId: string | null
} {
  let bestMinutes: number | null = null
  let bestTime: string | null = null
  let bestHotel: string | null = null

  for (const res of reservations) {
    if (!isActiveReservation(res.status)) continue
    const pt = res.pickup_time?.trim()
    if (!pt) continue
    const minutes = parsePickupMinutes(pt)
    if (minutes == null) continue
    if (bestMinutes == null || minutes < bestMinutes) {
      bestMinutes = minutes
      bestTime = pt
      bestHotel = res.pickup_hotel
    }
  }

  return { pickupTime: bestTime, pickupHotelId: bestHotel }
}

function computeOfficeArrival(
  tourDate: string,
  pickupTime: string
): { dateIso: string; timeDisplay: string } | null {
  const pickupMinutes = parsePickupMinutes(pickupTime)
  if (pickupMinutes == null) return null
  const pickupDateIso = calculatePickupDate(pickupTime, tourDate)
  let officeMinutes = pickupMinutes - 30
  let dateIso = pickupDateIso
  if (officeMinutes < 0) {
    officeMinutes += 24 * 60
    const d = new Date(`${pickupDateIso}T12:00:00`)
    d.setDate(d.getDate() - 1)
    dateIso = d.toISOString().split('T')[0] ?? pickupDateIso
  }
  return { dateIso, timeDisplay: formatMinutesAsTime(officeMinutes) }
}

export function buildGuideScheduleConfirmPickupLine(
  locale: SupportedLocale,
  firstPickupTime: string | null,
  firstPickupHotelLabel: string | null
): string {
  if (firstPickupTime && firstPickupHotelLabel) {
    switch (locale) {
      case 'ko':
        return `첫 픽업: ${firstPickupHotelLabel} ${firstPickupTime}.`
      case 'ja':
        return `初回ピックアップ: ${firstPickupHotelLabel} ${firstPickupTime}。`
      case 'zh':
        return `首次接客: ${firstPickupHotelLabel} ${firstPickupTime}。`
      default:
        return `First pickup: ${firstPickupHotelLabel} at ${firstPickupTime}.`
    }
  }
  if (firstPickupTime) {
    switch (locale) {
      case 'ko':
        return `첫 픽업 시간: ${firstPickupTime}.`
      case 'ja':
        return `初回ピックアップ時間: ${firstPickupTime}。`
      case 'zh':
        return `首次接客时间: ${firstPickupTime}。`
      default:
        return `First pickup: ${firstPickupTime}.`
    }
  }
  switch (locale) {
    case 'ko':
      return '첫 픽업 시간이 아직 설정되지 않았습니다.'
    case 'ja':
      return '初回ピックアップ時間がまだ設定されていません。'
    case 'zh':
      return '首次接客时间尚未设置。'
    default:
      return 'First pickup time is not set yet.'
  }
}

export function buildGuideScheduleConfirmOfficeLine(
  locale: SupportedLocale,
  tourDate: string,
  pickupTime: string | null
): string {
  if (pickupTime) {
    const arrival = computeOfficeArrival(tourDate, pickupTime)
    if (arrival) {
      const when = `${formatTourDateLabel(arrival.dateIso, locale)} ${arrival.timeDisplay}`
      switch (locale) {
        case 'ko':
          return `사무실 도착: ${when}까지 오피스로 와 주세요.\n\n(첫 픽업 30분 전입니다.)`
        case 'ja':
          return `オフィス到着: ${when} までにお越しください。\n\n(初回ピックアップの30分前です。)`
        case 'zh':
          return `请在 ${when} 前到达办公室。\n\n(首次接客前30分钟。)`
        default:
          return `Please arrive at the office by ${when}\n\n(30 minutes before the first pickup).`
      }
    }
  }
  switch (locale) {
    case 'ko':
      return '첫 픽업 30분 전까지 사무실로 와 주세요.'
    case 'ja':
      return '初回ピックアップの30分前までにオフィスへお越しください。'
    case 'zh':
      return '请在首次接客前30分钟到达办公室。'
    default:
      return 'Please arrive at the office 30 minutes before the first pickup.'
  }
}

function buildMessages(input: {
  locale: SupportedLocale
  guideName: string
  tourDate: string
  productName: string
  firstPickupTime: string | null
  firstPickupHotelLabel: string | null
  firstPickupTimeRaw: string | null
  smsTemplateByLocale?: Partial<Record<SupportedLocale, string>>
}): { smsBody: string; siteMessageBody: string; siteTitle: string } {
  const { locale } = input
  const dateLabel = formatTourDateLabel(input.tourDate, locale)
  const pickupLine = buildGuideScheduleConfirmPickupLine(locale, input.firstPickupTime, input.firstPickupHotelLabel)
  const officeLine = buildGuideScheduleConfirmOfficeLine(locale, input.tourDate, input.firstPickupTimeRaw)

  const siteTitle =
    locale === 'ko'
      ? '가이드 스케줄 컨펌'
      : locale === 'ja'
        ? 'ガイドスケジュール確認'
        : locale === 'zh'
          ? '导游行程确认'
          : 'Guide schedule confirmation'

  const smsTpl =
    input.smsTemplateByLocale?.[locale]?.trim() ||
    getBuiltinGuideScheduleConfirmSmsTemplate(locale)
  const smsBody = substituteGuideScheduleConfirmSmsTemplate(smsTpl, {
    guideName: input.guideName,
    tourDate: dateLabel,
    productName: input.productName,
    pickupLine,
    officeLine,
  })

  let siteMessageBody: string

  switch (locale) {
    case 'ko':
      siteMessageBody = `${input.guideName}님, 안녕하세요.\n\n${dateLabel} · ${input.productName}\n${pickupLine}\n\n${officeLine}\n\n확인 후 닫기를 눌러 주세요.`
      break
    case 'ja':
      siteMessageBody = `${input.guideName}様\n\n${dateLabel} · ${input.productName}\n${pickupLine}\n\n${officeLine}\n\nご確認のうえ、閉じるをタップしてください。`
      break
    case 'zh':
      siteMessageBody = `${input.guideName}，您好。\n\n${dateLabel} · ${input.productName}\n${pickupLine}\n\n${officeLine}\n\n请阅读后点击确认。`
      break
    default:
      siteMessageBody = `Hello ${input.guideName},\n\n${dateLabel} · ${input.productName}\n${pickupLine}\n\n${officeLine}\n\nPlease tap Confirm after reading.`
      break
  }

  return { smsBody, siteMessageBody, siteTitle }
}

export type GuideScheduleConfirmComposeInput = {
  tourId: string
  tourDate: string
  tourGuideId: string | null
  assistantId: string | null
  product: ProductRow | null
  reservations: ReservationRow[]
  teamByEmail: Map<string, TeamRow>
  hotelLabelById: Map<string, string>
}

/** DB 없이 순수 계산 — 투어 목록 로드 시 일괄 미리보기용 */
export function composeGuideScheduleConfirmPreview(
  input: GuideScheduleConfirmComposeInput,
  adminLocale = 'ko',
  smsTemplateByLocale?: Partial<Record<SupportedLocale, string>> | undefined
): GuideScheduleConfirmPreview {
  const adminIsKo = adminLocale === 'ko'
  const product = input.product
  const defaultProductName =
    product?.name?.trim() || product?.name_ko?.trim() || product?.name_en?.trim() || '—'

  const { pickupTime, pickupHotelId } = findEarliestPickup(input.reservations)
  const firstPickupHotelLabel = pickupHotelId
    ? input.hotelLabelById.get(pickupHotelId)?.trim() || null
    : null
  const firstPickupTimeDisplay = formatPickupTimeDisplay(pickupTime)

  const officeArrivalTime =
    pickupTime != null && parsePickupMinutes(pickupTime) != null
      ? formatMinutesAsTime(parsePickupMinutes(pickupTime)! - 30)
      : null

  const warnings: string[] = []
  if (!pickupTime) {
    warnings.push(adminIsKo ? '픽업 시간이 설정된 예약이 없습니다.' : 'No reservations with pickup times.')
  }

  const recipients: GuideScheduleConfirmRecipientPreview[] = []
  const rolePairs: Array<[GuideScheduleConfirmRecipientRole, string | null]> = [
    ['guide', input.tourGuideId],
    ['assistant', input.assistantId],
  ]

  for (const [role, email] of rolePairs) {
    if (!email) continue
    const member = input.teamByEmail.get(email)
    const displayName = teamDisplayName(member, email)
    const phone = member?.phone?.trim() || null
    const phoneE164 = formatPhoneToE164(phone, 'US')
    const recipientLocale = detectGuidePreferredLanguage(member, email)
    const localizedProductName = productNameForLocale(product, recipientLocale)

    if (!phoneE164) {
      warnings.push(
        adminIsKo
          ? `${displayName}(${role === 'guide' ? '가이드' : '어시스턴트'}) 전화번호가 없습니다.`
          : `Missing phone for ${displayName} (${role}).`
      )
    }

    const messages = buildMessages({
      locale: recipientLocale,
      guideName: displayName,
      tourDate: input.tourDate,
      productName: localizedProductName,
      firstPickupTime: firstPickupTimeDisplay,
      firstPickupHotelLabel,
      firstPickupTimeRaw: pickupTime,
      ...(smsTemplateByLocale ? { smsTemplateByLocale } : {}),
    })

    recipients.push({
      role,
      email,
      displayName,
      phone,
      phoneE164,
      locale: recipientLocale,
      ...messages,
    })
  }

  if (recipients.length === 0) {
    warnings.push(adminIsKo ? '배정된 가이드/어시스턴트가 없습니다.' : 'No guide or assistant assigned.')
  }

  return {
    tourId: input.tourId,
    tourDate: input.tourDate,
    productName: defaultProductName,
      firstPickupTime: firstPickupTimeDisplay,
      firstPickupHotelLabel,
      officeArrivalTime,
      recipients,
    warnings,
  }
}

export async function buildGuideScheduleConfirmPreview(
  tourId: string,
  adminLocale = 'ko'
): Promise<{ ok: true; data: GuideScheduleConfirmPreview } | { ok: false; error: string; status: number }> {
  const db = supabaseAdmin
  if (!db) {
    return { ok: false, error: 'Server database unavailable.', status: 500 }
  }

  const { data: tour, error: tourErr } = await db
    .from('tours')
    .select('id, tour_date, tour_status, tour_guide_id, assistant_id, reservation_ids, products(name, name_ko, name_en)')
    .eq('id', tourId)
    .maybeSingle()

  if (tourErr) {
    return { ok: false, error: tourErr.message, status: 500 }
  }
  if (!tour) {
    return { ok: false, error: 'Tour not found.', status: 404 }
  }
  if (isTourDeleted(tour.tour_status) || isTourCancelled(tour.tour_status)) {
    return { ok: false, error: 'Cancelled or deleted tour.', status: 400 }
  }

  const product = tour.products as ProductRow | null
  const reservationIds = normalizeReservationIds(tour.reservation_ids)
  const emails = [tour.tour_guide_id, tour.assistant_id].filter((e): e is string => Boolean(e))

  const [resResult, teamResult] = await Promise.all([
    reservationIds.length > 0
      ? db.from('reservations').select('id, status, pickup_time, pickup_hotel').in('id', reservationIds)
      : Promise.resolve({ data: [] as ReservationRow[], error: null }),
    emails.length > 0
      ? db.from('team').select('email, name_ko, nick_name, phone, languages').in('email', emails)
      : Promise.resolve({ data: [] as TeamRow[], error: null }),
  ])

  if (resResult.error) {
    return { ok: false, error: resResult.error.message, status: 500 }
  }

  const reservations = (resResult.data || []) as ReservationRow[]
  const teamMap = new Map<string, TeamRow>()
  for (const row of (teamResult.data || []) as TeamRow[]) {
    teamMap.set(row.email, row)
  }

  const { pickupHotelId } = findEarliestPickup(reservations)
  const hotelLabelById = new Map<string, string>()
  if (pickupHotelId) {
    const { data: hotel } = await db.from('pickup_hotels').select('id, hotel').eq('id', pickupHotelId).maybeSingle()
    const label = (hotel as PickupHotelRow | null)?.hotel?.trim()
    if (label) hotelLabelById.set(pickupHotelId, label)
  }

  const smsTemplateByLocale = await fetchAdminSmsTemplatesForKey('guide_schedule_confirm')

  return {
    ok: true,
    data: composeGuideScheduleConfirmPreview(
      {
        tourId: tour.id,
        tourDate: tour.tour_date,
        tourGuideId: tour.tour_guide_id ?? null,
        assistantId: tour.assistant_id ?? null,
        product,
        reservations,
        teamByEmail: teamMap,
        hotelLabelById,
      },
      adminLocale,
      smsTemplateByLocale as Partial<Record<SupportedLocale, string>>
    ),
  }
}

export function guideScheduleConfirmPopupConfirmLabel(locale: SupportedLocale): string {
  switch (locale) {
    case 'ko':
      return '확인했습니다'
    case 'ja':
      return '確認しました'
    case 'zh':
      return '已确认'
    default:
      return 'Got it'
  }
}

/** 원격 DB에 guide_schedule_confirm_popups 마이그레이션 미적용 시 PostgREST PGRST205 */
export function isGuideScheduleConfirmPopupSchemaMissingError(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false
  if (error.code === 'PGRST205' || error.code === '42P01') return true
  const msg = String(error.message ?? '')
  return (
    /guide_schedule_confirm_popup/i.test(msg) &&
    /schema cache|could not find the table/i.test(msg)
  )
}

export function guideScheduleConfirmPopupOfficeLine(
  locale: SupportedLocale,
  officeArrivalTime: string,
  firstPickupTime: string | null
): string {
  const pickupSuffix =
    firstPickupTime &&
    (locale === 'ko'
      ? ` (첫 픽업 ${firstPickupTime})`
      : locale === 'ja'
        ? ` (初回ピックアップ ${firstPickupTime})`
        : locale === 'zh'
          ? ` (首次接客 ${firstPickupTime})`
          : ` (first pickup ${firstPickupTime})`)

  switch (locale) {
    case 'ko':
      return `사무실 도착: ${officeArrivalTime}${pickupSuffix || ''}`
    case 'ja':
      return `オフィス到着: ${officeArrivalTime}${pickupSuffix || ''}`
    case 'zh':
      return `到达办公室: ${officeArrivalTime}${pickupSuffix || ''}`
    default:
      return `Arrive at office: ${officeArrivalTime}${pickupSuffix || ''}`
  }
}
