'use client'

import GuideAssignmentStatusStripe from '@/components/schedule/GuideAssignmentStatusIcon'
import ScheduleHoverTooltip from '@/components/schedule/ScheduleHoverTooltip'
import {
  getAssignmentStatusLabel,
  resolveTourDisplayAssignmentStatus,
} from '@/lib/guideAssignmentStatus'
import { getScheduleProductDisplayProps } from '@/lib/scheduleProductColorPresets'
import type { ScheduleProductRef } from '@/lib/scheduleAirportPickDropGroup'
import {
  computeTourAssignedPeopleForGuideCell,
  getGuideTourProductColorClass,
} from '@/lib/scheduleGuideTourCell'
import { normalizeTourDateKey } from '@/utils/tourUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tour = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reservation = any

type GuideScheduleAssignedTourBoxesProps = {
  roleTours: Tour[]
  allTours: Tour[]
  dateString: string
  teamMemberId: string
  role: 'guide' | 'assistant'
  locale: string
  reservations: Reservation[]
  productColors: Record<string, string>
  products: ScheduleProductRef[]
  defaultPresetIds: readonly string[]
  airportPickupMemberIdSet: Set<string>
  airportSendingMemberIdSet: Set<string>
  teamMembers: { email: string; nick_name?: string | null; name_ko?: string | null }[]
  fallbackGuideInitials?: string | null | undefined
  extendsToNextMonth?: boolean | undefined
  isToday: (date: string) => boolean
  getColorFromClass: (colorClass: string) => string
  getBorderColorValue: (borderColorClass: string) => string
  getTourBorderColor: (
    tourId: string,
    dateString: string,
    productId: string,
    guideId: string,
  ) => string
  setDraggedRole: (role: 'guide' | 'assistant') => void
  handleDragStart: (e: React.DragEvent, tour: Tour) => void
  handleAssignedTourDragEnd: () => void
  openTourDetailModal: (tourId: string) => void
  showGuideModalContent: (title: string, content: string, tourId?: string) => void
  getTourSummary: (tour: Tour) => string
  getGuideScheduleTourHoverText: (tour: Tour) => string
  tooltipFallback: string
}

function tourMatchesScheduleDate(tour: Tour, dateString: string): boolean {
  return normalizeTourDateKey(tour.tour_date) === dateString
}

function getAssistantGuideInitials(
  tour: Tour,
  teamMembers: GuideScheduleAssignedTourBoxesProps['teamMembers'],
): string {
  const guideId = tour.tour_guide_id
  if (!guideId) return 'A'
  const guideInfo = teamMembers.find((member) => member.email === guideId)
  if (!guideInfo) return 'A'
  const name = guideInfo.nick_name || guideInfo.name_ko || ''
  return name
    .split('')
    .map((ch: string) => ch.charAt(0))
    .join('')
    .substring(0, 2) || 'A'
}

function resolveTourBorderColor(
  tour: Tour,
  dateString: string,
  allTours: Tour[],
  getTourBorderColor: GuideScheduleAssignedTourBoxesProps['getTourBorderColor'],
  guideIdForBorder: string,
): string {
  if (!tour.product_id || !tour.id) return ''
  const sameDateProductTours = allTours.filter(
    (t) =>
      tourMatchesScheduleDate(t, dateString) &&
      t.product_id === tour.product_id &&
      t.tour_guide_id,
  )
  const uniqueGuides = new Set(sameDateProductTours.map((t) => t.tour_guide_id).filter(Boolean))
  if (uniqueGuides.size <= 1) return ''
  return getTourBorderColor(tour.id, dateString, tour.product_id, guideIdForBorder)
}

export default function GuideScheduleAssignedTourBoxes({
  roleTours,
  allTours,
  dateString,
  teamMemberId,
  role,
  locale,
  reservations,
  productColors,
  products,
  defaultPresetIds,
  airportPickupMemberIdSet,
  airportSendingMemberIdSet,
  teamMembers,
  fallbackGuideInitials,
  extendsToNextMonth,
  isToday,
  getColorFromClass,
  getBorderColorValue,
  getTourBorderColor,
  setDraggedRole,
  handleDragStart,
  handleAssignedTourDragEnd,
  openTourDetailModal,
  showGuideModalContent,
  getTourSummary,
  getGuideScheduleTourHoverText,
  tooltipFallback,
}: GuideScheduleAssignedTourBoxesProps) {
  const getProductDisplayProps = getScheduleProductDisplayProps

  if (roleTours.length === 0) return null

  const containerClass =
    roleTours.length > 1
      ? 'absolute inset-0 z-10 flex overflow-hidden rounded'
      : 'absolute inset-0 z-10 rounded'

  return (
    <div className={containerClass}>
      {roleTours.map((tour) => {
        const colorClass = getGuideTourProductColorClass(
          tour,
          productColors,
          products,
          defaultPresetIds,
          airportPickupMemberIdSet,
          airportSendingMemberIdSet,
        )
        const assignedPeople = computeTourAssignedPeopleForGuideCell(tour, reservations)
        const hasPrivateTour = tour.is_private_tour === 'TRUE' || tour.is_private_tour === true
        const guideIdForBorder =
          role === 'guide' ? teamMemberId : String(tour.tour_guide_id || '').trim()
        const borderColor = resolveTourBorderColor(
          tour,
          dateString,
          allTours,
          getTourBorderColor,
          guideIdForBorder,
        )
        const displayText =
          role === 'guide'
            ? assignedPeople
            : getAssistantGuideInitials(tour, teamMembers) || fallbackGuideInitials || 'A'
        const displayAssignmentStatus = resolveTourDisplayAssignmentStatus(tour)
        const statusLabel = getAssignmentStatusLabel(displayAssignmentStatus, locale)
        const textColor =
          assignedPeople > 0 && colorClass
            ? getProductDisplayProps(colorClass).style?.color
            : undefined

        return (
          <ScheduleHoverTooltip
            key={tour.id}
            content={getGuideScheduleTourHoverText(tour) || tooltipFallback}
          >
            <div
              className={`relative flex min-w-0 flex-1 items-center justify-center gap-0.5 px-0.5 py-0 text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${
                assignedPeople === 0 && role === 'guide' ? 'bg-gray-400 text-white' : 'text-white'
              } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''} ${borderColor ? 'border-2 border-white' : ''} ${roleTours.length === 1 ? 'h-full w-full rounded' : 'h-full'}`}
              style={{
                backgroundColor:
                  assignedPeople > 0 && colorClass ? getColorFromClass(colorClass) : undefined,
                color: textColor,
                boxShadow: borderColor ? `0 0 0 2px ${getBorderColorValue(borderColor)}` : undefined,
              }}
              draggable
              onDragStart={(e) => {
                setDraggedRole(role)
                handleDragStart(e, tour)
              }}
              onDragEnd={handleAssignedTourDragEnd}
              onDoubleClick={() => openTourDetailModal(tour.id)}
              onClick={() =>
                showGuideModalContent('투어 상세 정보', getTourSummary(tour), tour.id)
              }
            >
              {hasPrivateTour ? <span className="text-[9px]">🔒</span> : null}
              <GuideAssignmentStatusStripe
                status={displayAssignmentStatus}
                title={statusLabel}
              />
              <span className="relative z-10 tabular-nums text-[10px] font-semibold leading-none">
                {displayText}
              </span>
              {extendsToNextMonth && roleTours.length === 1 ? (
                <span className="text-xs opacity-75">→</span>
              ) : null}
            </div>
          </ScheduleHoverTooltip>
        )
      })}
    </div>
  )
}
