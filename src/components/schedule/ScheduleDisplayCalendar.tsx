'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import dayjs from 'dayjs'
import { Car, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { buildOfficeScheduleStaffByDate, formatOfficeScheduleDayStaff, type OfficeScheduleDayStaffChip, type OfficeScheduleOffDayRow, type OfficeScheduleSlotRow, type OfficeScheduleStaffMember } from '@/lib/officeScheduleDayStaff'
import {
  buildScheduleDisplayThreeWeekDays,
  getScheduleDisplayCalendarWeekStart,
  getScheduleDisplayThreeWeekDateRange,
} from '@/lib/scheduleDisplayCalendarMeta'
import { OTA_STATUS_META, type OtaSaleStatus } from '@/lib/otaPriceInventory'
import { getTourStatusIcon } from '@/utils/tourStatusUtils'
import ReactCountryFlag from 'react-country-flag'

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

export type ScheduleDisplayCalendarTourSummary = {
  productLabel: string
  tourStatus: string | null
  tourStatusLabel: string
  saleStatus: OtaSaleStatus
  productColorClassName?: string
  productColorStyle?: CSSProperties
  assignedPeople: number
  capacityDenom: number
  spotsLeft: number
  assignedKo: number
  assignedEn: number
  guideName: string
  assistantName: string
  vehicleNumber: string
  vehicleAssigned: boolean
  guideAssigned: boolean
  assistantAssigned: boolean
  requiresAssistant: boolean
  canyonBadges: Array<{ key: string; text: string; mismatch: boolean }>
}

type TourLike = {
  id: string
  tour_date?: string | null
}

export type ScheduleDisplayCalendarProps<T extends TourLike = TourLike> = {
  toursByDate: Map<string, T[]>
  getTourSummary: (tour: T) => ScheduleDisplayCalendarTourSummary
  locale: string
  weekStart: Date
  onWeekStartChange: (weekStart: Date) => void
  onTourClick?: (tour: T) => void
  onAssignStaff?: (tour: T) => void
  onAssignVehicle?: (tour: T) => void
  hideNavigation?: boolean
}

export type ScheduleDisplayCalendarNavProps = {
  locale: string
  weekStart: Date
  onWeekStartChange: (weekStart: Date) => void
  className?: string
}

export function ScheduleDisplayCalendarNav({
  locale,
  weekStart,
  onWeekStartChange,
  className = '',
}: ScheduleDisplayCalendarNavProps) {
  const { start: rangeStart, end: rangeEnd } = getScheduleDisplayThreeWeekDateRange(weekStart)

  return (
    <div className={`flex shrink-0 items-center gap-0.5 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => onWeekStartChange(dayjs(weekStart).subtract(7, 'day').toDate())}
        className="rounded-lg p-1.5 hover:bg-muted"
        aria-label={locale === 'ko' ? '이전 주' : 'Previous week'}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[88px] whitespace-nowrap text-center text-xs font-semibold tabular-nums sm:text-sm">
        {locale === 'ko'
          ? `${dayjs(rangeStart).format('M/D')} ~ ${dayjs(rangeEnd).format('M/D')}`
          : `${dayjs(rangeStart).format('MMM D')} – ${dayjs(rangeEnd).format('MMM D')}`}
      </span>
      <button
        type="button"
        onClick={() => onWeekStartChange(dayjs(weekStart).add(7, 'day').toDate())}
        className="rounded-lg p-1.5 hover:bg-muted"
        aria-label={locale === 'ko' ? '다음 주' : 'Next week'}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onWeekStartChange(getScheduleDisplayCalendarWeekStart())}
        className="ml-0.5 rounded-lg border px-2 py-0.5 text-[10px] font-medium hover:bg-muted"
      >
        {locale === 'ko' ? '오늘' : 'Today'}
      </button>
    </div>
  )
}

function formatStaffLine(
  summary: ScheduleDisplayCalendarTourSummary,
  locale: string
): string {
  const parts: string[] = []
  if (summary.guideName && summary.guideName !== '-') {
    parts.push(summary.guideName)
  } else {
    parts.push(locale === 'ko' ? '가이드 미배정' : 'No guide')
  }
  if (summary.requiresAssistant) {
    if (summary.assistantName && summary.assistantName !== '-') {
      parts.push(summary.assistantName)
    } else {
      parts.push(locale === 'ko' ? '어시 미배정' : 'No assistant')
    }
  }
  if (summary.vehicleAssigned && summary.vehicleNumber && summary.vehicleNumber !== '-') {
    parts.push(summary.vehicleNumber)
  } else {
    parts.push(locale === 'ko' ? '차량 미배정' : 'No vehicle')
  }
  return parts.join(' , ')
}

export default function ScheduleDisplayCalendar<T extends TourLike>({
  toursByDate,
  getTourSummary,
  locale,
  weekStart,
  onWeekStartChange,
  onTourClick,
  onAssignStaff,
  onAssignVehicle,
  hideNavigation = false,
}: ScheduleDisplayCalendarProps<T>) {
  const [officeStaffByDate, setOfficeStaffByDate] = useState<
    Record<string, OfficeScheduleDayStaffChip[]>
  >({})

  const loadOfficeSchedule = useCallback(async () => {
    const { start, end } = getScheduleDisplayThreeWeekDateRange(weekStart)
    try {
      const [teamRes, slotsRes, offDaysRes] = await Promise.all([
        supabase
          .from('team')
          .select('email, name_en, display_name, nick_name, name_ko, position')
          .eq('is_active', true)
          .or('position.ilike.op,position.ilike.office manager'),
        fromUntypedTable(supabase, 'office_schedule_slots')
          .select('employee_email, schedule_date, hour_slot')
          .gte('schedule_date', start)
          .lte('schedule_date', end),
        fromUntypedTable(supabase, 'office_schedule_off_days')
          .select('employee_email, schedule_date')
          .gte('schedule_date', start)
          .lte('schedule_date', end),
      ])

      if (teamRes.error) throw teamRes.error
      if (slotsRes.error) throw slotsRes.error
      if (offDaysRes.error) throw offDaysRes.error

      const staff = ((teamRes.data || []) as OfficeScheduleStaffMember[]).map((row) => ({
        email: row.email,
        display_name: row.display_name ?? null,
        name_en: row.name_en ?? null,
        nick_name: row.nick_name ?? null,
        name_ko: row.name_ko ?? null,
      }))

      setOfficeStaffByDate(
        buildOfficeScheduleStaffByDate(
          staff,
          (slotsRes.data || []) as OfficeScheduleSlotRow[],
          (offDaysRes.data || []) as OfficeScheduleOffDayRow[]
        )
      )
    } catch (error) {
      console.error('Schedule display calendar office schedule load failed:', error)
      setOfficeStaffByDate({})
    }
  }, [weekStart])

  useEffect(() => {
    void loadOfficeSchedule()
  }, [loadOfficeSchedule])

  const calendarDays = useMemo(() => buildScheduleDisplayThreeWeekDays(weekStart), [weekStart])
  const todayStr = dayjs().format('YYYY-MM-DD')

  return (
    <div className="flex flex-col">
      {hideNavigation ? null : (
        <div className="mb-2 flex items-center justify-between gap-2">
          <ScheduleDisplayCalendarNav
            locale={locale}
            weekStart={weekStart}
            onWeekStartChange={onWeekStartChange}
          />
        </div>
      )}

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {weekDays.map((d) => (
          <div
            key={d}
            className="py-0.5 text-center text-[10px] font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((cell) => {
          const isToday = cell.date === todayStr
          const isPast = cell.date < todayStr
          const dayTours = toursByDate.get(cell.date) || []
          const officeStaffLine = formatOfficeScheduleDayStaff(officeStaffByDate[cell.date] || [])

          const cellSurfaceClass = isToday
            ? 'border-2 border-primary bg-sky-50 shadow-md shadow-primary/15'
            : isPast
              ? 'bg-slate-50/90 border-border/60'
              : 'bg-white border-border/70'

          return (
            <div
              key={cell.date}
              className={[
                'relative flex min-h-[96px] flex-col rounded-lg border p-1 text-left',
                cellSurfaceClass,
                isToday ? 'ring-2 ring-primary/35 ring-offset-1' : '',
              ].join(' ')}
            >
              <div className="mb-0.5 flex items-start justify-between gap-0.5">
                <span
                  className={[
                    'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded px-1 text-[10px] font-bold',
                    isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
                  ].join(' ')}
                >
                  {cell.day}
                </span>
                {isToday ? (
                  <span className="rounded bg-primary px-1 py-0.5 text-[7px] font-bold leading-none text-primary-foreground">
                    {locale === 'ko' ? '오늘' : 'Today'}
                  </span>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                {dayTours.map((tour) => {
                  const summary = getTourSummary(tour)
                  const staffLine = formatStaffLine(summary, locale)
                  const statusMeta = OTA_STATUS_META[summary.saleStatus]
                  const tourStatusIcon = getTourStatusIcon(summary.tourStatus)
                  const hasProductColor = Boolean(
                    summary.productColorStyle || summary.productColorClassName
                  )

                  return (
                    <div
                      key={tour.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onTourClick?.(tour)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onTourClick?.(tour)
                        }
                      }}
                      className={[
                        'w-full cursor-pointer rounded-md border p-1 text-left transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        summary.productColorClassName,
                        hasProductColor ? 'border-black/15' : 'border-border/60 bg-white/90',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={summary.productColorStyle}
                    >
                      <div className="mb-0.5 flex items-start justify-between gap-1">
                        <span className="flex min-w-0 flex-1 items-center gap-0.5">
                          {tourStatusIcon ? (
                            <span
                              className="shrink-0 text-[9px] leading-none"
                              title={summary.tourStatusLabel}
                              aria-label={summary.tourStatusLabel}
                            >
                              {tourStatusIcon}
                            </span>
                          ) : null}
                          <span
                            className={[
                              'min-w-0 truncate text-[9px] font-semibold leading-tight',
                              hasProductColor ? 'text-inherit' : 'text-foreground',
                            ].join(' ')}
                          >
                            {summary.productLabel}
                          </span>
                          <span
                            className={[
                              'ml-1 inline-flex shrink-0 items-center gap-0.5 tabular-nums text-[8px] font-medium leading-none',
                              hasProductColor ? 'text-inherit opacity-90' : 'text-muted-foreground',
                            ].join(' ')}
                            title={
                              locale === 'ko'
                                ? `한국어 ${summary.assignedKo} · 영어 ${summary.assignedEn}`
                                : `Korean ${summary.assignedKo} · English ${summary.assignedEn}`
                            }
                          >
                            <ReactCountryFlag
                              countryCode="KR"
                              svg
                              style={{ width: '0.85em', height: '0.65em' }}
                              aria-hidden
                            />
                            {summary.assignedKo}
                            <ReactCountryFlag
                              countryCode="US"
                              svg
                              style={{ width: '0.85em', height: '0.65em' }}
                              aria-hidden
                            />
                            {summary.assignedEn}
                          </span>
                        </span>
                        <span
                          className={[
                            'shrink-0 rounded border px-1 py-0.5 text-[7px] font-semibold leading-none',
                            statusMeta.badgeClass,
                          ].join(' ')}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <p
                        className={[
                          'mb-0.5 line-clamp-2 text-[8px] leading-snug',
                          hasProductColor ? 'text-inherit opacity-90' : 'text-muted-foreground',
                        ].join(' ')}
                      >
                        {staffLine}
                      </p>
                      <div className="mb-0.5 flex items-center justify-between gap-0.5">
                        <span className="inline-flex shrink-0 rounded bg-blue-50 px-1 py-0.5 text-[8px] font-medium tabular-nums text-blue-900">
                          🚍 {summary.assignedPeople} / {summary.capacityDenom}
                        </span>
                        {onAssignStaff || onAssignVehicle ? (
                          <div
                            className="ml-auto flex shrink-0 items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {onAssignStaff ? (
                              <button
                                type="button"
                                aria-label={locale === 'ko' ? '가이드 배정' : 'Assign guide'}
                                title={locale === 'ko' ? '가이드 배정' : 'Assign guide'}
                                className="inline-flex items-center justify-center rounded border border-border bg-white/95 p-0.5 text-primary hover:bg-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onAssignStaff(tour)
                                }}
                              >
                                <UserPlus className="h-2.5 w-2.5 shrink-0" aria-hidden />
                              </button>
                            ) : null}
                            {onAssignVehicle ? (
                              <button
                                type="button"
                                aria-label={locale === 'ko' ? '차량 배정' : 'Assign vehicle'}
                                title={locale === 'ko' ? '차량 배정' : 'Assign vehicle'}
                                className="inline-flex items-center justify-center rounded border border-amber-300 bg-white/95 p-0.5 text-amber-950 hover:bg-amber-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onAssignVehicle(tour)
                                }}
                              >
                                <Car className="h-2.5 w-2.5 shrink-0" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {summary.canyonBadges.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {summary.canyonBadges.map((badge) => (
                            <span
                              key={badge.key}
                              className={[
                                'inline-flex rounded px-1 py-0.5 text-[8px] font-medium tabular-nums',
                                badge.mismatch
                                  ? 'border border-amber-300 bg-amber-50 text-amber-950'
                                  : 'bg-orange-50 text-orange-900',
                              ].join(' ')}
                            >
                              {badge.text}
                              {badge.mismatch ? ' ⚠️' : ''}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {officeStaffLine ? (
                <p
                  className="mt-auto shrink-0 pt-0.5 text-right text-[7px] font-semibold leading-tight text-slate-700"
                  title={locale === 'ko' ? 'Office Schedule 출근' : 'Office schedule'}
                >
                  {officeStaffLine}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
