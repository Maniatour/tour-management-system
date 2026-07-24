'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  buildOfficeScheduleStaffByDate,
  formatOfficeScheduleDayStaff,
  type OfficeScheduleDayStaffChip,
  type OfficeScheduleOffDayRow,
  type OfficeScheduleSlotRow,
  type OfficeScheduleStaffMember,
} from '@/lib/officeScheduleDayStaff'
import { getScheduleDisplayThreeWeekDateRange } from '@/lib/scheduleDisplayCalendarMeta'
import type { ScheduleDisplayCalendarTourSummary } from '@/components/schedule/ScheduleDisplayCalendar'
import ScheduleDisplayTourCard from '@/components/schedule/ScheduleDisplayTourCard'

const weekDaysKo = ['일', '월', '화', '수', '목', '금', '토']
const weekDaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type TourLike = {
  id: string
  tour_date?: string | null
}

export type ScheduleDisplayTourListProps<T extends TourLike = TourLike> = {
  toursByDate: Map<string, T[]>
  getTourSummary: (tour: T) => ScheduleDisplayCalendarTourSummary
  locale: string
  weekStart: Date
  /** 카드뷰: 이 날짜(YYYY-MM-DD) 이전은 숨김 (모바일 — 오늘부터) */
  minDate?: string
  onTourClick?: (tour: T) => void
  onAssignStaff?: (tour: T) => void
  onAssignVehicle?: (tour: T) => void
  officeStaffByDate?: Record<string, OfficeScheduleDayStaffChip[]>
}

function formatDateGroupLabel(date: string, locale: string, isToday: boolean): string {
  const d = dayjs(date)
  const weekday = locale === 'ko' ? weekDaysKo[d.day()] : weekDaysEn[d.day()]
  const dateLabel =
    locale === 'ko' ? d.locale('ko').format('M월 D일') : d.format('MMM D')
  const todaySuffix = isToday ? (locale === 'ko' ? ' · 오늘' : ' · Today') : ''
  return `${dateLabel} (${weekday})${todaySuffix}`
}

export default function ScheduleDisplayTourList<T extends TourLike>({
  toursByDate,
  getTourSummary,
  locale,
  weekStart,
  minDate,
  onTourClick,
  onAssignStaff,
  onAssignVehicle,
  officeStaffByDate: officeStaffByDateProp,
}: ScheduleDisplayTourListProps<T>) {
  const [officeStaffByDateFetched, setOfficeStaffByDateFetched] = useState<
    Record<string, OfficeScheduleDayStaffChip[]>
  >({})

  const loadOfficeSchedule = useCallback(async () => {
    if (officeStaffByDateProp) return
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

      setOfficeStaffByDateFetched(
        buildOfficeScheduleStaffByDate(
          staff,
          (slotsRes.data || []) as OfficeScheduleSlotRow[],
          (offDaysRes.data || []) as OfficeScheduleOffDayRow[]
        )
      )
    } catch (error) {
      console.error('Schedule display tour list office schedule load failed:', error)
      setOfficeStaffByDateFetched({})
    }
  }, [weekStart, officeStaffByDateProp])

  useEffect(() => {
    if (officeStaffByDateProp) return
    void loadOfficeSchedule()
  }, [loadOfficeSchedule, officeStaffByDateProp])

  const officeStaffByDate = officeStaffByDateProp ?? officeStaffByDateFetched
  const todayStr = dayjs().format('YYYY-MM-DD')

  const sortedDateGroups = useMemo(() => {
    return [...toursByDate.entries()]
      .filter(([date, tours]) => tours.length > 0 && (!minDate || date >= minDate))
      .sort(([a], [b]) => a.localeCompare(b))
  }, [toursByDate, minDate])

  if (sortedDateGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          {locale === 'ko' ? '표시할 투어가 없습니다' : 'No tours to show'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {locale === 'ko'
            ? '기간 또는 상태 필터를 조정해 보세요.'
            : 'Try adjusting the date range or status filter.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {sortedDateGroups.map(([date, dayTours]) => {
        const isToday = date === todayStr
        const isPast = date < todayStr
        const officeStaffLine = formatOfficeScheduleDayStaff(officeStaffByDate[date] || [])

        return (
          <section
            key={date}
            className={[
              'rounded-xl border p-3 sm:p-4',
              isToday
                ? 'border-primary/40 bg-sky-50/60 shadow-sm'
                : isPast
                  ? 'border-border/60 bg-slate-50/80'
                  : 'border-border/70 bg-white',
            ].join(' ')}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3
                  className={[
                    'text-sm font-semibold tabular-nums sm:text-base',
                    isToday ? 'text-primary' : 'text-foreground',
                  ].join(' ')}
                >
                  {formatDateGroupLabel(date, locale, isToday)}
                </h3>
                {isToday ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {locale === 'ko' ? '오늘' : 'Today'}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {dayTours.length}
                  {locale === 'ko' ? '건' : ` tour${dayTours.length === 1 ? '' : 's'}`}
                </span>
              </div>
              {officeStaffLine ? (
                <p
                  className="text-right text-[11px] font-medium text-slate-600"
                  title={locale === 'ko' ? 'Office Schedule 출근' : 'Office schedule'}
                >
                  {officeStaffLine}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2">
              {dayTours.map((tour) => (
                <ScheduleDisplayTourCard
                  key={tour.id}
                  tour={tour}
                  summary={getTourSummary(tour)}
                  locale={locale}
                  variant="list"
                  {...(onTourClick ? { onTourClick } : {})}
                  {...(onAssignStaff ? { onAssignStaff } : {})}
                  {...(onAssignVehicle ? { onAssignVehicle } : {})}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
