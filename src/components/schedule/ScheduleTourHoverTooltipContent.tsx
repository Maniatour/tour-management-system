'use client'

import { AlertTriangle, Bus, Calendar, Car, User, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import dayjs from 'dayjs'
import { ScheduleLangFlagsHoverLine } from '@/lib/scheduleProductGridHelpers'
import {
  getAssignmentStatusLabel,
  isAssignmentStatusConfirmed,
} from '@/lib/guideAssignmentStatus'
import {
  tourChoiceCountsDisplayKeys,
  type TourChoiceCounts,
} from '@/lib/tourChoiceCounts'
import {
  scheduleAssignedTourLanguageMismatchAlert,
  type ScheduleRequiredGuideLang,
} from '@/lib/scheduleGuideLanguageMatch'
import {
  scheduleAssignedTourPulseAlertLine,
  type ScheduleAssignedTourPulseIssue,
} from '@/lib/scheduleAssignedTourPulse'
import { isTourCancelled, isTourConfirmedStatus } from '@/utils/tourStatusUtils'

type ScheduleTourHoverTooltipContentProps = {
  productName: string
  tourDate?: string | null
  isPrivateTour?: boolean
  assignedPeople: number
  guideName: string
  assistantName: string
  vehicleNumber: string
  vehicleAssigned?: boolean
  assignmentStatus: string
  tourStatus?: string | null
  tourStatusLabel?: string
  locale?: string
  assignedKo: number
  assignedEn: number
  assignedJa?: number
  choiceCounts?: TourChoiceCounts | null
  languageMismatchMissingLocales?: ScheduleRequiredGuideLang[] | undefined
  confirmationIssues?: ScheduleAssignedTourPulseIssue[] | undefined
}

function isPresentName(value: string | null | undefined): boolean {
  const v = (value || '').trim()
  return v.length > 0 && v !== '-' && v !== 'N/A'
}

export default function ScheduleTourHoverTooltipContent({
  productName,
  tourDate,
  isPrivateTour = false,
  assignedPeople,
  guideName,
  assistantName,
  vehicleNumber,
  vehicleAssigned,
  assignmentStatus,
  tourStatus,
  tourStatusLabel,
  locale = 'ko',
  assignedKo,
  assignedEn,
  assignedJa = 0,
  choiceCounts,
  languageMismatchMissingLocales,
  confirmationIssues,
}: ScheduleTourHoverTooltipContentProps) {
  const isKo = locale === 'ko'
  const staffNames = [guideName, assistantName].filter(isPresentName)
  const hasVehicle = vehicleAssigned ?? isPresentName(vehicleNumber)
  const vehicleLabel = isPresentName(vehicleNumber) ? vehicleNumber : null
  const statusLabel = getAssignmentStatusLabel(assignmentStatus, locale)
  const tourStatusText = tourStatusLabel || (isKo ? '미정' : 'Unset')
  const assignmentConfirmed = isAssignmentStatusConfirmed(assignmentStatus)
  const tourConfirmed = isTourConfirmedStatus(tourStatus)
  const cancelled = isTourCancelled(tourStatus)
  const choiceKeys = choiceCounts ? tourChoiceCountsDisplayKeys(choiceCounts) : []
  const hoverAlerts =
    confirmationIssues && confirmationIssues.length > 0
      ? confirmationIssues
      : cancelled
        ? []
        : ([
            !hasVehicle ? { kind: 'missing_dispatch' as const } : null,
            !assignmentConfirmed
              ? { kind: 'unconfirmed_assignment' as const, statusLabel }
              : null,
            !tourConfirmed
              ? { kind: 'unconfirmed_tour' as const, statusLabel: tourStatusText }
              : null,
          ].filter(Boolean) as ScheduleAssignedTourPulseIssue[])

  const row1Tail: ReactNode[] = []
  if (staffNames.length > 0) {
    row1Tail.push(
      <span key="staff" className="whitespace-nowrap">
        {staffNames.join(' , ')}
      </span>,
    )
  }
  if (vehicleLabel) {
    row1Tail.push(
      <span key="vehicle" className="inline-flex items-center gap-0.5 whitespace-nowrap">
        <Car className="w-3 h-3 shrink-0" aria-hidden />
        {vehicleLabel}
      </span>,
    )
  }

  const dateLabel = tourDate && dayjs(tourDate).isValid() ? dayjs(tourDate).format('M/D') : ''

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 leading-tight">
        <span className="font-semibold whitespace-nowrap">
          {dateLabel ? `${dateLabel} ` : ''}
          {isPrivateTour ? '🔒 ' : ''}
          {productName}
        </span>
        <span className="inline-flex items-center gap-0.5 tabular-nums whitespace-nowrap">
          <Users className="w-3 h-3 shrink-0" aria-hidden />
          {assignedPeople}
        </span>
        {row1Tail.map((node, index) => (
          <span key={index} className="inline-flex items-center gap-1.5">
            {index > 0 ? <span className="text-gray-400">,</span> : null}
            {node}
          </span>
        ))}
      </div>
      <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 leading-tight">
        <span
          className={`inline-flex items-center gap-0.5 whitespace-nowrap ${
            hasVehicle ? 'text-emerald-300' : 'font-semibold text-amber-300'
          }`}
        >
          <Bus className="w-3 h-3 shrink-0" aria-hidden />
          {isKo ? '배차' : 'Dispatch'}: {hasVehicle ? (isKo ? '배차 완료' : 'Dispatched') : isKo ? '미배차' : 'No vehicle'}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 whitespace-nowrap ${
            assignmentConfirmed ? 'text-emerald-300' : 'font-semibold text-yellow-300'
          }`}
        >
          <User className="w-3 h-3 shrink-0" aria-hidden />
          {isKo ? '배정' : 'Assignment'}: {statusLabel}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 whitespace-nowrap ${
            tourConfirmed ? 'text-emerald-300' : 'font-semibold text-orange-300'
          }`}
        >
          <Calendar className="w-3 h-3 shrink-0" aria-hidden />
          {isKo ? '상태' : 'Status'}: {tourStatusText}
        </span>
      </div>
      <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 leading-tight">
        <ScheduleLangFlagsHoverLine
          ko={assignedKo}
          en={assignedEn}
          ja={assignedJa}
          className="inline-flex items-center gap-1.5 flex-nowrap"
        />
        {choiceKeys.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap break-keep">
            <span className="text-gray-400">,</span>
            {choiceKeys.map((key, index) => (
              <span key={key}>
                {index > 0 ? ', ' : ''}
                {`🏜️ ${key} ${choiceCounts?.[key] || 0}`}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      {hoverAlerts.map((issue) => (
        <div key={issue.kind} className="flex items-start gap-1 font-semibold text-yellow-300">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          <span>{scheduleAssignedTourPulseAlertLine(issue, locale)}</span>
        </div>
      ))}
      {languageMismatchMissingLocales && languageMismatchMissingLocales.length > 0 ? (
        <div className="flex items-start gap-1 font-semibold text-yellow-300">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          <span>
            {scheduleAssignedTourLanguageMismatchAlert(languageMismatchMissingLocales, locale)}
          </span>
        </div>
      ) : null}
    </div>
  )
}
