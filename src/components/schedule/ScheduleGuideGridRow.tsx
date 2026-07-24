'use client'

import dayjs from 'dayjs'
import { ChevronUp, ChevronDown } from 'lucide-react'
import {
  getScheduleColorRowKeyForProductId,
  getScheduleProductColorForProductId,
} from '@/lib/scheduleAirportPickDropGroup'
import { getScheduleProductDisplayProps } from '@/lib/scheduleProductColorPresets'
import type {
  ScheduleGuideDailyData,
  ScheduleGuideScheduleRow,
} from '@/lib/scheduleGuideGridTypes'
import { normalizeTourDateKey } from '@/utils/tourUtils'
import ScheduleHoverTooltip from '@/components/schedule/ScheduleHoverTooltip'
import type { ScheduleGuideGridProps } from '@/components/schedule/ScheduleGuideGrid'

function tourMatchesScheduleDate(tour: Tour, dateString: string): boolean {
  return normalizeTourDateKey(tour.tour_date) === dateString
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tour = any

export type ScheduleGuideGridRowProps = Pick<
  ScheduleGuideGridProps,
  | 'locale'
  | 'monthDays'
  | 'dayColumnWidthCalc'
  | 'isToday'
  | 'selectedTeamMembers'
  | 'cdlDriverEmailSet'
  | 'cdlKoreanDriverEmailSet'
  | 'scheduleGridLastDay'
  | 'firstDayOfMonth'
  | 'currentDate'
  | 'tours'
  | 'reservations'
  | 'teamMembers'
  | 'productColors'
  | 'defaultPresetIds'
  | 'products'
  | 'airportPickupMemberIdSet'
  | 'airportSendingMemberIdSet'
  | 'getMultiDayTourDays'
  | 'scheduleInteractionDragging'
  | 'hoveredGuideRow'
  | 'setHoveredGuideRow'
  | 'moveTeamMember'
  | 'canEditTeamFromSchedule'
  | 'openTeamEditFromSchedule'
  | 'isOffDate'
  | 'dateNotes'
  | 'highlightedDate'
  | 'pendingOffScheduleChanges'
  | 'offSchedules'
  | 'offScheduleAssignmentCellClass'
  | 'openOffScheduleActionModal'
  | 'handleCreateOffSchedule'
  | 'draggedTour'
  | 'draggedUnassignedTour'
  | 'monthVehiclesWithColors'
  | 'getColorFromClass'
  | 'getBorderColorValue'
  | 'getTourBorderColor'
  | 'setDraggedRole'
  | 'handleDrop'
  | 'handleGuideScheduleDropZoneDragOver'
  | 'handleGuideScheduleDropZoneDragLeave'
  | 'handleGuideCellDrop'
  | 'handleDragStart'
  | 'handleAssignedTourDragEnd'
  | 'openTourDetailModal'
  | 'showGuideModalContent'
  | 'getTourSummary'
  | 'getGuideScheduleTourHoverText'
> & {
  teamMemberId: string
  guide: ScheduleGuideScheduleRow
  index: number
  useContentVisibility: boolean
  rowProps?: {
    'data-index'?: number
    ref?: (node: HTMLTableRowElement | null) => void
  }
}

export default function ScheduleGuideGridRow(props: ScheduleGuideGridRowProps) {
  const {
    teamMemberId,
    guide,
    index: _index,
    useContentVisibility,
    rowProps,
    locale,
    monthDays,
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
    isToday,
  } = props
  const getProductDisplayProps = getScheduleProductDisplayProps


  const selectedIndex = selectedTeamMembers.indexOf(teamMemberId)
  const canMoveUp = selectedIndex > 0
  const canMoveDown = selectedIndex >= 0 && selectedIndex < selectedTeamMembers.length - 1
  const isCdlDriver = cdlDriverEmailSet.has(teamMemberId)
  const isCdlKoreanDriver = cdlKoreanDriverEmailSet.has(teamMemberId)
  // 멀티데이 투어 정보를 미리 계산
  const multiDayTours: { [dateString: string]: { startDate: string; endDate: string; days: number; extendsToNextMonth: boolean; dayData: ScheduleGuideDailyData } } = {}
  
  monthDays.forEach(({ dateString }) => {
    const dayData = guide.dailyData[dateString]
    if (dayData?.isMultiDay && dayData.multiDayDays >= 1) {
      const start = dayjs(dateString)
      const end = start.add(dayData.multiDayDays - 1, 'day')
      const extendsToNextMonth = end.isAfter(scheduleGridLastDay, 'day')
      
      multiDayTours[dateString] = {
        startDate: dateString,
        endDate: end.format('YYYY-MM-DD'),
        days: dayData.multiDayDays,
        extendsToNextMonth,
        dayData
      }
    }
  })

  // 이전 달 말일에 시작하여 이번 달로 이어지는 멀티데이 투어 포함 (최대 3박4일 → 3일 이전까지 조회)
  const windowStart = dayjs(firstDayOfMonth).subtract(3, 'day')
  tours.filter(t => t.tour_guide_id === teamMemberId || t.assistant_id === teamMemberId).forEach(tour => {
    const mdays = getMultiDayTourDays(tour.product_id)
    if (mdays <= 1) return
    const start = dayjs(normalizeTourDateKey(tour.tour_date))
    if (start.isBefore(firstDayOfMonth, 'day') && !start.isBefore(windowStart, 'day')) {
      const end = start.add(mdays - 1, 'day')
      // 이번 달에 걸쳐 있는 경우만 추가
      if (!end.isBefore(firstDayOfMonth, 'day')) {
        const tourDateKey = normalizeTourDateKey(tour.tour_date)
        // 역할/인원/색상 계산 (Recruiting/Confirmed 상태만)
        const dayReservations = reservations.filter(res => 
          normalizeTourDateKey(res.tour_date) === tourDateKey &&
          (res.status?.toLowerCase() === 'confirmed' || res.status?.toLowerCase() === 'recruiting')
        )
        const assignedPeople = (() => {
          if (!tour.reservation_ids || !Array.isArray(tour.reservation_ids)) return 0
          const assigned = dayReservations.filter(res => tour.reservation_ids.includes(res.id))
          return assigned.reduce((s, r) => s + (r.total_people || 0), 0)
        })()
        const role = tour.tour_guide_id === teamMemberId ? 'guide' : tour.assistant_id === teamMemberId ? 'assistant' : null
        let guideInitials = null as string | null
        if (role === 'assistant' && tour.tour_guide_id) {
          const guideInfo = teamMembers.find(member => member.email === tour.tour_guide_id)
          if (guideInfo) {
            const gInfoName = (guideInfo as any).nick_name || guideInfo.name_ko
            guideInitials = gInfoName.split('').map((ch: string) => ch.charAt(0)).join('').substring(0, 2)
          }
        }
        const extendsToNextMonth = end.isAfter(scheduleGridLastDay, 'day')
        const startKey = start.format('YYYY-MM-DD')
        if (!multiDayTours[startKey]) {
          multiDayTours[startKey] = {
            startDate: startKey,
            endDate: end.format('YYYY-MM-DD'),
            days: mdays,
            extendsToNextMonth,
            dayData: {
              totalPeople: 0,
              assignedPeople,
              tours: 1,
              productColors: {
                [getScheduleColorRowKeyForProductId(
                  tour.product_id,
                  airportPickupMemberIdSet,
                  airportSendingMemberIdSet,
                )]: getScheduleProductColorForProductId(
                  tour.product_id,
                  productColors,
                  products,
                  defaultPresetIds,
                  airportPickupMemberIdSet,
                  airportSendingMemberIdSet,
                ),
              },
              role,
              guideInitials,
              isMultiDay: true,
              multiDayDays: mdays
            }
          }
          
          // 이전 달에서 시작한 멀티데이 투어의 경우 이번 달에 해당하는 일수만큼 합계에 추가
          const daysInCurrentMonth = Math.min(
            mdays,
            dayjs(currentDate).endOf('month').diff(firstDayOfMonth, 'day') + 1
          )
          if (daysInCurrentMonth > 0) {
          // 이전 달에서 시작한 투어는 totalPeople이 0이므로 assignedPeople만 계산
          // totalAssignedPeople += assignedPeople * daysInCurrentMonth
          // totalTours += daysInCurrentMonth
          }
        }
      }
    }
  })
  
  const isGuideDayOff = (dateString: string) => {
    if (!isOffDate(teamMemberId, dateString)) return false
    const teamMember = teamMembers.find((member) => member.email === teamMemberId)
    const key = `${teamMember?.email}_${dateString}`
    const pendingChange = pendingOffScheduleChanges[key]
    return pendingChange?.action !== 'delete'
  }

  const getGuideScheduleCellBgClass = (dateString: string, hasAssignment: boolean) => {
    if (isToday(dateString)) {
      return 'border-l-2 border-r-2 border-red-500 bg-red-50'
    }
    if (dateNotes[dateString]?.note) return 'bg-yellow-100'
    if (highlightedDate === dateString) return 'bg-yellow-200'
    if (isCdlKoreanDriver && !hasAssignment && !isGuideDayOff(dateString)) {
      return 'bg-yellow-100'
    }
    if (isCdlDriver && !hasAssignment && !isGuideDayOff(dateString)) {
      return 'bg-sky-100'
    }
    return 'bg-white'
  }

  return (
    <tr
      {...rowProps}
      className="group hover:bg-gray-50 transition-colors"
      style={
        useContentVisibility
          ? { contentVisibility: 'auto', containIntrinsicSize: '0 28px' }
          : undefined
      }
      onMouseEnter={() => {
        if (scheduleInteractionDragging) return
        setHoveredGuideRow(teamMemberId)
      }}
      onMouseLeave={() => {
        if (scheduleInteractionDragging) return
        setHoveredGuideRow(null)
      }}
    >
      <td 
        className="px-1 py-0 text-xs leading-tight sticky left-0 z-40 border-r border-gray-300 shadow-[1px_0_0_0_rgb(209,213,219)] bg-white group-hover:bg-gray-50"
        style={{width: '96px', minWidth: '96px', maxWidth: '96px'}}
      >
        <div className={`font-medium flex items-center gap-0.5 ${
          hoveredGuideRow === teamMemberId 
            ? 'text-primary animate-pulse' 
            : 'text-gray-900'
        }`}>
          <div className="flex flex-col items-center -my-0.5">
            <button
              type="button"
              draggable={false}
              onClick={(e) => {
                e.stopPropagation()
                if (canMoveUp) void moveTeamMember(selectedIndex, selectedIndex - 1)
              }}
              disabled={!canMoveUp}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
              title="위로 이동"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              draggable={false}
              onClick={(e) => {
                e.stopPropagation()
                if (canMoveDown) void moveTeamMember(selectedIndex, selectedIndex + 1)
              }}
              disabled={!canMoveDown}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
              title="아래로 이동"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <ScheduleHoverTooltip
            content={
              canEditTeamFromSchedule
                ? locale === 'ko'
                  ? '클릭하여 팀원 정보 수정'
                  : 'Click to edit team member'
                : guide.team_member_name
            }
          >
            <button
              type="button"
              className={`min-w-0 flex-1 truncate text-left ${
                canEditTeamFromSchedule
                  ? 'cursor-pointer hover:text-primary hover:underline'
                  : ''
              }`}
              onClick={(e) => {
                e.stopPropagation()
                openTeamEditFromSchedule(teamMemberId)
              }}
            >
              {guide.team_member_name}
            </button>
          </ScheduleHoverTooltip>
        </div>
      </td>
      <td className="p-0" colSpan={monthDays.length}>
        <div className="relative">
          <div className="grid" style={{gridTemplateColumns: `repeat(${monthDays.length}, minmax(40px, 1fr))`, width: '100%', minWidth: `calc(${monthDays.length} * 40px)`}}>
            {monthDays.map(({ dateString }) => {
            const dayData = guide.dailyData[dateString]
            
            // 멀티데이 투어의 연속된 날짜인지 확인하고 해당 투어 정보 가져오기
            let continuationTour = null
            for (const tour of Object.values(multiDayTours)) {
              const tourStart = dayjs(tour.startDate)
              const tourEnd = dayjs(tour.endDate)
              const cur = dayjs(dateString)
              if (cur.isAfter(tourStart, 'day') && (cur.isSame(tourEnd, 'day') || cur.isBefore(tourEnd, 'day'))) {
                continuationTour = tour
                break
              }
            }
            
            // 멀티데이 투어의 연속된 날짜인 경우: 셀 내용은 비워두고(드롭존만 유지), 상단 오버레이에서 하나의 박스로 표시
            if (continuationTour && !dayData) {
              return (
                <div 
                  key={dateString} 
                  className={`px-1 py-0 text-center text-xs relative ${getGuideScheduleCellBgClass(dateString, true)}`}
                  style={{ minWidth: '40px', boxSizing: 'border-box' }}
                >
                  <div
                    className="relative h-[22px]"
                    style={{ pointerEvents: 'auto' }}
                    onDragOver={(e) => { 
                      if (draggedTour && tourMatchesScheduleDate(draggedTour, dateString)) {
                        handleGuideScheduleDropZoneDragOver(e)
                      } else if (draggedUnassignedTour) {
                        handleGuideScheduleDropZoneDragOver(e)
                      }
                    }}
                    onDragLeave={handleGuideScheduleDropZoneDragLeave}
                  onDrop={(e) => {
                    try {
                      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'))
                      
                      if (draggedUnassignedTour) {
                        // 미 배정 투어 배정
                        const role = dragData.role || 'guide'
                        handleGuideCellDrop(e, teamMemberId, dateString, role)
                      } else {
                        // 기존 투어 재배정
                        handleDrop(e, teamMemberId, dateString, 'guide')
                      }
                    } catch {
                      if (draggedUnassignedTour) {
                        handleGuideCellDrop(e, teamMemberId, dateString, 'guide')
                      } else {
                        handleDrop(e, teamMemberId, dateString, 'guide')
                      }
                    }
                  }}
                  >
                    {/* Off 날짜 표시 */}
                    {isOffDate(teamMemberId, dateString) && !(() => {
                      const teamMember = teamMembers.find(member => member.email === teamMemberId)
                      const key = `${teamMember?.email}_${dateString}`
                      const pendingChange = pendingOffScheduleChanges[key]
                      return pendingChange?.action === 'delete'
                    })() ? (
                      (() => {
                        const teamMember = teamMembers.find(member => member.email === teamMemberId)
                        const offSchedule = teamMember ? offSchedules.find(off => 
                          off.team_email === teamMember.email && off.off_date === dateString
                        ) : null
                        
                        return (
                          <ScheduleHoverTooltip
                            content={
                              offSchedule
                                ? `${offSchedule.reason || ''} (${offSchedule.status})`
                                : guide.team_member_name
                            }
                          >
                          <div 
                            className={offScheduleAssignmentCellClass(offSchedule?.status)}
                            onClick={() => {
                              if (offSchedule) {
                                openOffScheduleActionModal(offSchedule)
                              }
                            }}
                            >
                              OFF
                            </div>
                          </ScheduleHoverTooltip>
                        )
                      })()
                    ) : (
                      /* 이어지는 날짜는 오버레이에서 하나의 박스로 렌더링 */
                      <div></div>
                    )}
                  </div>
                </div>
              )
            }
            
            // 일반 셀 렌더링 (1일 투어 또는 멀티데이 투어 시작일)
            return (
              <div 
                key={dateString} 
                className={`px-1 py-0 text-center text-xs relative ${getGuideScheduleCellBgClass(dateString, Boolean(dayData))}`}
                style={{ minWidth: '40px', boxSizing: 'border-box' }}
              >
                <div
                  className="relative h-[22px]"
                  style={{ 
                    pointerEvents: 'auto',
                    overflow: 'visible',
                    position: 'relative'
                  }}
                  onDragOver={(e) => { 
                    if (draggedTour && tourMatchesScheduleDate(draggedTour, dateString)) {
                      handleGuideScheduleDropZoneDragOver(e)
                    } else if (draggedUnassignedTour) {
                      handleGuideScheduleDropZoneDragOver(e)
                    }
                  }}
                  onDragLeave={handleGuideScheduleDropZoneDragLeave}
                  onDrop={(e) => {
                    try {
                      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'))
                      
                      if (draggedUnassignedTour) {
                        // 미 배정 투어 배정
                        const role = dragData.role || 'guide'
                        handleGuideCellDrop(e, teamMemberId, dateString, role)
                      } else {
                        // 기존 투어 재배정
                        handleDrop(e, teamMemberId, dateString, 'guide')
                      }
                    } catch {
                      if (draggedUnassignedTour) {
                        handleGuideCellDrop(e, teamMemberId, dateString, 'guide')
                      } else {
                        handleDrop(e, teamMemberId, dateString, 'guide')
                      }
                    }
                  }}
                >
                  {dayData ? (
                    <div className="relative h-full">
                      {/* 상품별 배경색 표시 (텍스트 아래) - 멀티데이 시작일은 오버레이에서만 표시 */}
                      {Object.keys(dayData.productColors).length > 0 && !dayData.isMultiDay && (
                        <div className="absolute inset-0 pointer-events-none rounded" 
                             style={{
                               background: Object.values(dayData.productColors).length === 1 
                                 ? `linear-gradient(135deg, ${getColorFromClass(Object.values(dayData.productColors)[0])} 0%, ${getColorFromClass(Object.values(dayData.productColors)[0])} 100%)`
                                 : `linear-gradient(135deg, ${Object.values(dayData.productColors).map(color => getColorFromClass(color)).join(', ')})`
                             }}>
                        </div>
                      )}
                      
                      {/* 가이드로 배정된 경우 - 인원 표시 */}
                      {dayData.role === 'guide' && !dayData.isMultiDay && (() => {
                        // 해당 날짜의 가이드 투어들 중 단독투어 여부 확인
                        const guideTours = tours.filter(tour => 
                          tourMatchesScheduleDate(tour, dateString) && 
                          String(tour.tour_guide_id || '').trim() === teamMemberId
                        )
                        const hasPrivateTour = guideTours.some(tour => 
                          tour.is_private_tour === 'TRUE' || tour.is_private_tour === true
                        )
                        
                        // 차량 배차 여부 및 배정된 차량 색상
                        const hasUnassignedVehicle = guideTours.some(t => !t.tour_car_id || String(t.tour_car_id).trim().length === 0)
                        const assignedCarId = guideTours.find(t => t.tour_car_id && String(t.tour_car_id).trim())?.tour_car_id
                        const vehicleColorClass = assignedCarId ? monthVehiclesWithColors.vehicleIdToColor.get(String(assignedCarId).trim()) : null
                        
                        // 같은 날짜에 같은 product_id의 투어가 여러 팀(가이드)으로 나가는지 확인
                        if (guideTours.length > 0 && guideTours[0].product_id && guideTours[0].id) {
                          // 같은 날짜, 같은 product_id를 가진 모든 투어 확인
                          const sameDateProductTours = tours.filter(t => 
                            tourMatchesScheduleDate(t, dateString) && 
                            t.product_id === guideTours[0].product_id &&
                            t.tour_guide_id // 가이드가 배정된 투어만
                          )
                          
                          // 같은 product_id에서 여러 가이드(팀)가 있으면 테두리 색상 적용
                          const uniqueGuides = new Set(sameDateProductTours.map(t => t.tour_guide_id).filter(Boolean))
                          const hasMultipleTeams = uniqueGuides.size > 1
                          
                          const borderColor = hasMultipleTeams
                            ? getTourBorderColor(
                                guideTours[0].id,
                                dateString,
                                guideTours[0].product_id,
                                teamMemberId
                              )
                            : ''
                          
                          return (
                            <ScheduleHoverTooltip
                              content={
                                guideTours.length > 0
                                  ? getGuideScheduleTourHoverText(guideTours[0])
                                  : guide.team_member_name
                              }
                            >
                            <div 
                              className={`absolute inset-0 flex items-center justify-center gap-1 text-white px-2 py-0 text-[10px] rounded z-10 cursor-pointer hover:opacity-80 transition-opacity ${
                                dayData.assignedPeople === 0 
                                  ? 'bg-gray-400' 
                                  : 'bg-transparent'
                              } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''} ${borderColor ? 'border-2 border-white' : ''}`}
                              style={{
                                backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                  ? getColorFromClass(Object.values(dayData.productColors)[0])
                                  : undefined,
                                color: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                  ? getProductDisplayProps(Object.values(dayData.productColors)[0]).style?.color
                                  : undefined,
                                boxShadow: borderColor ? `0 0 0 2px ${getBorderColorValue(borderColor)}` : undefined
                              }}
                              draggable
                              onDragStart={(e) => {
                                if (guideTours.length > 0) {
                                  setDraggedRole('guide')
                                  handleDragStart(e, guideTours[0])
                                }
                              }}
                              onDragEnd={handleAssignedTourDragEnd}
                              onDoubleClick={() => {
                                if (guideTours.length > 0) {
                                  openTourDetailModal(guideTours[0].id)
                                }
                              }}
                              onClick={() => {
                                if (guideTours.length > 0) {
                                  showGuideModalContent('투어 상세 정보', getTourSummary(guideTours[0]), guideTours[0].id)
                                }
                              }}
                            >
                              {hasUnassignedVehicle && (
                                <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                              )}
                              {!hasUnassignedVehicle && vehicleColorClass && (
                                <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full border border-white ${vehicleColorClass}`} />
                              )}
                              {hasPrivateTour && <span>🔒</span>}
                              <span>{dayData.assignedPeople}</span>
                              {dayData.extendsToNextMonth && (
                                <span className="text-xs opacity-75">→</span>
                              )}
                            </div>
                            </ScheduleHoverTooltip>
                          )
                        }
                        
                        // 기본 렌더링 (product_id가 없는 경우)
                        return (
                          <ScheduleHoverTooltip
                            content={
                              guideTours.length > 0
                                ? getGuideScheduleTourHoverText(guideTours[0])
                                : guide.team_member_name
                            }
                          >
                          <div 
                            className={`absolute inset-0 flex items-center justify-center gap-1 text-white px-2 py-0 text-[10px] rounded z-10 cursor-pointer hover:opacity-80 transition-opacity ${
                              dayData.assignedPeople === 0 
                                ? 'bg-gray-400' 
                                : 'bg-transparent'
                            } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''}`}
                            style={{
                              backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                ? getColorFromClass(Object.values(dayData.productColors)[0])
                                : undefined,
                              color: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                ? getProductDisplayProps(Object.values(dayData.productColors)[0]).style?.color
                                : undefined
                            }}
                            draggable
                            onDragStart={(e) => {
                              if (guideTours.length > 0) {
                                setDraggedRole('guide')
                                handleDragStart(e, guideTours[0])
                              }
                            }}
                            onDragEnd={handleAssignedTourDragEnd}
                            onDoubleClick={() => {
                              if (guideTours.length > 0) {
                                openTourDetailModal(guideTours[0].id)
                              }
                            }}
                            onClick={() => {
                              if (guideTours.length > 0) {
                                showGuideModalContent('투어 상세 정보', getTourSummary(guideTours[0]), guideTours[0].id)
                              }
                            }}
                          >
                            {hasUnassignedVehicle && (
                              <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                            )}
                            {!hasUnassignedVehicle && vehicleColorClass && (
                              <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full border border-white ${vehicleColorClass}`} />
                            )}
                            {hasPrivateTour && <span>🔒</span>}
                            <span>{dayData.assignedPeople}</span>
                            {dayData.extendsToNextMonth && (
                              <span className="text-xs opacity-75">→</span>
                            )}
                          </div>
                          </ScheduleHoverTooltip>
                        )
                      })()}
                      
                      {/* 어시스턴트로 배정된 경우 - 가이드 이름 초성 표시 */}
                      {dayData.role === 'assistant' && !dayData.isMultiDay && (() => {
                        // 해당 날짜의 어시스턴트 투어들 중 단독투어 여부 확인
                        const assistantTours = tours.filter(tour => 
                          tourMatchesScheduleDate(tour, dateString) && 
                          String(tour.assistant_id || '').trim() === teamMemberId
                        )
                        const hasPrivateTour = assistantTours.some(tour => 
                          tour.is_private_tour === 'TRUE' || tour.is_private_tour === true
                        )
                        
                        // 차량 배차 여부 및 배정된 차량 색상
                        const hasUnassignedVehicle = assistantTours.some(t => !t.tour_car_id || String(t.tour_car_id).trim().length === 0)
                        const assignedCarIdAsst = assistantTours.find(t => t.tour_car_id && String(t.tour_car_id).trim())?.tour_car_id
                        const vehicleColorClassAsst = assignedCarIdAsst ? monthVehiclesWithColors.vehicleIdToColor.get(String(assignedCarIdAsst).trim()) : null
                        
                        // 같은 날짜에 같은 product_id의 투어가 여러 팀(가이드)으로 나가는지 확인
                        if (assistantTours.length > 0 && assistantTours[0].product_id && assistantTours[0].id && assistantTours[0].tour_guide_id) {
                          // 같은 날짜, 같은 product_id를 가진 모든 투어 확인
                          const sameDateProductTours = tours.filter(t => 
                            tourMatchesScheduleDate(t, dateString) && 
                            t.product_id === assistantTours[0].product_id &&
                            t.tour_guide_id // 가이드가 배정된 투어만
                          )
                          
                          // 같은 product_id에서 여러 가이드(팀)가 있으면 테두리 색상 적용
                          const uniqueGuides = new Set(sameDateProductTours.map(t => t.tour_guide_id).filter(Boolean))
                          const hasMultipleTeams = uniqueGuides.size > 1
                          
                          const borderColor = hasMultipleTeams
                            ? getTourBorderColor(
                                assistantTours[0].id,
                                dateString,
                                assistantTours[0].product_id,
                                assistantTours[0].tour_guide_id
                              )
                            : ''
                          
                          return (
                            <ScheduleHoverTooltip
                              content={
                                assistantTours.length > 0
                                  ? getGuideScheduleTourHoverText(assistantTours[0])
                                  : guide.team_member_name
                              }
                            >
                            <div 
                              className={`absolute inset-0 flex items-center justify-center gap-1 text-white px-2 py-0 text-[10px] rounded z-10 cursor-pointer hover:opacity-80 transition-opacity ${
                                dayData.assignedPeople === 0 
                                  ? 'bg-gray-400' 
                                  : 'bg-transparent'
                              } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''} ${borderColor ? 'border-2 border-white' : ''}`}
                              style={{
                                backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                  ? getColorFromClass(Object.values(dayData.productColors)[0])
                                  : undefined,
                                color: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                  ? getProductDisplayProps(Object.values(dayData.productColors)[0]).style?.color
                                  : undefined,
                                boxShadow: borderColor ? `0 0 0 2px ${getBorderColorValue(borderColor)}` : undefined
                              }}
                            draggable
                            onDragStart={(e) => {
                              if (assistantTours.length > 0) {
                                setDraggedRole('assistant')
                                handleDragStart(e, assistantTours[0])
                              }
                            }}
                            onDragEnd={handleAssignedTourDragEnd}
                            onDoubleClick={() => {
                              if (assistantTours.length > 0) {
                                openTourDetailModal(assistantTours[0].id)
                              }
                            }}
                            onClick={() => {
                              if (assistantTours.length > 0) {
                                showGuideModalContent('투어 상세 정보', getTourSummary(assistantTours[0]), assistantTours[0].id)
                              }
                            }}
                          >
                            {hasUnassignedVehicle && (
                              <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                            )}
                            {!hasUnassignedVehicle && vehicleColorClassAsst && (
                              <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full border border-white ${vehicleColorClassAsst}`} />
                            )}
                            {hasPrivateTour && <span>🔒</span>}
                            <span>{dayData.guideInitials || 'A'}</span>
                            {dayData.extendsToNextMonth && (
                              <span className="text-xs opacity-75">→</span>
                            )}
                          </div>
                            </ScheduleHoverTooltip>
                        )
                        }
                        
                        // 기본 렌더링 (product_id가 없거나 tour_guide_id가 없는 경우)
                        return (
                          <ScheduleHoverTooltip
                            content={
                              assistantTours.length > 0
                                ? getGuideScheduleTourHoverText(assistantTours[0])
                                : guide.team_member_name
                            }
                          >
                          <div 
                            className={`absolute inset-0 flex items-center justify-center gap-1 text-white px-2 py-0 text-[10px] rounded z-10 cursor-pointer hover:opacity-80 transition-opacity ${
                              dayData.assignedPeople === 0 
                                ? 'bg-gray-400' 
                                : 'bg-transparent'
                            } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''}`}
                            style={{
                              backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                ? getColorFromClass(Object.values(dayData.productColors)[0])
                                : undefined,
                              color: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                ? getProductDisplayProps(Object.values(dayData.productColors)[0]).style?.color
                                : undefined
                            }}
                            draggable
                            onDragStart={(e) => {
                              if (assistantTours.length > 0) {
                                setDraggedRole('assistant')
                                handleDragStart(e, assistantTours[0])
                              }
                            }}
                            onDragEnd={handleAssignedTourDragEnd}
                            onDoubleClick={() => {
                              if (assistantTours.length > 0) {
                                openTourDetailModal(assistantTours[0].id)
                              }
                            }}
                            onClick={() => {
                              if (assistantTours.length > 0) {
                                showGuideModalContent('투어 상세 정보', getTourSummary(assistantTours[0]), assistantTours[0].id)
                              }
                            }}
                          >
                            {hasUnassignedVehicle && (
                              <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                            )}
                            {!hasUnassignedVehicle && vehicleColorClassAsst && (
                              <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full border border-white ${vehicleColorClassAsst}`} />
                            )}
                            {hasPrivateTour && <span>🔒</span>}
                            <span>{dayData.guideInitials || 'A'}</span>
                            {dayData.extendsToNextMonth && (
                              <span className="text-xs opacity-75">→</span>
                            )}
                          </div>
                          </ScheduleHoverTooltip>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="text-gray-300 text-center py-0 text-[10px]">
                      {/* Off 날짜 표시 */}
                      {isOffDate(teamMemberId, dateString) && !(() => {
                        const teamMember = teamMembers.find(member => member.email === teamMemberId)
                        const key = `${teamMember?.email}_${dateString}`
                        const pendingChange = pendingOffScheduleChanges[key]
                        return pendingChange?.action === 'delete'
                      })() ? (
                        (() => {
                          const teamMember = teamMembers.find(member => member.email === teamMemberId)
                          const offSchedule = teamMember ? offSchedules.find(off => 
                            off.team_email === teamMember.email && off.off_date === dateString
                          ) : null
                          
                          return (
                            <ScheduleHoverTooltip
                              content={
                                offSchedule
                                  ? `${offSchedule.reason || ''} (${offSchedule.status})`
                                  : guide.team_member_name
                              }
                            >
                            <div 
                              className={offScheduleAssignmentCellClass(offSchedule?.status)}
                              onClick={() => {
                                if (offSchedule) {
                                  openOffScheduleActionModal(offSchedule)
                                }
                              }}
                            >
                              OFF
                            </div>
                            </ScheduleHoverTooltip>
                          )
                        })()
                      ) : (
                        /* 드롭 영역 */
                        <ScheduleHoverTooltip content={guide.team_member_name}>
                        <div 
                          className={`h-full flex items-center justify-center cursor-pointer transition-colors ${
                            isCdlKoreanDriver
                              ? 'hover:bg-yellow-200'
                              : isCdlDriver
                                ? 'hover:bg-sky-200'
                                : 'hover:bg-gray-100'
                          }`}
                          onClick={() => openOffScheduleActionModal(null, teamMemberId, dateString)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            handleCreateOffSchedule(teamMemberId, dateString)
                          }}
                        >
                          <div className="text-gray-300 text-xs">+</div>
                        </div>
                        </ScheduleHoverTooltip>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
            })}
          </div>
          {Object.values(multiDayTours).map((tour, idx) => {
            const start = dayjs(tour.startDate)
            const monthStart = dayjs(firstDayOfMonth)
            // 시작일이 이번 달 이전인 경우 보이는 시작 인덱스를 0으로 클램프
            const diffFromMonthStart = start.diff(monthStart, 'day')
            // 그리드 컬럼 인덱스는 monthDays 기준(월간 뷰는 [0]이 전월 말 패딩, display는 오늘부터 패딩 없음)
            const startColIdx = monthDays.findIndex((d) => d.dateString === tour.startDate)
            const visibleStartIdx = startColIdx >= 0 ? startColIdx : 0
            // 이전 달·기간 이전에 시작했다면 그 만큼을 잘라내고 남은 일수만 표시
            const cutDays =
              startColIdx < 0 && diffFromMonthStart < 0
                ? Math.min(tour.days, Math.abs(diffFromMonthStart))
                : 0
            const remainingDays = tour.days - cutDays
            const spanDays = Math.min(remainingDays, monthDays.length - visibleStartIdx)
            if (spanDays <= 0) return null
            const hasColors = Object.keys(tour.dayData.productColors).length > 0
            const colorValues = Object.values(tour.dayData.productColors)
            const gradient = hasColors
              ? (colorValues.length === 1
                ? `linear-gradient(135deg, ${getColorFromClass(colorValues[0])} 0%, ${getColorFromClass(colorValues[0])} 100%)`
                : `linear-gradient(135deg, ${colorValues.map(color => getColorFromClass(color)).join(', ')})`)
              : undefined
            const mdRowTours = tours.filter(tourItem =>
              tourMatchesScheduleDate(tourItem, tour.startDate) &&
              (tour.dayData.role === 'guide'
                ? String(tourItem.tour_guide_id || '').trim() === teamMemberId
                : String(tourItem.assistant_id || '').trim() === teamMemberId)
            )
            const hasUnassignedVehicleMd = mdRowTours.some(t => !t.tour_car_id || String(t.tour_car_id).trim().length === 0)
            const assignedCarIdMd = mdRowTours.find(t => t.tour_car_id && String(t.tour_car_id).trim())?.tour_car_id
            const vehicleColorClassMd = assignedCarIdMd
              ? monthVehiclesWithColors.vehicleIdToColor.get(String(assignedCarIdMd).trim())
              : null
            return (
              <div
                key={`md-overlay-${idx}-${tour.startDate}`}
                className="absolute z-10 top-0 h-[22px] flex items-center"
                style={{ left: `calc(${visibleStartIdx} * (100% / ${monthDays.length}))`, width: `calc(${spanDays} * (100% / ${monthDays.length}))` }}
              >
                <ScheduleHoverTooltip
                  content={
                    mdRowTours.length > 0
                      ? getGuideScheduleTourHoverText(mdRowTours[0])
                      : guide.team_member_name
                  }
                >
                <div
                  className={`relative w-full h-full rounded px-2 py-0 text-[10px] flex items-center justify-center gap-1 cursor-pointer hover:opacity-90 transition-opacity ${tour.dayData.assignedPeople === 0 ? 'bg-gray-400 text-white' : ''}`}
                  style={{ 
                    background: tour.dayData.assignedPeople > 0 && hasColors ? gradient : undefined,
                    color:
                      tour.dayData.assignedPeople > 0 && hasColors && colorValues[0]
                        ? getProductDisplayProps(colorValues[0]).style?.color
                        : undefined
                  }}
                  draggable
                  onDragStart={(e) => {
                    if (mdRowTours.length > 0) {
                      handleDragStart(e, mdRowTours[0])
                    }
                  }}
                  onDragEnd={handleAssignedTourDragEnd}
                  onClick={() => {
                    if (mdRowTours.length > 0) {
                      showGuideModalContent('투어 상세 정보', getTourSummary(mdRowTours[0]), mdRowTours[0].id)
                    }
                  }}
                  onDoubleClick={() => {
                    if (mdRowTours.length > 0) {
                      openTourDetailModal(mdRowTours[0].id)
                    }
                  }}
                >
                  {hasUnassignedVehicleMd && (
                    <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                  {!hasUnassignedVehicleMd && vehicleColorClassMd && (
                    <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full border border-white ${vehicleColorClassMd}`} />
                  )}
                  {mdRowTours.some(tourItem => tourItem.is_private_tour === 'TRUE' || tourItem.is_private_tour === true) && (
                    <span>🔒</span>
                  )}
                  <span>
                    {tour.dayData.role === 'assistant'
                      ? (tour.dayData.guideInitials || 'A')
                      : (tour.dayData.assignedPeople || '')}
                  </span>
                  {tour.extendsToNextMonth && (
                    <span className="text-xs opacity-75">→</span>
                  )}
                </div>
                </ScheduleHoverTooltip>
              </div>
            )
          })}
        </div>
      </td>
      <td className="px-1 py-0 text-center text-[10px] font-medium" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
        <div className={`font-medium ${
          guide.totalAssignedPeople === 0 
            ? 'text-gray-300' 
            : guide.totalAssignedPeople < 4 
              ? 'text-primary' 
              : 'text-red-600'
        }`}>{guide.totalAssignedPeople} ({guide.totalTours}일)</div>
      </td>
    </tr>
  )
}
