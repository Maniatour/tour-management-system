import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import {
  isManiaTourOrServiceSubCategory,
  type DepositTabProductRef,
} from '@/lib/reservationActionRequiredDepositTab'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const RESERVATION_AGENCY_MANAGEMENT_PANEL = {
  titleKo: '예약 대행 관리',
  titleEn: 'Reservation agency management',
} as const

export function reservationAgencyManagementPanelTitle(locale: string): string {
  return locale === 'ko'
    ? RESERVATION_AGENCY_MANAGEMENT_PANEL.titleKo
    : RESERVATION_AGENCY_MANAGEMENT_PANEL.titleEn
}

export function reservationAgencyManagementCompletionDateKey(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

/** 오늘부터 90일 이내 투어일 예약 */
export function reservationAgencyManagementDateRange(): { start: string; end: string } {
  const start = dayjs().tz(LV_TZ).format('YYYY-MM-DD')
  const end = dayjs().tz(LV_TZ).add(90, 'day').format('YYYY-MM-DD')
  return { start, end }
}

export function isReservationAgencyProduct(
  product: Pick<DepositTabProductRef, 'sub_category'> | null | undefined
): boolean {
  if (!product) return false
  return !isManiaTourOrServiceSubCategory(product.sub_category)
}

function normalizePaymentMethodLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** 입금 내역 결제 방법이 고객 카드 대행인지 (표기·ID 혼용 대비) */
export function isCustomerCreditCardAgencyPaymentMethod(
  paymentMethod: string | null | undefined
): boolean {
  const raw = String(paymentMethod ?? '').trim()
  if (!raw) return false
  const normalized = normalizePaymentMethodLabel(raw)
  if (normalized.includes('customer') && normalized.includes('credit card')) return true
  if (normalized.includes('고객') && (normalized.includes('신용카드') || normalized.includes('카드'))) {
    return true
  }
  return false
}

export function reservationAgencyActionComplete(input: {
  hasReservationExpense: boolean
  hasCustomerCreditCardPayment: boolean
}): boolean {
  return input.hasReservationExpense || input.hasCustomerCreditCardPayment
}

export function shouldHideTodoChipForReservationAgencyManagementPanel(todo: {
  title?: string | null
}): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === RESERVATION_AGENCY_MANAGEMENT_PANEL.titleKo) return true
  if (
    normalized.toLowerCase() === RESERVATION_AGENCY_MANAGEMENT_PANEL.titleEn.toLowerCase()
  ) {
    return true
  }
  return false
}

export function reservationAgencyManagementCompletionStorageKey(
  dateKey = reservationAgencyManagementCompletionDateKey()
): string {
  return `reservation-agency-management.completed.${dateKey}`
}

export function readReservationAgencyManagementLocalCompleted(
  dateKey = reservationAgencyManagementCompletionDateKey()
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(reservationAgencyManagementCompletionStorageKey(dateKey)) === '1'
}

export function writeReservationAgencyManagementLocalCompleted(
  completed: boolean,
  dateKey = reservationAgencyManagementCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = reservationAgencyManagementCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type ReservationAgencyManagementLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findReservationAgencyManagementLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForReservationAgencyManagementPanel(todo)) ?? null
}

export function reservationAgencyManagementTodoFormSeed(locale: string) {
  return {
    title: reservationAgencyManagementPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}
