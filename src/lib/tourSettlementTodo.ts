import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { getMultiDayTourDays } from '@/lib/scheduleVehicleOilMaintenance'
import { TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR } from '@/lib/tourExpenseConstants'
import { opTodoBusinessDateKey } from '@/lib/opTodoBusinessDay'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const TOUR_SETTLEMENT_PANEL = {
  titleKo: '투어 정산',
  titleEn: 'Tour settlement',
} as const

export type TourSettlementExpenseIssue =
  | 'pending_approval'
  | 'rejected'
  | 'receipt_pending'
  | 'missing_paid_to'
  | 'missing_amount'
  | 'missing_payment_method'
  | 'missing_category'

export type TourSettlementExpenseLite = {
  id: string
  tour_id: string | null
  paid_for: string
  paid_to: string | null
  amount: number | null
  payment_method: string | null
  status: string | null
  submitted_by: string
  image_url: string | null
  file_path: string | null
}

export function tourSettlementPanelTitle(locale: string): string {
  return locale === 'ko' ? TOUR_SETTLEMENT_PANEL.titleKo : TOUR_SETTLEMENT_PANEL.titleEn
}

export function tourSettlementCompletionDateKey(): string {
  return opTodoBusinessDateKey()
}

/** 어제·오늘 투어 (라스베이거스 기준) */
export function tourSettlementDateRange(): { start: string; end: string } {
  const today = dayjs().tz(LV_TZ)
  const yesterday = today.subtract(1, 'day')
  return {
    start: yesterday.format('YYYY-MM-DD'),
    end: today.format('YYYY-MM-DD'),
  }
}

/** 멀티데이 투어 조회 시 `tour_date` 하한 (최대 4일 숙박) */
export const TOUR_SETTLEMENT_MULTI_DAY_MAX_SPAN = 4

function ymdFromDbDate(value: string | null | undefined): string {
  if (!value) return ''
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

function localYmdFromTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** 정산 기준일: 당일 투어는 시작일, 숙박·멀티데이는 종료일 */
export function getTourSettlementEndDateYmd(tour: {
  tour_date: string
  tour_end_datetime?: string | null
  product_id?: string | null
}): string {
  const start = ymdFromDbDate(tour.tour_date)
  if (!start) return ''

  const days = getMultiDayTourDays(String(tour.product_id || '').trim())
  if (days > 1) {
    return dayjs(start).add(days - 1, 'day').format('YYYY-MM-DD')
  }

  if (tour.tour_end_datetime) {
    const end = localYmdFromTimestamp(String(tour.tour_end_datetime))
    if (end && end >= start) return end
  }

  return start
}

export function tourMatchesSettlementDateWindow(
  tour: { tour_date: string; tour_end_datetime?: string | null; product_id?: string | null },
  start: string,
  end: string
): boolean {
  const settlementYmd = getTourSettlementEndDateYmd(tour)
  if (!settlementYmd) return false
  return settlementYmd >= start && settlementYmd <= end
}

export function tourSettlementFetchStartDate(rangeStart: string): string {
  return dayjs(rangeStart)
    .subtract(TOUR_SETTLEMENT_MULTI_DAY_MAX_SPAN - 1, 'day')
    .format('YYYY-MM-DD')
}

/** 투어 관리 Need to check — 영수증 없음 탭과 동일한 상품 제외 */
export function tourSettlementProductExcludedFromNoReceiptCheck(p: {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
} | null | undefined): boolean {
  if (!p) return false
  const blob = [p.name, p.name_ko, p.name_en]
    .map((s) => String(s ?? '').toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!blob) return false
  if (blob.includes('야경투어')) return true
  if (blob.includes('골프장 예약 대행')) return true
  if (blob.includes('red rock canyon trail')) return true
  if (blob.includes('레드락') && blob.includes('승마')) return true
  return false
}

export function tourExpenseHasReceiptAttachment(expense: Pick<TourSettlementExpenseLite, 'image_url' | 'file_path'>): boolean {
  return Boolean(String(expense.image_url || '').trim() || String(expense.file_path || '').trim())
}

function expenseStatusNorm(status: string | null | undefined): string {
  return String(status || 'pending').trim().toLowerCase()
}

function expenseAmountValid(amount: number | null | undefined): boolean {
  return amount != null && Number.isFinite(amount) && amount > 0.009
}

function expensePaidForValid(paidFor: string | null | undefined): boolean {
  const v = String(paidFor || '').trim()
  if (!v) return false
  if (v === TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR) return false
  return true
}

export function getTourExpenseSettlementIssues(
  expense: Pick<
    TourSettlementExpenseLite,
    'status' | 'paid_for' | 'paid_to' | 'amount' | 'payment_method'
  >
): TourSettlementExpenseIssue[] {
  const issues: TourSettlementExpenseIssue[] = []
  const status = expenseStatusNorm(expense.status)

  if (status === 'rejected') issues.push('rejected')
  else if (status !== 'approved') issues.push('pending_approval')

  if (!expensePaidForValid(expense.paid_for)) {
    if (String(expense.paid_for || '').trim() === TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR) {
      issues.push('receipt_pending')
    } else {
      issues.push('missing_category')
    }
  }

  if (!String(expense.paid_to || '').trim()) issues.push('missing_paid_to')
  if (!expenseAmountValid(expense.amount)) issues.push('missing_amount')
  if (!String(expense.payment_method || '').trim()) issues.push('missing_payment_method')

  return [...new Set(issues)]
}

export function tourExpenseNeedsSettlementReview(expense: TourSettlementExpenseLite): boolean {
  if (!tourExpenseHasReceiptAttachment(expense)) return false
  return getTourExpenseSettlementIssues(expense).length > 0
}

export function tourSettlementIssueLabel(issue: TourSettlementExpenseIssue, locale: string): string {
  const isKo = locale === 'ko'
  switch (issue) {
    case 'pending_approval':
      return isKo ? '미승인' : 'Pending'
    case 'rejected':
      return isKo ? '반려' : 'Rejected'
    case 'receipt_pending':
      return isKo ? '영수증 정리 필요' : 'Receipt review'
    case 'missing_paid_to':
      return isKo ? '지급처 없음' : 'No vendor'
    case 'missing_amount':
      return isKo ? '금액 없음' : 'No amount'
    case 'missing_payment_method':
      return isKo ? '결제수단 없음' : 'No payment'
    case 'missing_category':
      return isKo ? '항목 없음' : 'No category'
    default:
      return issue
  }
}

export function tourSettlementIssueBadgeClass(issue: TourSettlementExpenseIssue): string {
  switch (issue) {
    case 'rejected':
      return 'border-red-200 bg-red-50 text-red-800'
    case 'pending_approval':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    case 'receipt_pending':
      return 'border-orange-200 bg-orange-50 text-orange-900'
    default:
      return 'border-gray-200 bg-gray-50 text-gray-800'
  }
}

export function shouldHideTodoChipForTourSettlementPanel(todo: { title?: string | null }): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === TOUR_SETTLEMENT_PANEL.titleKo) return true
  if (normalized.toLowerCase() === TOUR_SETTLEMENT_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function tourSettlementCompletionStorageKey(dateKey = tourSettlementCompletionDateKey()): string {
  return `tour-settlement.completed.${dateKey}`
}

export function readTourSettlementLocalCompleted(dateKey = tourSettlementCompletionDateKey()): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(tourSettlementCompletionStorageKey(dateKey)) === '1'
}

export function writeTourSettlementLocalCompleted(
  completed: boolean,
  dateKey = tourSettlementCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = tourSettlementCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type TourSettlementLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findTourSettlementLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForTourSettlementPanel(todo)) ?? null
}

export function tourSettlementTodoFormSeed(locale: string) {
  return {
    title: tourSettlementPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}
