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
