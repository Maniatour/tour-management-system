'use client'

import type { CSSProperties } from 'react'
import { Car, UserPlus } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { OTA_STATUS_META } from '@/lib/otaPriceInventory'
import { getTourStatusIcon } from '@/utils/tourStatusUtils'
import type { ScheduleDisplayCalendarTourSummary } from '@/components/schedule/ScheduleDisplayCalendar'

export function formatScheduleDisplayStaffLine(
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

type TourLike = { id: string }

type ScheduleDisplayTourCardProps<T extends TourLike> = {
  tour: T
  summary: ScheduleDisplayCalendarTourSummary
  locale: string
  variant?: 'calendar' | 'list'
  onTourClick?: (tour: T) => void
  onAssignStaff?: (tour: T) => void
  onAssignVehicle?: (tour: T) => void
}

export default function ScheduleDisplayTourCard<T extends TourLike>({
  tour,
  summary,
  locale,
  variant = 'list',
  onTourClick,
  onAssignStaff,
  onAssignVehicle,
}: ScheduleDisplayTourCardProps<T>) {
  const isCalendar = variant === 'calendar'
  const staffLine = formatScheduleDisplayStaffLine(summary, locale)
  const statusMeta = OTA_STATUS_META[summary.saleStatus]
  const tourStatusIcon = getTourStatusIcon(summary.tourStatus)
  const hasProductColor = Boolean(summary.productColorStyle || summary.productColorClassName)

  return (
    <div
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
        'w-full cursor-pointer rounded-lg border text-left transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isCalendar ? 'rounded-md p-1' : 'p-3 shadow-sm hover:shadow-md',
        summary.productColorClassName,
        hasProductColor ? 'border-black/15' : 'border-border/60 bg-white',
      ]
        .filter(Boolean)
        .join(' ')}
      style={summary.productColorStyle as CSSProperties | undefined}
    >
      <div
        className={[
          'flex items-start justify-between gap-2',
          isCalendar ? 'mb-0.5 gap-1' : 'mb-2',
        ].join(' ')}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1">
          {tourStatusIcon ? (
            <span
              className={[
                'shrink-0 leading-none',
                isCalendar ? 'text-[9px]' : 'text-sm',
              ].join(' ')}
              title={summary.tourStatusLabel}
              aria-label={summary.tourStatusLabel}
            >
              {tourStatusIcon}
            </span>
          ) : null}
          <span
            className={[
              'min-w-0 font-semibold leading-tight',
              isCalendar ? 'truncate text-[9px]' : 'text-sm',
              hasProductColor ? 'text-inherit' : 'text-foreground',
            ].join(' ')}
          >
            {summary.productLabel}
          </span>
          <span
            className={[
              'inline-flex shrink-0 items-center gap-0.5 font-medium tabular-nums leading-none',
              isCalendar ? 'ml-1 text-[8px]' : 'text-xs',
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
            'shrink-0 rounded border font-semibold leading-none',
            isCalendar ? 'px-1 py-0.5 text-[7px]' : 'px-2 py-1 text-[10px]',
            statusMeta.badgeClass,
          ].join(' ')}
        >
          {statusMeta.label}
        </span>
      </div>

      <p
        className={[
          'leading-snug',
          isCalendar ? 'mb-0.5 line-clamp-2 text-[8px]' : 'mb-2 text-xs',
          hasProductColor ? 'text-inherit opacity-90' : 'text-muted-foreground',
        ].join(' ')}
      >
        {staffLine}
      </p>

      <div
        className={[
          'flex items-center justify-between gap-2',
          isCalendar ? 'mb-0.5 gap-0.5' : 'mb-2',
        ].join(' ')}
      >
        <span
          className={[
            'inline-flex shrink-0 rounded bg-blue-50 font-medium tabular-nums text-blue-900',
            isCalendar ? 'px-1 py-0.5 text-[8px]' : 'px-2 py-1 text-xs',
          ].join(' ')}
        >
          🚍 {summary.assignedPeople} / {summary.capacityDenom}
        </span>
        {onAssignStaff || onAssignVehicle ? (
          <div
            className="ml-auto flex shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {onAssignStaff ? (
              <button
                type="button"
                aria-label={locale === 'ko' ? '가이드 배정' : 'Assign guide'}
                title={locale === 'ko' ? '가이드 배정' : 'Assign guide'}
                className={[
                  'inline-flex items-center justify-center rounded border border-border bg-white text-primary hover:bg-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
                  isCalendar ? 'p-0.5' : 'p-1.5',
                ].join(' ')}
                onClick={(e) => {
                  e.stopPropagation()
                  onAssignStaff(tour)
                }}
              >
                <UserPlus
                  className={isCalendar ? 'h-2.5 w-2.5 shrink-0' : 'h-4 w-4 shrink-0'}
                  aria-hidden
                />
              </button>
            ) : null}
            {onAssignVehicle ? (
              <button
                type="button"
                aria-label={locale === 'ko' ? '차량 배정' : 'Assign vehicle'}
                title={locale === 'ko' ? '차량 배정' : 'Assign vehicle'}
                className={[
                  'inline-flex items-center justify-center rounded border border-amber-300 bg-white text-amber-950 hover:bg-amber-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500',
                  isCalendar ? 'p-0.5' : 'p-1.5',
                ].join(' ')}
                onClick={(e) => {
                  e.stopPropagation()
                  onAssignVehicle(tour)
                }}
              >
                <Car
                  className={isCalendar ? 'h-2.5 w-2.5 shrink-0' : 'h-4 w-4 shrink-0'}
                  aria-hidden
                />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {summary.canyonBadges.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {summary.canyonBadges.map((badge) => (
            <span
              key={badge.key}
              className={[
                'inline-flex rounded font-medium tabular-nums',
                isCalendar ? 'px-1 py-0.5 text-[8px]' : 'px-2 py-1 text-[11px]',
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
}
