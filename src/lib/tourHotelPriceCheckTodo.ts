import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const TOUR_HOTEL_PRICE_CHECK_PANEL = {
  titleKo: '투어 호텔 가격 체크',
  titleEn: 'Tour hotel price check',
} as const

export function tourHotelPriceCheckPanelTitle(locale: string): string {
  return locale === 'ko' ? TOUR_HOTEL_PRICE_CHECK_PANEL.titleKo : TOUR_HOTEL_PRICE_CHECK_PANEL.titleEn
}

export function tourHotelPriceCheckCompletionDateKey(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

export function tourHotelPriceCheckDateRange(): { start: string; end: string } {
  const start = dayjs().tz(LV_TZ).format('YYYY-MM-DD')
  const end = dayjs().tz(LV_TZ).add(120, 'day').format('YYYY-MM-DD')
  return { start, end }
}

/** 체크아웃이 오늘 이후이고, 체크인이 조회 종료일 이전인 활성 부킹 */
export function isTourHotelPriceCheckBookingInRange(
  checkInDate: string,
  checkOutDate: string,
  range: { start: string; end: string } = tourHotelPriceCheckDateRange()
): boolean {
  const checkIn = String(checkInDate || '').trim().slice(0, 10)
  const checkOut = String(checkOutDate || '').trim().slice(0, 10)
  if (!checkIn || !checkOut) return false
  return checkOut >= range.start && checkIn <= range.end
}

export function shouldHideTodoChipForTourHotelPriceCheckPanel(todo: { title?: string | null }): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === TOUR_HOTEL_PRICE_CHECK_PANEL.titleKo) return true
  if (normalized.toLowerCase() === TOUR_HOTEL_PRICE_CHECK_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function tourHotelPriceCheckCompletionStorageKey(
  dateKey = tourHotelPriceCheckCompletionDateKey()
): string {
  return `tour-hotel-price-check.completed.${dateKey}`
}

export function readTourHotelPriceCheckLocalCompleted(
  dateKey = tourHotelPriceCheckCompletionDateKey()
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(tourHotelPriceCheckCompletionStorageKey(dateKey)) === '1'
}

export function writeTourHotelPriceCheckLocalCompleted(
  completed: boolean,
  dateKey = tourHotelPriceCheckCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = tourHotelPriceCheckCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type TourHotelPriceCheckLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findTourHotelPriceCheckLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForTourHotelPriceCheckPanel(todo)) ?? null
}

export function tourHotelPriceCheckTodoFormSeed(locale: string) {
  return {
    title: tourHotelPriceCheckPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}

export function formatTourHotelBookingPrice(
  totalPrice?: number | null,
  unitPrice?: number | null,
  rooms?: number | null
): number | null {
  const total = Number(totalPrice)
  if (Number.isFinite(total) && total > 0) return Math.round(total * 100) / 100
  const unit = Number(unitPrice)
  const roomCount = Math.max(1, Number(rooms) || 1)
  if (Number.isFinite(unit) && unit > 0) return Math.round(unit * roomCount * 100) / 100
  return null
}

export const TOUR_HOTEL_PRICE_CHECK_HIGH_UNIT_THRESHOLD = 150

/** $150 초과 여부 판단용 객실 단가 — 단가가 없으면 총액 ÷ 룸 수 */
export function getTourHotelPriceCheckUnitPrice(
  totalPrice?: number | null,
  unitPrice?: number | null,
  rooms?: number | null
): number | null {
  const unit = Number(unitPrice)
  if (Number.isFinite(unit) && unit > 0) {
    return Math.round(unit * 100) / 100
  }
  const total = Number(totalPrice)
  const roomCount = Math.max(1, Number(rooms) || 1)
  if (Number.isFinite(total) && total > 0) {
    return Math.round((total / roomCount) * 100) / 100
  }
  return null
}

export function isTourHotelPriceCheckHighUnitPrice(
  totalPrice?: number | null,
  unitPrice?: number | null,
  rooms?: number | null,
  threshold = TOUR_HOTEL_PRICE_CHECK_HIGH_UNIT_THRESHOLD
): boolean {
  const unit = getTourHotelPriceCheckUnitPrice(totalPrice, unitPrice, rooms)
  return unit != null && unit > threshold
}

export function normalizeTourHotelWebsiteUrl(url: string | null | undefined): string | null {
  const raw = String(url || '').trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}
