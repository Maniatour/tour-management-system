import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { normalizeTourHotelBookingStatus } from '@/lib/tourHotelReferences'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const TOUR_HOTEL_CC_FORM_PANEL = {
  titleKo: '투어 호텔 CC Form',
  titleEn: 'Tour hotel CC Form',
} as const

export type TourHotelCcStatus = 'not_sent' | 'sent' | 'not_needed'

export const TOUR_HOTEL_CC_STATUS_OPTIONS: Array<{
  value: TourHotelCcStatus
  labelKo: string
  labelEn: string
}> = [
  { value: 'not_sent', labelKo: '미발송', labelEn: 'Not sent' },
  { value: 'sent', labelKo: '발송 완료', labelEn: 'Sent' },
  { value: 'not_needed', labelKo: '필요없음', labelEn: 'Not needed' },
]

export function tourHotelCcFormPanelTitle(locale: string): string {
  return locale === 'ko' ? TOUR_HOTEL_CC_FORM_PANEL.titleKo : TOUR_HOTEL_CC_FORM_PANEL.titleEn
}

export function tourHotelCcFormCompletionDateKey(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

/** 다음날(라스베가스 기준) 체크인 확정 부킹 대상일 */
export function tourHotelCcFormTargetCheckInDate(
  dateKey = tourHotelCcFormCompletionDateKey()
): string {
  return dayjs.tz(dateKey, LV_TZ).add(1, 'day').format('YYYY-MM-DD')
}

export function shouldHideTodoChipForTourHotelCcFormPanel(todo: { title?: string | null }): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === TOUR_HOTEL_CC_FORM_PANEL.titleKo) return true
  if (normalized.toLowerCase() === TOUR_HOTEL_CC_FORM_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function tourHotelCcFormCompletionStorageKey(
  dateKey = tourHotelCcFormCompletionDateKey()
): string {
  return `tour-hotel-cc-form.completed.${dateKey}`
}

export function readTourHotelCcFormLocalCompleted(
  dateKey = tourHotelCcFormCompletionDateKey()
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(tourHotelCcFormCompletionStorageKey(dateKey)) === '1'
}

export function writeTourHotelCcFormLocalCompleted(
  completed: boolean,
  dateKey = tourHotelCcFormCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = tourHotelCcFormCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type TourHotelCcFormLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findTourHotelCcFormLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForTourHotelCcFormPanel(todo)) ?? null
}

export function tourHotelCcFormTodoFormSeed(locale: string) {
  return {
    title: tourHotelCcFormPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}

export function normalizeTourHotelCcStatus(cc: string | null | undefined): TourHotelCcStatus {
  const s = String(cc || '').trim().toLowerCase()
  if (s === 'sent') return 'sent'
  if (s === 'not_needed') return 'not_needed'
  return 'not_sent'
}

export function isConfirmedTourHotelBookingForCcForm(status: string | null | undefined): boolean {
  return normalizeTourHotelBookingStatus(status) === 'confirmed'
}

/** CC 발송 + 이름 변경 확인(또는 필요없음)까지 끝난 부킹 */
export function isTourHotelCcFormRowDone(row: {
  cc: string | null | undefined
  name_change_confirmed_at: string | null | undefined
}): boolean {
  const cc = normalizeTourHotelCcStatus(row.cc)
  if (cc === 'not_needed') return true
  if (cc === 'sent' && Boolean(row.name_change_confirmed_at)) return true
  return false
}

export function tourHotelCcStatusLabel(cc: TourHotelCcStatus, locale: string): string {
  const opt = TOUR_HOTEL_CC_STATUS_OPTIONS.find((o) => o.value === cc)
  if (!opt) return cc
  return locale === 'ko' ? opt.labelKo : opt.labelEn
}

export function tourHotelCcStatusClassName(cc: TourHotelCcStatus): string {
  switch (cc) {
    case 'sent':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900'
    case 'not_needed':
      return 'border-gray-300 bg-gray-50 text-gray-700'
    case 'not_sent':
    default:
      return 'border-amber-300 bg-amber-50 text-amber-900'
  }
}

export function tourHotelCcFormRowBorderClassName(row: {
  cc: string | null | undefined
  name_change_confirmed_at: string | null | undefined
}): string {
  if (isTourHotelCcFormRowDone(row)) {
    return 'border-emerald-200 bg-emerald-50/50'
  }
  const cc = normalizeTourHotelCcStatus(row.cc)
  if (cc === 'sent') {
    return 'border-sky-200 bg-sky-50/40'
  }
  return 'border-amber-200/80 bg-amber-50/30'
}
