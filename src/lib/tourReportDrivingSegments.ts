import { isSuperAdminEmail } from '@/lib/superAdmin'

export type TourReportDrivingSegment = {
  id: string
  label_ko: string
  label_en: string
  sort_order: number
  is_active: boolean
}

/** OP, office manager, super — Driving 구간 목록 CRUD */
export function canManageTourReportDrivingSegments(
  position: string | null | undefined,
  email?: string | null
): boolean {
  if (isSuperAdminEmail(email)) return true
  const p = (position || '').trim().toLowerCase()
  return (
    p === 'op' ||
    p === 'super' ||
    p === 'office manager' ||
    p === 'office_manager' ||
    p === 'op manager' ||
    p === 'manager' ||
    p === '매니저'
  )
}

export function displayDrivingSegmentLabel(
  segment: Pick<TourReportDrivingSegment, 'label_ko' | 'label_en'>,
  locale: string
): string {
  if (locale === 'en') {
    return (segment.label_en || segment.label_ko || '').trim()
  }
  return (segment.label_ko || segment.label_en || '').trim()
}
