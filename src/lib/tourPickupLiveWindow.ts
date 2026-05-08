/** 투어 픽업일·스케줄(분) 기준으로 가이드 픽업 공유 UI 표시 구간 계산 — 브라우저 로컬 타임존 사용 */

export function hhmmToSortMinutes(hhmm: string): number {
  const raw = (hhmm || '').trim().substring(0, 5)
  const [h, m] = raw.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return h * 60 + m
}

export function combineTourDateAndMinutesLocal(tourDate: string, minutesFromMidnight: number): Date {
  const [y, mo, d] = tourDate.split('-').map(Number)
  if (!y || !mo || !d) return new Date(NaN)
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0)
  dt.setMinutes(minutesFromMidnight)
  return dt
}

export function isTourCalendarDayLocal(tourDate: string, now: Date = new Date()): boolean {
  const [y, mo, d] = tourDate.split('-').map(Number)
  if (!y || !mo || !d) return false
  return now.getFullYear() === y && now.getMonth() === mo - 1 && now.getDate() === d
}

/** 첫 픽업 시각 ~ 마지막 픽업 시각+30분 (투어 달력일이 오늘일 때만 true) */
export function isWithinGuidePickupShareWindow(
  tourDate: string,
  schedule: { sortMinutes: number }[],
  now: Date = new Date()
): boolean {
  if (schedule.length === 0 || !isTourCalendarDayLocal(tourDate, now)) return false
  const sorted = [...schedule.map((s) => s.sortMinutes)].sort((a, b) => a - b)
  const start = combineTourDateAndMinutesLocal(tourDate, sorted[0])
  const end = combineTourDateAndMinutesLocal(tourDate, sorted[sorted.length - 1])
  end.setMinutes(end.getMinutes() + 30)
  return now >= start && now <= end
}

export function buildPickupCompleteChatMessages(
  lang: 'ko' | 'en',
  completed: { time: string; hotel: string; location: string },
  next: { time: string; hotel: string; location: string } | null
): { ko: string; en: string } {
  const locDone =
    completed.location && completed.location.trim()
      ? `${completed.hotel} (${completed.location})`
      : completed.hotel
  if (!next) {
    return {
      ko: `🚐 픽업 안내\n✅ ${locDone} 픽업을 완료했습니다.\n✅ 오늘 예정된 호텔 픽업을 모두 마쳤습니다.`,
      en: `🚐 Pickup update\n✅ Completed pickup at ${locDone}.\n✅ All scheduled hotel pickups for today are done.`
    }
  }
  const locNext =
    next.location && next.location.trim() ? `${next.hotel} (${next.location})` : next.hotel
  return {
    ko: `🚐 픽업 안내\n✅ ${locDone} 픽업을 완료했습니다.\n➡️ 다음 픽업: ${next.time} ${locNext}로 이동 중입니다.`,
    en: `🚐 Pickup update\n✅ Completed pickup at ${locDone}.\n➡️ Next: heading to ${locNext} for the ${next.time} pickup.`
  }
}
