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

function normalizeDrivingLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[→➡➜➝➞]/g, '->')
    .replace(/\s+/g, ' ')
    .replace(/\s*->\s*/g, ' -> ')
}

/**
 * 기본 Driving 구간의 대략 소요 시간(분).
 * Google Maps 일반 교통 기준을 15분 단위로 반올림.
 */
const APPROX_DRIVING_MINUTES_BY_LABEL: Record<string, number> = {
  [normalizeDrivingLabel('호텔 픽업')]: 45,
  [normalizeDrivingLabel('Hotel Pickup')]: 45,
  [normalizeDrivingLabel('라스베이거스 → 스타게이징')]: 90,
  [normalizeDrivingLabel('Las Vegas -> Stargazing')]: 90,
  [normalizeDrivingLabel('스타게이징 → 킹먼')]: 45,
  [normalizeDrivingLabel('Stargazing -> Kingman')]: 45,
  [normalizeDrivingLabel('킹먼 → 윌리엄스')]: 90,
  [normalizeDrivingLabel('Kingman -> Williams')]: 90,
  [normalizeDrivingLabel('윌리엄스 → 그랜드캐년 사우스')]: 60,
  [normalizeDrivingLabel('Williams -> Grand Canyon South')]: 60,
  [normalizeDrivingLabel('사우스림 → 이스트림')]: 45,
  [normalizeDrivingLabel('South Rim -> East Rim')]: 45,
  [normalizeDrivingLabel('이스트림 → 캐머런')]: 30,
  [normalizeDrivingLabel('East Rim -> Cameron')]: 30,
  [normalizeDrivingLabel('캐머런 → 페이지')]: 90,
  [normalizeDrivingLabel('Cameron -> Page')]: 90,
  [normalizeDrivingLabel('페이지 → 카납')]: 75,
  [normalizeDrivingLabel('Page -> Kanab')]: 75,
  [normalizeDrivingLabel('카납 → 허리케인')]: 75,
  [normalizeDrivingLabel('Kanab -> Hurricane')]: 75,
  [normalizeDrivingLabel('허리케인 → 라스베이거스')]: 150,
  [normalizeDrivingLabel('Hurricane -> Las Vegas')]: 150,
  [normalizeDrivingLabel('호텔 드롭')]: 45,
  [normalizeDrivingLabel('Hotel Drop')]: 45,
}

export function approxDrivingMinutesForSegment(
  segment: Pick<TourReportDrivingSegment, 'label_ko' | 'label_en'> | undefined
): number | null {
  if (!segment) return null
  for (const label of [segment.label_ko, segment.label_en]) {
    const key = normalizeDrivingLabel(label || '')
    if (!key) continue
    const minutes = APPROX_DRIVING_MINUTES_BY_LABEL[key]
    if (typeof minutes === 'number' && minutes > 0) return minutes
  }
  return null
}

export function sumApproxDrivingMinutes(
  segmentIds: string[],
  byId: Map<string, TourReportDrivingSegment>
): number {
  let total = 0
  for (const id of segmentIds) {
    const minutes = approxDrivingMinutesForSegment(byId.get(id))
    if (minutes) total += minutes
  }
  return total
}

export function formatApproxDrivingDuration(minutes: number, locale: string): string {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  if (locale === 'en') {
    if (hours <= 0) return `approx. ${rest} min`
    if (rest === 0) return `approx. ${hours}h`
    return `approx. ${hours}h ${rest}m`
  }
  if (hours <= 0) return `대략 ${rest}분`
  if (rest === 0) return `대략 ${hours}시간`
  return `대략 ${hours}시간 ${rest}분`
}
