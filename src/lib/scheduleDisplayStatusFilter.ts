import { isTourCancelledOnly, isTourDeleted } from '@/utils/tourStatusUtils'

export const SCHEDULE_DISPLAY_STATUS_FILTER_OPTIONS = [
  { id: 'scheduled', labelKo: '예정', labelEn: 'Scheduled' },
  { id: 'recruiting', labelKo: '모집중', labelEn: 'Recruiting' },
  { id: 'confirmed', labelKo: '확정', labelEn: 'Confirmed' },
  { id: 'completed', labelKo: '완료', labelEn: 'Completed' },
  { id: 'approved', labelKo: '승인됨', labelEn: 'Approved' },
  { id: 'requested', labelKo: '요청됨', labelEn: 'Requested' },
  { id: 'canceled', labelKo: '취소', labelEn: 'Cancelled' },
  { id: 'deleted', labelKo: '삭제', labelEn: 'Deleted' },
  { id: 'other', labelKo: '기타', labelEn: 'Other' },
] as const

export type ScheduleDisplayStatusFilterId =
  (typeof SCHEDULE_DISPLAY_STATUS_FILTER_OPTIONS)[number]['id']

/** 취소·삭제 제외 — 스케줄 디스플레이 달력 기본 표시 */
export const DEFAULT_SCHEDULE_DISPLAY_STATUS_FILTER: ScheduleDisplayStatusFilterId[] = [
  'scheduled',
  'recruiting',
  'confirmed',
  'completed',
  'approved',
  'requested',
  'other',
]

export function resolveScheduleDisplayStatusFilterId(
  status: string | null | undefined
): ScheduleDisplayStatusFilterId {
  if (isTourDeleted(status)) return 'deleted'
  if (isTourCancelledOnly(status)) return 'canceled'

  const s = (status || '').toLowerCase().trim()
  if (!s) return 'other'
  if (s === 'scheduled' || s.includes('scheduled')) return 'scheduled'
  if (s === 'recruiting' || s.startsWith('recruiting ') || s.startsWith('recruiting/')) {
    return 'recruiting'
  }
  if (s === 'confirm' || s === 'confirmed') return 'confirmed'
  if (s === 'complete' || s === 'completed' || s.includes('complete')) return 'completed'
  if (s === 'approved' || s.includes('approved')) return 'approved'
  if (s === 'requested' || s.includes('requested')) return 'requested'
  return 'other'
}

export function tourMatchesScheduleDisplayStatusFilter(
  status: string | null | undefined,
  selected: ReadonlySet<ScheduleDisplayStatusFilterId>
): boolean {
  if (selected.size === 0) return false
  return selected.has(resolveScheduleDisplayStatusFilterId(status))
}

export function scheduleDisplayStatusFilterLabel(
  id: ScheduleDisplayStatusFilterId,
  locale: string
): string {
  const opt = SCHEDULE_DISPLAY_STATUS_FILTER_OPTIONS.find((row) => row.id === id)
  if (!opt) return id
  return locale === 'ko' || locale.startsWith('ko') ? opt.labelKo : opt.labelEn
}
