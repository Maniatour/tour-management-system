'use client'

import { useMemo } from 'react'
import type { DragEvent } from 'react'
import dayjs from 'dayjs'
import type {
  ScheduleGuideDayTotal,
  ScheduleGuideScheduleRow,
  ScheduleGuideVsProductMismatch,
  ScheduleGuideVehicleColors,
  ScheduleMonthDayCell,
} from '@/lib/scheduleGuideGridTypes'
import { useScheduleGridWindowVirtualizer } from '@/hooks/useScheduleGridWindowVirtualizer'
import ScheduleGuideGridRow from '@/components/schedule/ScheduleGuideGridRow'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tour = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reservation = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Product = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Team = any

type PendingOffChange = {
  team_email: string
  off_date: string
  reason: string
  status: string
  action: 'approve' | 'delete' | 'reject'
}

export type ScheduleGuideGridProps = {
  locale: string
  monthDays: ScheduleMonthDayCell[]
  dayColumnWidthCalc: string
  dynamicMinTableWidthPx: number
  isToday: (dateString: string) => boolean
  guideTotals: Record<string, ScheduleGuideDayTotal>
  guideVsProductDailyTotalMismatch: ScheduleGuideVsProductMismatch
  guideScheduleData: Record<string, ScheduleGuideScheduleRow>
  selectedTeamMembers: string[]
  cdlDriverEmailSet: Set<string>
  cdlKoreanDriverEmailSet: Set<string>
  scheduleGridLastDay: dayjs.Dayjs
  firstDayOfMonth: dayjs.Dayjs
  currentDate: Date
  tours: Tour[]
  reservations: Reservation[]
  teamMembers: Team[]
  productColors: Record<string, string>
  defaultPresetIds: string[]
  products: Product[]
  airportPickupMemberIdSet: Set<string>
  airportSendingMemberIdSet: Set<string>
  getMultiDayTourDays: (productId: string) => number
  scheduleInteractionDragging: boolean
  hoveredGuideRow: string | null
  setHoveredGuideRow: (id: string | null) => void
  moveTeamMember: (fromIndex: number, toIndex: number) => void | Promise<void>
  canEditTeamFromSchedule: boolean
  openTeamEditFromSchedule: (teamMemberId: string) => void
  isOffDate: (teamMemberId: string, dateString: string) => boolean
  dateNotes: Record<string, { note: string; created_by?: string }>
  highlightedDate: string | null
  pendingOffScheduleChanges: Record<string, PendingOffChange>
  offSchedules: Array<{ team_email: string; off_date: string; reason: string; status: string }>
  offScheduleAssignmentCellClass: (status: string | undefined) => string
  openOffScheduleActionModal: (
    offSchedule: { team_email: string; off_date: string; reason: string; status: string } | null,
    teamMemberId?: string,
    dateString?: string,
  ) => void
  handleCreateOffSchedule: (teamMemberId: string, dateString: string) => void | Promise<void>
  draggedTour: Tour | null
  draggedUnassignedTour: Tour | null
  monthVehiclesWithColors: ScheduleGuideVehicleColors
  getColorFromClass: (colorClass: string | undefined) => string
  getBorderColorValue: (borderColorClass: string) => string
  getTourBorderColor: (
    tourId: string,
    dateString: string,
    productId: string,
    guideId: string,
  ) => string
  setDraggedRole: (role: 'guide' | 'assistant' | null) => void
  handleDrop: (
    e: DragEvent,
    teamMemberId: string,
    dateString: string,
    role: 'guide' | 'assistant',
  ) => void | Promise<void>
  handleGuideScheduleDropZoneDragOver: (e: DragEvent) => void
  handleGuideScheduleDropZoneDragLeave: (e: DragEvent) => void
  handleGuideCellDrop: (
    e: DragEvent,
    teamMemberId: string,
    dateString: string,
    role: 'guide' | 'assistant',
  ) => void | Promise<void>
  handleDragStart: (e: DragEvent, tour: Tour) => void
  handleAssignedTourDragEnd: () => void
  openTourDetailModal: (tourId: string) => void
  showGuideModalContent: (title: string, content: string, tourId?: string) => void
  getTourSummary: (tour: Tour) => string
  getGuideScheduleTourHoverText: (tour: Tour) => string
}

export default function ScheduleGuideGrid(props: ScheduleGuideGridProps) {
  const {
    locale,
    monthDays,
    dayColumnWidthCalc,
    dynamicMinTableWidthPx,
    isToday,
    guideTotals,
    guideVsProductDailyTotalMismatch,
    guideScheduleData,
    selectedTeamMembers,
    cdlDriverEmailSet,
    cdlKoreanDriverEmailSet,
    scheduleGridLastDay,
    firstDayOfMonth,
    currentDate,
    tours,
    reservations,
    teamMembers,
    productColors,
    defaultPresetIds,
    products,
    airportPickupMemberIdSet,
    airportSendingMemberIdSet,
    getMultiDayTourDays,
    scheduleInteractionDragging,
    hoveredGuideRow,
    setHoveredGuideRow,
    moveTeamMember,
    canEditTeamFromSchedule,
    openTeamEditFromSchedule,
    isOffDate,
    dateNotes,
    highlightedDate,
    pendingOffScheduleChanges,
    offSchedules,
    offScheduleAssignmentCellClass,
    openOffScheduleActionModal,
    handleCreateOffSchedule,
    draggedTour,
    draggedUnassignedTour,
    monthVehiclesWithColors,
    getColorFromClass,
    getBorderColorValue,
    getTourBorderColor,
    setDraggedRole,
    handleDrop,
    handleGuideScheduleDropZoneDragOver,
    handleGuideScheduleDropZoneDragLeave,
    handleGuideCellDrop,
    handleDragStart,
    handleAssignedTourDragEnd,
    openTourDetailModal,
    showGuideModalContent,
    getTourSummary,
    getGuideScheduleTourHoverText,
  } = props


  const guideRows = useMemo(
    () => Object.entries(guideScheduleData),
    [guideScheduleData],
  )
  const guideGridColSpan = monthDays.length + 2
  const {
    anchorRef: guideRowsAnchorRef,
    active: virtualizeGuideRows,
    virtualizer: guideRowVirtualizer,
    virtualItems: virtualGuideRows,
    totalSize: virtualGuideRowsTotalSize,
  } = useScheduleGridWindowVirtualizer({
    enabled: true,
    count: guideRows.length,
  })

  const sharedRowProps = {
    locale,
    monthDays,
    dayColumnWidthCalc,
    isToday,
    selectedTeamMembers,
    cdlDriverEmailSet,
    cdlKoreanDriverEmailSet,
    scheduleGridLastDay,
    firstDayOfMonth,
    currentDate,
    tours,
    reservations,
    teamMembers,
    productColors,
    defaultPresetIds,
    products,
    airportPickupMemberIdSet,
    airportSendingMemberIdSet,
    getMultiDayTourDays,
    scheduleInteractionDragging,
    hoveredGuideRow,
    setHoveredGuideRow,
    moveTeamMember,
    canEditTeamFromSchedule,
    openTeamEditFromSchedule,
    isOffDate,
    dateNotes,
    highlightedDate,
    pendingOffScheduleChanges,
    offSchedules,
    offScheduleAssignmentCellClass,
    openOffScheduleActionModal,
    handleCreateOffSchedule,
    draggedTour,
    draggedUnassignedTour,
    monthVehiclesWithColors,
    getColorFromClass,
    getBorderColorValue,
    getTourBorderColor,
    setDraggedRole,
    handleDrop,
    handleGuideScheduleDropZoneDragOver,
    handleGuideScheduleDropZoneDragLeave,
    handleGuideCellDrop,
    handleDragStart,
    handleAssignedTourDragEnd,
    openTourDetailModal,
    showGuideModalContent,
    getTourSummary,
    getGuideScheduleTourHoverText,
    useContentVisibility: !virtualizeGuideRows,
  }

  const renderGuideRows = () => {
    if (virtualizeGuideRows && virtualGuideRows && virtualGuideRows.length > 0) {
      const paddingTop = virtualGuideRows[0]?.start ?? 0
      const paddingBottom =
        virtualGuideRowsTotalSize - (virtualGuideRows[virtualGuideRows.length - 1]?.end ?? 0)

      return (
        <>
          {paddingTop > 0 && (
            <tr aria-hidden>
              <td
                colSpan={guideGridColSpan}
                style={{ height: paddingTop, padding: 0, border: 'none', lineHeight: 0 }}
              />
            </tr>
          )}
          {virtualGuideRows.map((virtualRow) => {
            const entry = guideRows[virtualRow.index]
            if (!entry) return null
            const [teamMemberId, guide] = entry
            return (
              <ScheduleGuideGridRow
                key={teamMemberId}
                teamMemberId={teamMemberId}
                guide={guide}
                index={virtualRow.index}
                {...sharedRowProps}
                rowProps={{
                  'data-index': virtualRow.index,
                  ref: guideRowVirtualizer.measureElement,
                }}
              />
            )
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td
                colSpan={guideGridColSpan}
                style={{ height: paddingBottom, padding: 0, border: 'none', lineHeight: 0 }}
              />
            </tr>
          )}
        </>
      )
    }

    return guideRows.map(([teamMemberId, guide], index) => (
      <ScheduleGuideGridRow
        key={teamMemberId}
        teamMemberId={teamMemberId}
        guide={guide}
        index={index}
        {...sharedRowProps}
      />
    ))
  }

  return (
    <>
          {/* 가이드별 스케줄 테이블 */}
          <div>
            <div className="overflow-visible">
          <table className="w-full" style={{tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px`}}>
            <thead className="bg-green-50 hidden">
              <tr>
                <th className="px-2 py-0.5 text-left text-xs font-medium text-gray-700" style={{width: '96px', minWidth: '96px', maxWidth: '96px'}}>
                  가이드명
                </th>
                {monthDays.map(({ date, dayOfWeek, dateString, isEdgePadding }) => (
                  <th 
                    key={dateString} 
                    className="p-0 text-center text-xs font-medium text-gray-700"
                    style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                  >
                    <div className={`${isToday(dateString) ? 'border-l-2 border-r-2 border-red-500 bg-red-50' : ''} ${isEdgePadding ? 'bg-slate-100/80' : ''} px-1 py-0.5`}>
                      <div className={isToday(dateString) ? 'font-bold text-red-700' : isEdgePadding ? 'text-slate-700' : ''}>
                        {isEdgePadding ? dayjs(dateString).format('M/D') : `${date}일`}
                      </div>
                      <div className={`text-xs ${isToday(dateString) ? 'text-red-600' : 'text-gray-500'}`}>{dayOfWeek}</div>
                    </div>
                  </th>
                ))}
                <th className="px-2 py-0.5 text-center text-xs font-medium text-gray-700" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  합계
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* 가이드별 총계 행 */}
              <tr className="bg-green-100 font-semibold">
                <td className="px-1 py-0 text-xs text-gray-900 sticky left-0 z-40 bg-green-100 border-r border-gray-300 shadow-[1px_0_0_0_rgb(209,213,219)]" style={{width: '96px', minWidth: '96px', maxWidth: '96px'}}>
                  일별 합계
                </td>
                {monthDays.map(({ dateString }) => {
                  const dayTotal = guideTotals[dateString]
                  const isMismatch = guideVsProductDailyTotalMismatch.byDate[dateString]
                  const todayBorderClass = isToday(dateString) ? 'border-l-2 border-r-2 border-red-500' : ''
                  const cellWrapClass = isMismatch
                    ? `bg-red-600 text-yellow-300 animate-schedule-health-cell-blink font-bold ${todayBorderClass}`
                    : isToday(dateString)
                      ? `bg-red-50 ${todayBorderClass}`
                      : ''
                  const valueClass = isMismatch
                    ? ''
                    : `font-medium ${
                        dayTotal.assignedPeople === 0
                          ? 'text-gray-300'
                          : dayTotal.assignedPeople < 4
                            ? 'text-primary'
                            : 'text-red-600'
                      } ${isToday(dateString) ? 'text-red-700' : ''}`
                  return (
                    <td
                      key={dateString}
                      className="px-0 py-0 text-center text-xs"
                      style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                    >
                      <div className={`px-1 py-0.5 ${cellWrapClass} ${valueClass}`}>
                        {dayTotal.assignedPeople}
                      </div>
                    </td>
                  )
                })}
                <td className="px-1 py-0 text-center text-xs font-medium" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  <div
                    className={
                      guideVsProductDailyTotalMismatch.month
                        ? 'bg-red-600 text-yellow-300 animate-schedule-health-cell-blink font-bold rounded px-1'
                        : ''
                    }
                  >
                    {Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalAssignedPeople, 0)} ({Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalTours, 0)}일)
                  </div>
                </td>
              </tr>

              {/* 각 가이드별 데이터 */}
            </tbody>
            <tbody ref={guideRowsAnchorRef} className="divide-y divide-gray-200">
              {renderGuideRows()}
            </tbody>
          </table>
            </div>
          </div>
    </>
  )
}
