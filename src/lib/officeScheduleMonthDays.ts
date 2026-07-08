import dayjs from 'dayjs'

export type OfficeScheduleDay = {
  date: number
  dateString: string
  dayOfWeek: string
  dayIndex: number
  isEdgePadding: boolean
  isWeekend: boolean
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'] as const
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** 스케줄 뷰와 동일: 전월 마지막 날 + 해당 월 전체 + 익월 첫날 */
export function buildOfficeScheduleMonthDays(monthYmd: string, locale: string): OfficeScheduleDay[] {
  const currentDate = dayjs(`${monthYmd}-01`)
  const dowMap = locale === 'en' ? DOW_EN : DOW_KO
  const days: OfficeScheduleDay[] = []
  const first = currentDate.startOf('month')
  const last = currentDate.endOf('month')
  const prev = first.subtract(1, 'day')
  days.push({
    date: prev.date(),
    dateString: prev.format('YYYY-MM-DD'),
    dayOfWeek: dowMap[prev.day()],
    dayIndex: prev.day(),
    isEdgePadding: true,
    isWeekend: prev.day() === 0 || prev.day() === 6,
  })
  const daysInMonth = currentDate.daysInMonth()
  for (let i = 1; i <= daysInMonth; i++) {
    const d = currentDate.date(i)
    days.push({
      date: i,
      dateString: d.format('YYYY-MM-DD'),
      dayOfWeek: dowMap[d.day()],
      dayIndex: d.day(),
      isEdgePadding: false,
      isWeekend: d.day() === 0 || d.day() === 6,
    })
  }
  const next = last.add(1, 'day')
  days.push({
    date: next.date(),
    dateString: next.format('YYYY-MM-DD'),
    dayOfWeek: dowMap[next.day()],
    dayIndex: next.day(),
    isEdgePadding: true,
    isWeekend: next.day() === 0 || next.day() === 6,
  })
  return days
}

/** hour_slot DB 값: 0=0:00~9:00 블록, 9~23=시간별 */
export type OfficeScheduleTimeRow = {
  hourSlot: number
  startLabel: string
  endLabel: string
  isBlock: boolean
}

export function buildOfficeScheduleTimeRows(locale: string): OfficeScheduleTimeRow[] {
  const fmt = (h: number) => {
    if (locale === 'en') {
      const suffix = h === 0 || h === 12 ? (h < 12 ? 'AM' : 'PM') : h < 12 ? 'AM' : 'PM'
      const display = h === 0 ? 12 : h > 12 ? h - 12 : h
      return `${display}:00 ${suffix}`
    }
    if (h === 0) return '0:00'
    if (h < 12) return `오전 ${h}시`
    if (h === 12) return '오후 12시'
    return `오후 ${h - 12}시`
  }

  const rows: OfficeScheduleTimeRow[] = [
    { hourSlot: 0, startLabel: fmt(0), endLabel: fmt(9), isBlock: true },
  ]
  for (let h = 9; h <= 23; h++) {
    const endH = h === 23 ? 0 : h + 1
    rows.push({
      hourSlot: h,
      startLabel: fmt(h),
      endLabel: endH === 0 ? (locale === 'en' ? '12:00 AM' : '0:00') : fmt(endH),
      isBlock: false,
    })
  }
  return rows
}

export function officeScheduleCellKey(date: string, hourSlot: number): string {
  return `${date}|${hourSlot}`
}

export function officeScheduleSlotKey(email: string, date: string, hour: number): string {
  return `${email.trim().toLowerCase()}|${date}|${hour}`
}
