'use client'

import type { DragEvent } from 'react'
import dayjs from 'dayjs'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { buildVehicleOilTooltipLines } from '@/lib/scheduleVehicleOilMaintenance'
import ScheduleHoverTooltip from '@/components/schedule/ScheduleHoverTooltip'
import type {
  ScheduleVehicleRow,
  ScheduleVehicleScheduleRow,
  ScheduleVehicleGridMonthDay,
  VehicleOilMaintenanceSummary,
} from '@/lib/scheduleVehicleGridTypes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tour = any

const SCHEDULE_VEHICLE_CELL_DROP_HIGHLIGHT = ['ring-2', 'ring-blue-400', 'bg-primary/5'] as const

export type ScheduleVehicleGridProps = {
  locale: string
  currentDate: Date
  monthDays: ScheduleVehicleGridMonthDay[]
  dynamicMinTableWidthPx: number
  dayColumnWidthCalc: string
  orderedVehiclesForScheduleTable: ScheduleVehicleRow[]
  vehicleScheduleData: Record<string, ScheduleVehicleScheduleRow>
  vehicleOilMaintenanceByVehicleId: Map<string, VehicleOilMaintenanceSummary>
  vehicleDailyTotals: Record<string, number>
  tourCountPerDate: Record<string, number>
  tours: Tour[]
  tourCoversScheduleDate: (tour: Tour, dateString: string) => boolean
  isToday: (dateString: string) => boolean
  draggedVehicleRowId: string | null
  canEditVehicleFromSchedule: boolean
  defaultPresetIds: string[]
  getColorFromClass: (colorClass: string | undefined) => string
  handleVehicleRowDragStart: (e: DragEvent, vehicleId: string) => void
  handleVehicleRowDragEnd: () => void
  handleVehicleRowDragOver: (e: DragEvent, vehicleId: string) => void
  handleVehicleRowDrop: (e: DragEvent, vehicleId: string) => void
  moveVehicleRow: (from: number, to: number) => void
  openVehicleEditFromSchedule: (vehicleId: string) => void | Promise<void>
  setVehicleAssignTarget: (target: { vehicleId: string; dateString: string }) => void
  setShowVehicleAssignModal: (open: boolean) => void
  applyScheduleDragHighlight: (element: HTMLElement, classes: readonly string[]) => void
  onVehicleCellDragLeave: (e: DragEvent) => void
  handleVehicleCellDrop: (e: DragEvent, vehicleId: string, dateString: string) => void
  handleDragStart: (e: DragEvent, tour: Tour) => void
  setDraggedRole: (role: 'guide' | 'assistant' | null) => void
  setDraggedTour: (tour: Tour | null) => void
  setHighlightedDate: (date: string | null) => void
  clearScheduleDragHighlight: () => void
}

export default function ScheduleVehicleGrid(props: ScheduleVehicleGridProps) {
  const {
    locale,
    currentDate,
    monthDays,
    dynamicMinTableWidthPx,
    dayColumnWidthCalc,
    orderedVehiclesForScheduleTable,
    vehicleScheduleData,
    vehicleOilMaintenanceByVehicleId,
    vehicleDailyTotals,
    tourCountPerDate,
    tours,
    tourCoversScheduleDate,
    isToday,
    draggedVehicleRowId,
    canEditVehicleFromSchedule,
    defaultPresetIds,
    getColorFromClass,
    handleVehicleRowDragStart,
    handleVehicleRowDragEnd,
    handleVehicleRowDragOver,
    handleVehicleRowDrop,
    moveVehicleRow,
    openVehicleEditFromSchedule,
    setVehicleAssignTarget,
    setShowVehicleAssignModal,
    applyScheduleDragHighlight,
    onVehicleCellDragLeave,
    handleVehicleCellDrop,
    handleDragStart,
    setDraggedRole,
    setDraggedTour,
    setHighlightedDate,
    clearScheduleDragHighlight,
  } = props

  if (orderedVehiclesForScheduleTable.length === 0) return null

  return (
    <div className="mt-1 overflow-visible">
        <table className="w-full" style={{ tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px` }}>
          <tbody className="divide-y divide-gray-200">
            {orderedVehiclesForScheduleTable.map(({ id, label, colorClass, rental_start_date, rental_end_date, vehicle_category }, index) => {
              const canMoveUp = index > 0
              const canMoveDown = index < orderedVehiclesForScheduleTable.length - 1
              const data = vehicleScheduleData[id]
              if (!data) return null
              const isCompanyVehicleRow =
                (vehicle_category || 'company').toString().toLowerCase() !== 'rental'
              const oilSummary = vehicleOilMaintenanceByVehicleId.get(id)
              const allNames = new Set<string>()
              monthDays.forEach(({ dateString }) => {
                const dayInfo = data.daily[dateString]
                if (dayInfo) {
                  dayInfo.guideNames.forEach(n => allNames.add(n))
                  dayInfo.assistantNames.forEach(n => allNames.add(n))
                  dayInfo.driverNames.forEach(n => allNames.add(n))
                }
              })
              const sortedNames = [...allNames].filter(Boolean).sort()
              const crewTooltipLines =
                sortedNames.length > 0
                  ? [`${sortedNames.join(', ')}`, `총 ${sortedNames.length}명`]
                  : []
              const vehicleNameTooltip =
                isCompanyVehicleRow && oilSummary
                  ? buildVehicleOilTooltipLines(oilSummary, crewTooltipLines)
                  : crewTooltipLines.length > 0
                    ? crewTooltipLines.join('\n')
                    : label
              /** 렌트 구간 ∩ (표시 중인 달 ~ 그 다음 달 말일) 안의 배정일. 다음 달 배차도 툴팁에 포함 */
              const rentalAssignedDaysCompactList = (() => {
                const rs = (rental_start_date || '').toString().substring(0, 10)
                const re = (rental_end_date || '').toString().substring(0, 10)
                if (!rs || !re) return ''
                const rentalStart = dayjs(rs)
                const rentalEnd = dayjs(re)
                if (!rentalStart.isValid() || !rentalEnd.isValid()) return ''
    
                const viewStart = dayjs(currentDate).startOf('month')
                const viewEnd = dayjs(currentDate).add(1, 'month').endOf('month')
                const rangeStart = rentalStart.isAfter(viewStart, 'day') ? rentalStart : viewStart
                const rangeEnd = rentalEnd.isBefore(viewEnd, 'day') ? rentalEnd : viewEnd
                if (rangeStart.isAfter(rangeEnd, 'day')) return ''
    
                const dateStrings: string[] = []
                for (let cur = rangeStart; !cur.isAfter(rangeEnd, 'day'); cur = cur.add(1, 'day')) {
                  const dateString = cur.format('YYYY-MM-DD')
                  const covered = tours.some(
                    (t) =>
                      t.tour_car_id &&
                      String(t.tour_car_id).trim() === id &&
                      tourCoversScheduleDate(t, dateString),
                  )
                  if (covered) dateStrings.push(dateString)
                }
                if (dateStrings.length === 0) return ''
    
                const viewYm = dayjs(currentDate).format('YYYY-MM')
                const allInViewMonth =
                  dateStrings.length > 0 && dateStrings.every((s) => s.slice(0, 7) === viewYm)
                if (allInViewMonth) {
                  return dateStrings.map((s) => String(Number(s.slice(8, 10)))).join(',')
                }
                return dateStrings
                  .map((s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`)
                  .join(',')
              })()
              const rentalPeriodTooltipLine = `렌트 기간: ${(rental_start_date || '').toString().substring(0, 10)} ~ ${(rental_end_date || '').toString().substring(0, 10)}`
              const rentalEmptyCellTooltip = rentalAssignedDaysCompactList
                ? `${rentalPeriodTooltipLine}\n${rentalAssignedDaysCompactList}`
                : rentalPeriodTooltipLine
              return (
                <tr
                  key={id}
                  className={`group hover:bg-gray-50/50 ${
                    draggedVehicleRowId === id ? 'opacity-50 bg-primary/5/80' : ''
                  }`}
                >
                  <td
                    className={`px-1 py-0.5 text-xs leading-tight text-gray-900 select-none sticky left-0 z-40 border-r border-gray-300 shadow-[1px_0_0_0_rgb(209,213,219)] ${
                      draggedVehicleRowId === id ? 'bg-primary/5/80' : 'bg-white group-hover:bg-gray-50/50'
                    }`}
                    style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }}
                    onDragOver={(e) => {
                      if (draggedVehicleRowId) {
                        handleVehicleRowDragOver(e, id)
                      }
                    }}
                    onDrop={(e) => {
                      if (e.dataTransfer.getData('text/vehicle-row')) {
                        e.preventDefault()
                        handleVehicleRowDrop(e, id)
                      }
                    }}
                  >
                    <div className="flex items-center gap-0.5">
                      <div
                        className="flex shrink-0 items-center gap-0.5 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => handleVehicleRowDragStart(e, id)}
                        onDragEnd={handleVehicleRowDragEnd}
                        title="행 순서: 이 영역을 드래그하여 이동"
                      >
                        <div className="flex flex-col items-center -my-0.5">
                          <button
                            type="button"
                            draggable={false}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canMoveUp) moveVehicleRow(index, index - 1)
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
                              if (canMoveDown) moveVehicleRow(index, index + 1)
                            }}
                            disabled={!canMoveDown}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="아래로 이동"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                        <span className={`flex-shrink-0 w-2 h-2 rounded-full border border-white ${colorClass}`} />
                      </div>
                      <ScheduleHoverTooltip
                        content={
                          canEditVehicleFromSchedule
                            ? `${vehicleNameTooltip}\n클릭하여 차량 정보 수정`
                            : vehicleNameTooltip
                        }
                      >
                      <div
                        className={`min-w-0 flex-1 truncate font-medium ${canEditVehicleFromSchedule ? 'cursor-pointer hover:text-primary' : 'cursor-help'}`}
                        role={canEditVehicleFromSchedule ? 'button' : undefined}
                        tabIndex={canEditVehicleFromSchedule ? 0 : undefined}
                        onClick={
                          canEditVehicleFromSchedule
                            ? (e) => {
                                e.stopPropagation()
                                void openVehicleEditFromSchedule(id)
                              }
                            : undefined
                        }
                        onKeyDown={
                          canEditVehicleFromSchedule
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  void openVehicleEditFromSchedule(id)
                                }
                              }
                            : undefined
                        }
                      >
                        {label}
                      </div>
                      </ScheduleHoverTooltip>
                    </div>
                  </td>
                  {monthDays.map(({ dateString }) => {
                    const dayInfo = data.daily[dateString]
                    const count = dayInfo?.count ?? 0
                    const guideNames = dayInfo?.guideNames ?? []
                    const assistantNames = dayInfo?.assistantNames ?? []
                    const driverNames = dayInfo?.driverNames ?? []
                    const hoverLines: string[] = []
                    if (guideNames.length > 0) hoverLines.push(`가이드: ${guideNames.join(', ')}`)
                    const asstOrDriverNames = [...new Set([...assistantNames, ...driverNames])].filter(Boolean)
                    if (asstOrDriverNames.length > 0) hoverLines.push(`어시스턴트/드라이버: ${asstOrDriverNames.join(', ')}`)
                    hoverLines.push('드래그하여 다른 차량으로 이동')
                    const cellTooltip = hoverLines.join('\n')
                    const dayTours = tours.filter(t => t.tour_car_id && String(t.tour_car_id).trim() === id && t.tour_date === dateString)
                    const isInRentalPeriod = rental_start_date && rental_end_date &&
                      dateString >= (rental_start_date || '').toString().substring(0, 10) &&
                      dateString <= (rental_end_date || '').toString().substring(0, 10)
                    const needsMaintenanceGap =
                      isCompanyVehicleRow &&
                      count === 0 &&
                      (oilSummary?.maintenanceGapDates.has(dateString) ?? false)
                    const maintenanceGapTooltip =
                      locale === 'ko'
                        ? '엔진오일 교체 필요 — 투어 배정 전 정비 권장'
                        : 'Engine oil change needed before next tour assignment'
                    const baseTdClass = isToday(dateString) ? 'border-l-2 border-r-2 border-red-500 bg-red-50' : ''
                    const rentalBgClass = isInRentalPeriod ? 'bg-amber-200' : ''
                    const maintenanceGapBgClass = needsMaintenanceGap ? 'bg-orange-50 ring-1 ring-orange-400 ring-inset' : ''
                    const cellHoverContent = needsMaintenanceGap
                      ? maintenanceGapTooltip
                      : count > 0
                        ? cellTooltip
                        : isInRentalPeriod
                          ? rentalEmptyCellTooltip
                          : '클릭하여 투어 배정 / 드래그하여 다른 차량으로 이동'
                    return (
                      <td
                        key={dateString}
                        className={`px-1 py-0 text-center text-xs relative cursor-pointer hover:ring-1 hover:ring-blue-300 ${baseTdClass} ${rentalBgClass} ${maintenanceGapBgClass}`}
                        style={{ width: dayColumnWidthCalc, minWidth: '40px', boxSizing: 'border-box' }}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('[data-drag-handle]')) return
                          setVehicleAssignTarget({ vehicleId: id, dateString })
                          setShowVehicleAssignModal(true)
                        }}
                        onDragOver={(e) => {
                          if (draggedVehicleRowId) {
                            handleVehicleRowDragOver(e, id)
                            return
                          }
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          applyScheduleDragHighlight(
                            e.currentTarget as HTMLElement,
                            SCHEDULE_VEHICLE_CELL_DROP_HIGHLIGHT,
                          )
                        }}
                        onDragLeave={onVehicleCellDragLeave}
                        onDrop={(e) => {
                          if (e.dataTransfer.getData('text/vehicle-row')) {
                            e.preventDefault()
                            e.stopPropagation()
                            handleVehicleRowDrop(e, id)
                            return
                          }
                          handleVehicleCellDrop(e, id, dateString)
                        }}
                      >
                        <ScheduleHoverTooltip content={cellHoverContent}>
                        <div className="relative h-[22px] w-full">
                          {count > 0 ? (
                            <div
                              data-drag-handle
                              className="absolute inset-0 flex items-center justify-center rounded text-white px-0.5 py-0 text-[10px] font-medium leading-tight cursor-grab active:cursor-grabbing"
                              style={{ backgroundColor: getColorFromClass(dayInfo?.productColorClass || defaultPresetIds[0]) }}
                              draggable
                              onDragStart={(e) => {
                                if (dayTours.length > 0) {
                                  setDraggedRole(null)
                                  handleDragStart(e, dayTours[0])
                                }
                              }}
                              onDragEnd={() => {
                                setDraggedTour(null)
                                setHighlightedDate(null)
                                clearScheduleDragHighlight()
                              }}
                            >
                              <span className="truncate w-full text-center">
                                {guideNames.length > 0 ? guideNames.join(', ') : count}
                              </span>
                            </div>
                          ) : needsMaintenanceGap ? (
                            <span
                              className="absolute inset-0 flex items-center justify-center rounded bg-orange-500 px-0.5 text-[8px] font-bold leading-none text-white animate-pulse shadow-sm ring-2 ring-orange-300 ring-inset"
                            >
                              정비 필요
                            </span>
                          ) : (
                            <span className="text-gray-300 text-[10px]">-</span>
                          )}
                        </div>
                        </ScheduleHoverTooltip>
                      </td>
                    )
                  })}
                  <td
                    className="px-1 py-0.5 text-center text-xs font-medium"
                    style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                    onDragOver={(e) => {
                      if (draggedVehicleRowId) {
                        handleVehicleRowDragOver(e, id)
                      }
                    }}
                    onDrop={(e) => {
                      if (e.dataTransfer.getData('text/vehicle-row')) {
                        e.preventDefault()
                        handleVehicleRowDrop(e, id)
                      }
                    }}
                  >
                    {data.totalDays > 0 ? data.totalDays : '-'}
                  </td>
                </tr>
              )
            })}
            {/* 일별 합계 행 */}
            <tr className="bg-gray-100 font-semibold">
              <td className="px-1 py-0.5 text-xs text-gray-900 sticky left-0 z-40 bg-gray-100 border-r border-gray-300 shadow-[1px_0_0_0_rgb(209,213,219)]" style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }}>
                일별 합계
              </td>
              {monthDays.map(({ dateString }) => {
                const dayTotal = vehicleDailyTotals[dateString] ?? 0
                const tourCount = tourCountPerDate[dateString] ?? 0
                const isMismatch = tourCount !== dayTotal
                const mismatchTitle =
                  locale === 'ko'
                    ? `투어 ${tourCount}건 · 차량 배정 ${dayTotal}건 (불일치)`
                    : `Tours ${tourCount} · vehicle assignments ${dayTotal} (mismatch)`
                return (
                  <td
                    key={dateString}
                    className={`px-1 py-0.5 text-center text-xs ${isToday(dateString) ? 'border-l-2 border-r-2 border-red-500 bg-red-50' : ''}`}
                    style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                  >
                    {isMismatch ? (
                      <ScheduleHoverTooltip content={mismatchTitle}>
                        <span
                          className="inline-flex min-h-[1.25rem] min-w-[1.25rem] cursor-default items-center justify-center rounded-md bg-red-600 px-1 py-0.5 text-[10px] font-bold text-yellow-300 tabular-nums shadow-sm"
                        >
                          {tourCount}
                        </span>
                      </ScheduleHoverTooltip>
                    ) : dayTotal > 0 ? (
                      dayTotal
                    ) : (
                      '-'
                    )}
                  </td>
                )
              })}
              <td className="px-1 py-0.5 text-center text-xs font-medium" style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>
                {Object.values(vehicleScheduleData).reduce((sum, d) => sum + (d?.totalDays ?? 0), 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  )
}
