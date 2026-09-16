'use client'

import ReactCountryFlag from 'react-country-flag'
import ScheduleHoverTooltip from '@/components/schedule/ScheduleHoverTooltip'
import {
  scheduleGuideLanguageMismatchLine,
  scheduleProductCellPulseReasonLabel,
  type ScheduleGuideLanguageMismatch,
  type ScheduleGuestLangBucket,
  type ScheduleProductCellPulseReason,
  type ScheduleRequiredGuideLang,
} from '@/lib/scheduleGuideLanguageMatch'

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
  /** 대기(pending) 중 일본어 고객 인원 */
  jaWaitingPeople?: number
  canceledPeople?: number
  assignmentPendingReservationCount?: number
  /** 확정·모집 예약 건수(그룹 수) */
  reservationGroupCount?: number
  /** 대기(pending) 예약 건수 */
  waitingReservationGroupCount?: number
  koPeople?: number
  enPeople?: number
  /** 확정·모집 중 일본어 고객 인원 */
  jaPeople?: number
  /** 배정된 가이드/어시 구사 언어가 한국어·일본어 손님과 맞지 않는 투어 */
  guideLanguageMismatches?: ScheduleGuideLanguageMismatch[]
  choiceCounts?: Record<string, number>
  privateTourPeople?: number
  companionTourPeople?: number
  tourCapacityBreakdown?: {
    rows: Array<{
      tourId: string
      teamIndex: number
      guideName: string
      assistantName: string
      staffLocales?: ScheduleGuestLangBucket[]
      assigned: number
      max: number
      spotsLeft: number
      assignmentStatusLabel: string
      assignmentStatus: string
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
  jaPeople?: number
  koWaitingPeople?: number
  enWaitingPeople?: number
  jaWaitingPeople?: number
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
  let ja = 0
  const choiceCounts: Record<string, number> = {}
  for (const dateString of dateStrings) {
    const dd = dailyData[dateString]
    if (!dd) continue
    ko += (dd.koPeople || 0) + (dd.koWaitingPeople || 0)
    en += (dd.enPeople || 0) + (dd.enWaitingPeople || 0)
    ja += (dd.jaPeople || 0) + (dd.jaWaitingPeople || 0)
    if (dd.choiceCounts) {
      for (const [k, v] of Object.entries(dd.choiceCounts)) {
        if (v > 0) choiceCounts[k] = (choiceCounts[k] || 0) + v
      }
    }
  }
  return { ko, en, ja, choiceCounts }
}

function PulseReasonFlag({ locale }: { locale: ScheduleRequiredGuideLang }) {
  return (
    <ReactCountryFlag
      countryCode={locale === 'ko' ? 'KR' : 'JP'}
      svg
      style={{ width: '0.95em', height: '0.7em' }}
    />
  )
}

export function ScheduleProductCellPulseReasonBadges({
  reasons,
  uiLocale = 'ko',
}: {
  reasons: ScheduleProductCellPulseReason[]
  uiLocale?: string
}) {
  if (reasons.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1">
      {reasons.map((reason) => {
        const kindClass =
          reason.kind === 'capacity_overflow'
            ? 'bg-red-500 text-white'
            : reason.kind === 'unconfirmed_tour'
              ? 'bg-orange-500 text-white'
              : 'bg-violet-500 text-white'
        return (
          <span
            key={reason.kind}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${kindClass}`}
          >
            {reason.kind === 'guide_language'
              ? (reason.missingLocales || []).map((locale) => (
                  <PulseReasonFlag key={locale} locale={locale} />
                ))
              : null}
            {scheduleProductCellPulseReasonLabel(reason, uiLocale)}
          </span>
        )
      })}
    </div>
  )
}

export function ScheduleGuideLanguageMismatchLines({
  mismatches,
  uiLocale = 'ko',
}: {
  mismatches: ScheduleGuideLanguageMismatch[]
  uiLocale?: string
}) {
  if (mismatches.length === 0) return null
  const isKo = uiLocale === 'ko'
  return (
    <div className="mb-2 space-y-1 rounded-md border border-violet-400/60 bg-violet-950/40 px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-violet-200">
        {isKo ? '팀 언어 배정 (가이드·어시·드라이버)' : 'Team language (guide, assistant, driver)'}
      </div>
      {mismatches.map((mismatch) => (
        <div key={mismatch.tourId} className="text-[11px] leading-snug text-violet-50">
          {scheduleGuideLanguageMismatchLine(mismatch, uiLocale)}
        </div>
      ))}
    </div>
  )
}

const STAFF_LANG_FLAG_COUNTRY: Record<ScheduleGuestLangBucket, string> = {
  ko: 'KR',
  en: 'US',
  ja: 'JP',
}

const STAFF_FLAG_DISPLAY_ORDER: ScheduleGuestLangBucket[] = ['ko', 'en', 'ja']

export function ScheduleStaffSpeakFlags({
  locales,
  className = 'inline-flex items-center gap-0.5 ml-1 align-middle',
}: {
  locales?: ScheduleGuestLangBucket[] | undefined
  className?: string
}) {
  if (!locales || locales.length === 0) return null
  const ordered = STAFF_FLAG_DISPLAY_ORDER.filter((locale) => locales.includes(locale))
  return (
    <span className={className}>
      {ordered.map((locale) => (
        <span
          key={locale}
          title={locale === 'ko' ? '한국어' : locale === 'ja' ? '일본어' : '영어'}
          className="inline-flex"
        >
          <ReactCountryFlag
            countryCode={STAFF_LANG_FLAG_COUNTRY[locale]}
            svg
            style={{ width: '1em', height: '0.75em' }}
          />
        </span>
      ))}
    </span>
  )
}

export function ScheduleLangFlagsHoverLine({
  ko,
  en,
  ja = 0,
  className = 'flex items-center gap-2 mb-1.5 flex-nowrap',
}: {
  ko: number
  en: number
  ja?: number
  className?: string
}) {
  return (
    <div className={className}>
      <span className="inline-flex items-center gap-1 shrink-0">
        <ReactCountryFlag countryCode="KR" svg style={{ width: '1em', height: '0.75em' }} />
        <span>{ko}</span>
      </span>
      <span className="text-gray-400 shrink-0">/</span>
      <span className="inline-flex items-center gap-1 shrink-0">
        <ReactCountryFlag countryCode="US" svg style={{ width: '1em', height: '0.75em' }} />
        <span>{en}</span>
      </span>
      <span className="text-gray-400 shrink-0">/</span>
      <span className="inline-flex items-center gap-1 shrink-0">
        <ReactCountryFlag countryCode="JP" svg style={{ width: '1em', height: '0.75em' }} />
        <span>{ja}</span>
      </span>
    </div>
  )
}

export function ScheduleTotalColumnWithTooltip({
  total,
  tourCount = 0,
  valueClassName,
  breakdown,
}: {
  total: number
  /** 확정(confirmed) 투어 건수 — 인원 뒤에 `24 (6)` 형태로 표시 */
  tourCount?: number
  valueClassName: string
  breakdown: { ko: number; en: number; ja?: number; choiceCounts: Record<string, number> }
}) {
  const x = breakdown.choiceCounts.X || 0
  const l = breakdown.choiceCounts.L || 0
  return (
    <ScheduleHoverTooltip
      align="end"
      maxWidth={320}
      contentClassName="min-w-[200px]"
      content={
        <>
          <ScheduleLangFlagsHoverLine
            ko={breakdown.ko}
            en={breakdown.en}
            ja={breakdown.ja || 0}
          />
          <div className="whitespace-nowrap break-keep leading-tight">
            엑스 {x}명 / 로어 {l}명
          </div>
          {tourCount > 0 ? (
            <div className="whitespace-nowrap break-keep leading-tight mt-1 text-gray-300">
              확정 투어 {tourCount}건
            </div>
          ) : null}
        </>
      }
    >
      <div className={`${valueClassName} cursor-default whitespace-nowrap tabular-nums`}>
        {tourCount > 0 ? `${total} (${tourCount})` : total}
      </div>
    </ScheduleHoverTooltip>
  )
}
