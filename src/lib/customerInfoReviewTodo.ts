import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { resolveCustomerCommunicationChannel } from '@/lib/customerCommunicationChannel'
import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'

dayjs.extend(utc)
dayjs.extend(timezone)

const LV_TZ = 'America/Los_Angeles'

export const CUSTOMER_INFO_REVIEW_PANEL = {
  titleKo: '고객 정보 검수',
  titleEn: 'Customer info review',
} as const

export type CustomerInfoReviewIssue = 'communication' | 'pickup_hotel' | 'resident_status'

export function customerInfoReviewPanelTitle(locale: string): string {
  return locale === 'ko' ? CUSTOMER_INFO_REVIEW_PANEL.titleKo : CUSTOMER_INFO_REVIEW_PANEL.titleEn
}

export function customerInfoReviewCompletionDateKey(): string {
  return dayjs().tz(LV_TZ).format('YYYY-MM-DD')
}

/** 내일·모레 (LA 기준) */
export function customerInfoReviewTargetDates(): [string, string] {
  const base = dayjs().tz(LV_TZ)
  return [base.add(1, 'day').format('YYYY-MM-DD'), base.add(2, 'day').format('YYYY-MM-DD')]
}

export function shouldHideTodoChipForCustomerInfoReviewPanel(todo: {
  title?: string | null
}): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === CUSTOMER_INFO_REVIEW_PANEL.titleKo) return true
  if (normalized.toLowerCase() === CUSTOMER_INFO_REVIEW_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function customerInfoReviewCompletionStorageKey(
  dateKey = customerInfoReviewCompletionDateKey()
): string {
  return `customer-info-review.completed.${dateKey}`
}

export function readCustomerInfoReviewLocalCompleted(
  dateKey = customerInfoReviewCompletionDateKey()
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(customerInfoReviewCompletionStorageKey(dateKey)) === '1'
}

export function writeCustomerInfoReviewLocalCompleted(
  completed: boolean,
  dateKey = customerInfoReviewCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = customerInfoReviewCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type CustomerInfoReviewLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findCustomerInfoReviewLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForCustomerInfoReviewPanel(todo)) ?? null
}

export function customerInfoReviewTodoFormSeed(locale: string) {
  return {
    title: customerInfoReviewPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}

type ResidentCustomerRow = {
  resident_status?: string | null
  pass_covered_count?: number | null
}

export function residentStatusCountTotal(
  rows: ResidentCustomerRow[] | null | undefined,
  totalPeople: number
): number {
  if (!rows?.length) return 0

  let usResident = 0
  let nonResident = 0
  let nonResidentUnder16 = 0
  let passCount = 0

  for (const rc of rows) {
    if (rc.resident_status === 'us_resident') usResident++
    else if (rc.resident_status === 'non_resident') nonResident++
    else if (rc.resident_status === 'non_resident_under_16') nonResidentUnder16++
    else if (rc.resident_status === 'non_resident_with_pass') passCount++
  }

  const maxCoverable = passCount * 4
  const remainingPeople = Math.max(0, totalPeople - usResident - nonResident - nonResidentUnder16)
  const actualPassCovered = Math.min(maxCoverable, remainingPeople)

  return usResident + nonResident + nonResidentUnder16 + actualPassCovered
}

export function isResidentStatusCountIncomplete(
  rows: ResidentCustomerRow[] | null | undefined,
  totalPeople: number
): boolean {
  if (totalPeople <= 0) return false
  return residentStatusCountTotal(rows, totalPeople) !== totalPeople
}

export function hasRiskyCommunicationChannel(
  rawChannel: string | null | undefined,
  channelId?: string | null,
  channelName?: string | null
): boolean {
  const channel = resolveCustomerCommunicationChannel(rawChannel, {
    channelId: channelId ?? null,
    channelName: channelName ?? null,
  })
  return channel === 'platform' || channel === 'no_reply'
}

export function isPickupHotelMissing(pickupHotel: string | null | undefined): boolean {
  return !(pickupHotel ?? '').trim()
}

export function productRequiresResidentStatus(productCode: string | null | undefined): boolean {
  return productShowsResidentStatusSectionByCode(productCode)
}

export function customerInfoReviewIssueLabel(issue: CustomerInfoReviewIssue, locale: string): string {
  const isKo = locale === 'ko'
  if (issue === 'communication') {
    return isKo ? '소통 채널(플랫폼·답변없음)' : 'Channel (platform / no reply)'
  }
  if (issue === 'pickup_hotel') {
    return isKo ? '픽업 호텔 미설정' : 'Pickup hotel missing'
  }
  return isKo ? '거주 상태별 인원 미설정' : 'Resident count missing'
}
