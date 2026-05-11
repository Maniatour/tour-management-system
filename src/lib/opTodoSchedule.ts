import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const TZ = 'Asia/Seoul'

export type OpTodoNotifyCategory = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type OpTodoNotifyScheduleInput = {
  category: OpTodoNotifyCategory
  /** HH:mm, Seoul local */
  notifyTime: string
  /** weekly: 0=일 … 6=토 */
  notifyWeekday?: number | null
  /** monthly/yearly: 1–31 */
  notifyDayOfMonth?: number | null
  /** yearly: 1–12 */
  notifyMonth?: number | null
}

function parseHourMinute(notifyTime: string): { hour: number; minute: number } {
  const [a, b] = notifyTime.split(':').map((x) => parseInt(x.trim(), 10))
  const hour = Number.isFinite(a) ? Math.min(23, Math.max(0, a)) : 9
  const minute = Number.isFinite(b) ? Math.min(59, Math.max(0, b)) : 0
  return { hour, minute }
}

function clampDom(year: number, month0: number, dom: number): number {
  const dim = dayjs().year(year).month(month0).daysInMonth()
  return Math.min(Math.max(1, dom), dim)
}

/**
 * 스케줄에 따라 `from` 이후 가장 가까운 알림 시각(UTC ISO 문자열).
 */
export function computeNextNotifyAtIso(input: OpTodoNotifyScheduleInput, from: Date = new Date()): string {
  const { hour, minute } = parseHourMinute(input.notifyTime)
  const now = dayjs(from).tz(TZ)

  if (input.category === 'daily') {
    let t = now.hour(hour).minute(minute).second(0).millisecond(0)
    if (!t.isAfter(now)) t = t.add(1, 'day')
    return t.utc().toISOString()
  }

  if (input.category === 'weekly') {
    const wd = input.notifyWeekday != null ? Math.min(6, Math.max(0, input.notifyWeekday)) : 1
    let t = now.day(wd).hour(hour).minute(minute).second(0).millisecond(0)
    if (!t.isAfter(now)) t = t.add(1, 'week')
    return t.utc().toISOString()
  }

  if (input.category === 'monthly') {
    const dom = input.notifyDayOfMonth != null ? Math.min(31, Math.max(1, input.notifyDayOfMonth)) : 1
    const d = clampDom(now.year(), now.month(), dom)
    let t = now.date(d).hour(hour).minute(minute).second(0).millisecond(0)
    if (!t.isAfter(now)) {
      const n = now.add(1, 'month')
      const d2 = clampDom(n.year(), n.month(), dom)
      t = n.date(d2).hour(hour).minute(minute).second(0).millisecond(0)
    }
    return t.utc().toISOString()
  }

  // yearly
  const mo = input.notifyMonth != null ? Math.min(12, Math.max(1, input.notifyMonth)) : 1
  const month0 = mo - 1
  const dom = input.notifyDayOfMonth != null ? Math.min(31, Math.max(1, input.notifyDayOfMonth)) : 1
  const d = clampDom(now.year(), month0, dom)
  let t = now.month(month0).date(d).hour(hour).minute(minute).second(0).millisecond(0)
  if (!t.isAfter(now)) {
    const y = t.year() + 1
    const d2 = clampDom(y, month0, dom)
    t = dayjs.tz(
      `${y}-${String(mo).padStart(2, '0')}-${String(d2).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
      TZ
    )
  }
  return t.utc().toISOString()
}

/** 팀 `position` 문자열로 체크리스트 알림 수신 부서(office / guide / common) 후보 */
export function audiencesForTeamMember(position: string | null): ('office' | 'guide' | 'common')[] {
  const p = (position || '').toLowerCase()
  const set = new Set<'office' | 'guide' | 'common'>(['common'])
  if (p.includes('guide') || p.includes('가이드') || p.includes('driver') || p.includes('드라이버')) set.add('guide')
  if (
    p.includes('office') ||
    p.includes('op') ||
    p.includes('운영') ||
    p.includes('manager') ||
    p.includes('admin') ||
    p.includes('매니저') ||
    p.includes('관리')
  ) {
    set.add('office')
  }
  return [...set]
}
