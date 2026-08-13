'use client'

import { Car, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import dayjs from 'dayjs'
import { ScheduleLangFlagsHoverLine } from '@/lib/scheduleProductGridHelpers'
import {
  getAssignmentStatusBadgeColor,
  getAssignmentStatusLabel,
} from '@/lib/guideAssignmentStatus'
import {
  tourChoiceCountsDisplayKeys,
  type TourChoiceCounts,
} from '@/lib/tourChoiceCounts'

type ScheduleTourHoverTooltipContentProps = {
  productName: string
  tourDate?: string | null
  isPrivateTour?: boolean
  assignedPeople: number
  guideName: string
  assistantName: string
  vehicleNumber: string
  assignmentStatus: string
  locale?: string
  assignedKo: number
  assignedEn: number
  assignedJa?: number
  choiceCounts?: TourChoiceCounts | null
}

function isPresentName(value: string | null | undefined): value is string {
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
  assignmentStatus,
  locale = 'ko',
  assignedKo,
  assignedEn,
  assignedJa = 0,
  choiceCounts,
}: ScheduleTourHoverTooltipContentProps) {
  const staffNames = [guideName, assistantName].filter(isPresentName)
  const vehicleLabel = isPresentName(vehicleNumber) ? vehicleNumber : null
  const statusLabel = getAssignmentStatusLabel(assignmentStatus, locale)
  const choiceKeys = choiceCounts ? tourChoiceCountsDisplayKeys(choiceCounts) : []

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
  row1Tail.push(
    <span
      key="status"
      className={`inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium leading-4 whitespace-nowrap ${getAssignmentStatusBadgeColor(assignmentStatus)}`}
    >
      {statusLabel}
    </span>,
  )

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
    </div>
  )
}
