'use client'

import ReactCountryFlag from 'react-country-flag'

const PRODUCT_SCHEDULE_KEYCAP_DIGITS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'] as const

export type ScheduleMonthDayCell = {
  date: number
  dayOfWeek: string
  dateString: string
  isEdgePadding?: boolean
}

export type ScheduleProductDayTotal = {
  totalPeople: number
  waitingPeople?: number
}

export type ScheduleProductGridDailyCell = {
  totalPeople: number
  waitingPeople?: number
  koWaitingPeople?: number
  enWaitingPeople?: number
  canceledPeople?: number
  assignmentPendingReservationCount?: number
  koPeople?: number
  enPeople?: number
  choiceCounts?: Record<string, number>
  privateTourPeople?: number
  companionTourPeople?: number
  tourCapacityBreakdown?: {
    rows: Array<{
      tourId: string
      teamIndex: number
      guideName: string
      assistantName: string
      assigned: number
      max: number
      spotsLeft: number
    }>
    totalAssigned: number
    totalMax: number
    totalSpotsLeft: number
  } | null
}

export type ScheduleProductGridProductRow = {
  product_name: string
  dailyData: Record<string, ScheduleProductGridDailyCell | undefined>
  totalPeople: number
  totalTours: number
}

type ScheduleDailyBreakdownSlice = {
  koPeople?: number
  enPeople?: number
  koWaitingPeople?: number
  enWaitingPeople?: number
  choiceCounts?: Record<string, number>
}

/** 단독 투어 인원만 키캡 이모지로 표시. 동행모집(비단독) 인원이 같이 있으면 `4️⃣ 5` 형태 */
export function formatProductScheduleCellPeopleWithPrivateSplit(
  privateTourPeople: number,
  companionTourPeople: number,
  waiting: number,
  canceled: number,
): string {
  const toKeycap = (n: number) =>
    String(Math.max(0, Math.floor(n)))
      .split('')
      .map((ch) => {
        const d = ch.charCodeAt(0) - 48
        return d >= 0 && d <= 9 ? PRODUCT_SCHEDULE_KEYCAP_DIGITS[d] : ch
      })
      .join('')

  let out: string
  if (privateTourPeople > 0 && companionTourPeople > 0) {
    out = `${toKeycap(privateTourPeople)} ${companionTourPeople}`
  } else if (privateTourPeople > 0) {
    out = toKeycap(privateTourPeople)
  } else {
    out = String(companionTourPeople)
  }
  if (waiting > 0) out += ` +${waiting}`
  if (canceled > 0) out += ` (${canceled})`
  return out
}

export function aggregateScheduleBreakdownFromDailyData(
  dailyData: Record<string, ScheduleDailyBreakdownSlice | undefined>,
  dateStrings: string[],
) {
  let ko = 0
  let en = 0
  const choiceCounts: Record<string, number> = {}
  for (const dateString of dateStrings) {
    const dd = dailyData[dateString]
    if (!dd) continue
    ko += (dd.koPeople || 0) + (dd.koWaitingPeople || 0)
    en += (dd.enPeople || 0) + (dd.enWaitingPeople || 0)
    if (dd.choiceCounts) {
      for (const [k, v] of Object.entries(dd.choiceCounts)) {
        if (v > 0) choiceCounts[k] = (choiceCounts[k] || 0) + v
      }
    }
  }
  return { ko, en, choiceCounts }
}

export function ScheduleTotalColumnWithTooltip({
  total,
  valueClassName,
  breakdown,
}: {
  total: number
  valueClassName: string
  breakdown: { ko: number; en: number; choiceCounts: Record<string, number> }
}) {
  const x = breakdown.choiceCounts.X || 0
  const l = breakdown.choiceCounts.L || 0
  return (
    <div className="group relative overflow-visible cursor-default">
      <div className={valueClassName}>{total}</div>
      <div className="absolute z-[1020] right-0 top-full mt-1 min-w-[200px] w-max max-w-[min(90vw,320px)] px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none overflow-visible text-left hidden group-hover:block">
        <div className="flex items-center gap-2 mb-1.5 flex-nowrap">
          <span className="inline-flex items-center gap-1 shrink-0">
            <ReactCountryFlag countryCode="KR" svg style={{ width: '1em', height: '0.75em' }} />
            <span>한국인 {breakdown.ko}명</span>
          </span>
          <span className="text-gray-400 shrink-0">/</span>
          <span className="inline-flex items-center gap-1 shrink-0">
            <ReactCountryFlag countryCode="US" svg style={{ width: '1em', height: '0.75em' }} />
            <span>미국인 {breakdown.en}명</span>
          </span>
        </div>
        <div className="whitespace-nowrap break-keep leading-tight">
          엑스 {x}명 / 로어 {l}명
        </div>
      </div>
    </div>
  )
}
