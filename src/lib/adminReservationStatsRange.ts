import {
  browserLocalWeekRangeFromOffset,
  browserLocalCalendarMonthWindow,
  browserLocalCalendarYearWindow,
} from '@/lib/browserLocalWeek'

/** 통계 패널·등록/취소 차트·감사 조회용 활동 ISO 구간 (카드 주간 7일과 분리) */
export function computeStatisticsActivityIsoRange(args: {
  statisticsWeekOffset: number
  regCancelMonthOffset: number
  regCancelYearOffset: number
}): { rangeStartIso: string; rangeEndIso: string } {
  const weekR = browserLocalWeekRangeFromOffset(args.statisticsWeekOffset)
  let rangeStartIso = weekR.rangeStartIso
  let rangeEndIso = weekR.rangeEndIso

  const m = browserLocalCalendarMonthWindow(args.regCancelMonthOffset)
  if (m.rangeStartIso < rangeStartIso) rangeStartIso = m.rangeStartIso
  if (m.rangeEndIso > rangeEndIso) rangeEndIso = m.rangeEndIso

  const y = browserLocalCalendarYearWindow(args.regCancelYearOffset)
  if (y.rangeStartIso < rangeStartIso) rangeStartIso = y.rangeStartIso
  if (y.rangeEndIso > rangeEndIso) rangeEndIso = y.rangeEndIso

  /** 7일 차트 YTD 요일 평균선 */
  const jan1Iso = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0, 0).toISOString()
  if (jan1Iso < rangeStartIso) rangeStartIso = jan1Iso

  return { rangeStartIso, rangeEndIso }
}

/** 통계 모달 1차 로드: 차트·상단 요약에 필요한 최소 활동 구간(연초 YTD 제외) */
export function computeStatisticsCoreActivityIsoRange(args: {
  statisticsWeekOffset: number
  regCancelGranularity: 'week' | 'month' | 'year'
  regCancelMonthOffset: number
  regCancelYearOffset: number
}): { rangeStartIso: string; rangeEndIso: string } {
  const weekR = browserLocalWeekRangeFromOffset(args.statisticsWeekOffset)
  let rangeStartIso = weekR.rangeStartIso
  let rangeEndIso = weekR.rangeEndIso

  if (args.regCancelGranularity === 'month') {
    const m = browserLocalCalendarMonthWindow(args.regCancelMonthOffset)
    if (m.rangeStartIso < rangeStartIso) rangeStartIso = m.rangeStartIso
    if (m.rangeEndIso > rangeEndIso) rangeEndIso = m.rangeEndIso
  } else if (args.regCancelGranularity === 'year') {
    const y = browserLocalCalendarYearWindow(args.regCancelYearOffset)
    if (y.rangeStartIso < rangeStartIso) rangeStartIso = y.rangeStartIso
    if (y.rangeEndIso > rangeEndIso) rangeEndIso = y.rangeEndIso
  }

  return { rangeStartIso, rangeEndIso }
}

/** 7일 차트 YTD 요일 평균선 — 1/1~어제 (코어 구간과 별도 2차 로드) */
export function computeStatisticsYtdExtensionIsoRange(now = new Date()): {
  rangeStartIso: string
  rangeEndIso: string
} {
  const year = now.getFullYear()
  const jan1Iso = new Date(year, 0, 1, 0, 0, 0, 0).toISOString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(23, 59, 59, 999)
  return { rangeStartIso: jan1Iso, rangeEndIso: yesterday.toISOString() }
}
