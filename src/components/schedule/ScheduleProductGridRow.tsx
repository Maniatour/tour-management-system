'use client'

import type { DragEvent } from 'react'
import { ChevronUp, ChevronDown, Layers } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useTranslations } from 'next-intl'
import { getScheduleProductDisplayProps } from '@/lib/scheduleProductColorPresets'
import { getScheduleProductColor } from '@/lib/scheduleAirportPickDropGroup'
import type { ScheduleProductRef } from '@/lib/scheduleAirportPickDropGroup'
import {
  isScheduleMiscTourRowKey,
  getMiscTourStoredItemLabel,
} from '@/lib/scheduleMiscTourGroup'
import {
  aggregateScheduleBreakdownFromDailyData,
  formatProductScheduleCellPeopleWithPrivateSplit,
  ScheduleTotalColumnWithTooltip,
  type ScheduleMonthDayCell,
  type ScheduleProductGridProductRow,
} from '@/lib/scheduleProductGridHelpers'

export type ScheduleProductGridRowProps = {
  productId: string
  product: ScheduleProductGridProductRow
  index: number
  isDisplayMode: boolean
  useContentVisibility: boolean
  locale: string
  monthDays: ScheduleMonthDayCell[]
  monthDaysCore: ScheduleMonthDayCell[]
  monthDaysCoreDateStrings: string[]
  dayColumnWidthCalc: string
  productColors: Record<string, string>
  defaultPresetIds: string[]
  selectedProducts: string[]
  draggedProductRow: string | null
  miscTourProductIds: string[]
  miscTourDayProductBreakdown: Record<string, Record<string, { name: string; total: number; waiting: number }>>
  products: ScheduleProductRef[]
  scheduleHealthProductCellAlertSet: Set<string>
  isToday: (dateString: string) => boolean
  handleProductRowDragOver: (e: DragEvent, productId: string) => void
  handleProductRowDragLeave: (e: DragEvent) => void
  handleProductRowDrop: (e: DragEvent, productId: string) => void
  handleProductRowDragStart: (e: DragEvent, productId: string) => void
  handleProductRowDragEnd: () => void
  moveProduct: (fromIndex: number, toIndex: number) => void | Promise<void>
  setMiscTourModalDraft: (ids: string[]) => void
  setShowMiscTourModal: (open: boolean) => void
  openProductCellReservationsModal: (productId: string, dateString: string, productName: string) => void
  rowProps?: {
    'data-index'?: number
    ref?: (node: HTMLTableRowElement | null) => void
  }
}

export default function ScheduleProductGridRow({
  productId,
  product,
  index,
  isDisplayMode,
  useContentVisibility,
  locale,
  monthDays,
  monthDaysCore,
  monthDaysCoreDateStrings,
  dayColumnWidthCalc,
  productColors,
  defaultPresetIds,
  selectedProducts,
  draggedProductRow,
  miscTourProductIds,
  miscTourDayProductBreakdown,
  products,
  scheduleHealthProductCellAlertSet,
  isToday,
  handleProductRowDragOver,
  handleProductRowDragLeave,
  handleProductRowDrop,
  handleProductRowDragStart,
  handleProductRowDragEnd,
  moveProduct,
  setMiscTourModalDraft,
  setShowMiscTourModal,
  openProductCellReservationsModal,
  rowProps,
}: ScheduleProductGridRowProps) {
  const tTourCal = useTranslations('tours.calendar')
  const getProductDisplayProps = getScheduleProductDisplayProps
  const colorValue = getScheduleProductColor(
    productId,
    productColors,
    defaultPresetIds[index % defaultPresetIds.length],
  )
  const displayProps = getProductDisplayProps(colorValue)
  const selectedIndex = selectedProducts.indexOf(productId)
  const canMoveUp = selectedIndex > 0
  const canMoveDown = selectedIndex >= 0 && selectedIndex < selectedProducts.length - 1

  return (
    <tr
      {...rowProps}
      className={`hover:bg-gray-50 transition-colors ${
        draggedProductRow === productId ? 'opacity-50 bg-primary/5' : ''
      }`}
      style={
        useContentVisibility
          ? { contentVisibility: 'auto', containIntrinsicSize: '0 28px' }
          : undefined
      }
      onDragOver={(e) => handleProductRowDragOver(e, productId)}
      onDragLeave={handleProductRowDragLeave}
      onDrop={(e) => handleProductRowDrop(e, productId)}
    >
      <td
        className={`px-2 py-0.5 text-xs font-medium cursor-grab active:cursor-grabbing select-none border border-gray-300 sticky left-0 z-40 shadow-[1px_0_0_0_rgb(209,213,219)] ${displayProps.className ?? ''}`.trim()}
        style={{ width: '96px', minWidth: '96px', maxWidth: '96px', ...displayProps.style }}
        draggable
        onDragStart={(e) => handleProductRowDragStart(e, productId)}
        onDragEnd={handleProductRowDragEnd}
      >
        <div className="flex items-center gap-1">
          {!isDisplayMode ? (
            <div className="flex flex-col items-center -my-0.5">
              <button
                type="button"
                draggable={false}
                onClick={(e) => {
                  e.stopPropagation()
                  if (canMoveUp) void moveProduct(selectedIndex, selectedIndex - 1)
                }}
                disabled={!canMoveUp}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                title="위로 이동"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                draggable={false}
                onClick={(e) => {
                  e.stopPropagation()
                  if (canMoveDown) void moveProduct(selectedIndex, selectedIndex + 1)
                }}
                disabled={!canMoveDown}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                title="아래로 이동"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          ) : null}
          {product.product_name}
          {!isDisplayMode && isScheduleMiscTourRowKey(productId) && (
            <button
              type="button"
              draggable={false}
              onClick={(e) => {
                e.stopPropagation()
                setMiscTourModalDraft([...miscTourProductIds])
                setShowMiscTourModal(true)
              }}
              className="shrink-0 p-0.5 text-violet-700 hover:text-violet-900 rounded hover:bg-violet-100/80"
              title={locale === 'ko' ? '포함 상품 설정' : 'Configure grouped products'}
            >
              <Layers className="w-3 h-3" />
            </button>
          )}
        </div>
      </td>
      {monthDays.map(({ dateString }) => {
        const dayData = product.dailyData[dateString]
        return (
          <td
            key={dateString}
            className="p-0 text-center text-xs overflow-visible"
            style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
          >
            {(() => {
              const isHealthAlertCell = scheduleHealthProductCellAlertSet.has(`${productId}|${dateString}`)
              const langBgClass = dayData
                ? (() => {
                    const koAll = (dayData.koPeople || 0) + (dayData.koWaitingPeople || 0)
                    const enAll = (dayData.enPeople || 0) + (dayData.enWaitingPeople || 0)
                    if (koAll > 0 && enAll > 0) return 'bg-orange-100'
                    if (koAll > 0) return 'bg-yellow-100'
                    if (enAll > 0) return 'bg-red-100'
                    return 'bg-white'
                  })()
                : 'bg-white'
              const todayBorderClass = isToday(dateString) ? 'border-l-2 border-r-2 border-red-500' : ''
              const todayWrapClass = isHealthAlertCell
                ? `bg-red-600 text-yellow-300 animate-schedule-health-cell-blink ${todayBorderClass}`
                : isToday(dateString)
                  ? `${langBgClass} ${todayBorderClass}`
                  : langBgClass
              const displayOrder = ['X', 'L', 'U', '_other']
              const keyToLabel: Record<string, string> = { X: 'X', L: 'L', U: 'U', _other: '기타' }
              const choiceLine =
                dayData?.choiceCounts && Object.keys(dayData.choiceCounts).length > 0
                  ? Object.entries(dayData.choiceCounts)
                      .filter(([, n]) => n > 0)
                      .sort(([a], [b]) => displayOrder.indexOf(a) - displayOrder.indexOf(b))
                      .map(([key, count]) => `🏜️ ${keyToLabel[key] || key} : ${count}`)
                      .join(' / ')
                  : null

              return (
                <div
                  role="button"
                  tabIndex={0}
                  className={`group ${todayWrapClass} px-1 py-0.5 relative overflow-visible cursor-pointer`}
                  onClick={(e) => {
                    e.stopPropagation()
                    openProductCellReservationsModal(productId, dateString, product.product_name)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      openProductCellReservationsModal(productId, dateString, product.product_name)
                    }
                  }}
                >
                  {dayData ? (
                    <div
                      className={(() => {
                        if (isHealthAlertCell) {
                          return 'font-bold leading-tight whitespace-nowrap text-yellow-300 [&_span]:text-yellow-300'
                        }
                        const br = dayData.tourCapacityBreakdown
                        const isCapacityOverfull = br != null && br.totalAssigned > br.totalMax
                        const confirmed = dayData.totalPeople
                        const waiting = dayData.waitingPeople ?? 0
                        const onlyWaiting = confirmed === 0 && waiting > 0
                        const ap = dayData.assignmentPendingReservationCount ?? 0
                        const assignedSum = br?.totalAssigned ?? 0
                        const hasAssignmentPeopleGap = (confirmed ?? 0) > assignedSum && (confirmed ?? 0) > 0
                        if (isCapacityOverfull) {
                          return `font-bold leading-tight whitespace-nowrap ${
                            isToday(dateString) ? 'text-red-700' : 'text-red-600'
                          }`
                        }
                        if (ap > 0 || hasAssignmentPeopleGap) {
                          return `font-bold leading-tight whitespace-nowrap ${
                            isToday(dateString) ? 'text-red-700' : 'text-red-600'
                          }`
                        }
                        if (onlyWaiting) {
                          return `font-medium leading-tight whitespace-nowrap ${
                            isToday(dateString) ? 'text-primary' : 'text-primary'
                          }`
                        }
                        if (confirmed === 0) {
                          return 'font-medium leading-tight whitespace-nowrap text-gray-300'
                        }
                        if (confirmed < 4) {
                          return `font-medium leading-tight whitespace-nowrap ${
                            isToday(dateString) ? 'text-primary' : 'text-primary'
                          }`
                        }
                        return 'font-medium leading-tight whitespace-nowrap text-gray-900'
                      })()}
                    >
                      {(() => {
                        const ap = dayData.assignmentPendingReservationCount ?? 0
                        const canceledP = dayData.canceledPeople ?? 0
                        const core = formatProductScheduleCellPeopleWithPrivateSplit(
                          dayData.privateTourPeople ?? 0,
                          dayData.companionTourPeople ?? 0,
                          dayData.waitingPeople ?? 0,
                          0,
                        )
                        return (
                          <>
                            {core}
                            {ap > 0 && (
                              <span className="font-bold text-red-600 tabular-nums">({ap})</span>
                            )}
                            {canceledP > 0 ? <span className="tabular-nums">{` (${canceledP})`}</span> : null}
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className={isHealthAlertCell ? 'font-bold text-yellow-300' : 'text-gray-300'}>-</div>
                  )}
                  {dayData && (
                    <div className="absolute z-[1020] left-1/2 -translate-x-1/2 top-full mt-1 min-w-[260px] w-max max-w-[min(90vw,420px)] px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none overflow-visible text-left hidden group-hover:block group-focus-within:block">
                      {isScheduleMiscTourRowKey(productId) && miscTourProductIds.length > 0 && (
                        <div className="mb-2 pb-2 border-b border-gray-600 space-y-1.5">
                          <div className="text-sm font-bold text-violet-200 tracking-tight">
                            {locale === 'ko' ? '포함 상품' : 'Grouped products'}
                          </div>
                          {(() => {
                            const dayBreakdown = miscTourDayProductBreakdown[dateString]
                            const activeEntries = dayBreakdown
                              ? Object.entries(dayBreakdown).filter(([, v]) => v.total > 0 || v.waiting > 0)
                              : []
                            if (activeEntries.length > 0) {
                              return activeEntries.map(([canon, v]) => (
                                <div key={canon} className="text-sm font-semibold leading-snug">
                                  <span className="text-yellow-300">{v.name}</span>
                                  <span className="tabular-nums font-bold text-white">
                                    {': '}
                                    {v.total}
                                    {v.waiting > 0 ? ` (+${v.waiting})` : ''}
                                  </span>
                                </div>
                              ))
                            }
                            return miscTourProductIds.map((pid) => (
                              <div key={pid} className="text-sm font-semibold text-yellow-300 leading-snug">
                                {getMiscTourStoredItemLabel(pid, products)}
                              </div>
                            ))
                          })()}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-1.5 flex-nowrap">
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <ReactCountryFlag countryCode="KR" svg style={{ width: '1em', height: '0.75em' }} />
                          <span>{(dayData.koPeople || 0) + (dayData.koWaitingPeople || 0)}</span>
                        </span>
                        <span className="text-gray-400 shrink-0">/</span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <ReactCountryFlag countryCode="US" svg style={{ width: '1em', height: '0.75em' }} />
                          <span>{(dayData.enPeople || 0) + (dayData.enWaitingPeople || 0)}</span>
                        </span>
                      </div>
                      {choiceLine && (
                        <div className="whitespace-nowrap break-keep leading-tight">{choiceLine}</div>
                      )}
                      {dayData.tourCapacityBreakdown && dayData.tourCapacityBreakdown.rows.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-600 space-y-1.5">
                          {dayData.tourCapacityBreakdown.rows.map((row) => (
                            <div key={row.tourId} className="space-y-0.5">
                              <div className="text-[11px] text-gray-200 leading-snug">
                                {tTourCal('scheduleCellCapacityTeam', {
                                  n: row.teamIndex,
                                  guide: row.guideName,
                                  assistant: row.assistantName,
                                })}
                              </div>
                              <div className="text-[11px] text-gray-100 font-medium tabular-nums">
                                {tTourCal('scheduleCellCapacityPerTour', {
                                  assigned: row.assigned,
                                  max: row.max,
                                  spots: row.spotsLeft,
                                })}
                              </div>
                            </div>
                          ))}
                          <div className="text-[11px] text-amber-200 font-semibold pt-0.5 tabular-nums border-t border-gray-700 mt-1.5">
                            {tTourCal('scheduleCellCapacityTotal', {
                              assigned: dayData.tourCapacityBreakdown.totalAssigned,
                              max: dayData.tourCapacityBreakdown.totalMax,
                              spots: dayData.tourCapacityBreakdown.totalSpotsLeft,
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </td>
        )
      })}
      <td
        className="px-2 py-0.5 text-center text-xs font-medium bg-white"
        style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
      >
        <ScheduleTotalColumnWithTooltip
          total={product.totalPeople}
          breakdown={aggregateScheduleBreakdownFromDailyData(product.dailyData, monthDaysCoreDateStrings)}
          valueClassName={(() => {
            const rowWaiting = monthDaysCore.reduce(
              (s, d) => s + (product.dailyData[d.dateString]?.waitingPeople ?? 0),
              0,
            )
            const rowOverflow = monthDaysCore.some((d) => {
              const br = product.dailyData[d.dateString]?.tourCapacityBreakdown
              return br != null && br.totalAssigned > br.totalMax
            })
            const onlyWaitingTotal = product.totalPeople === 0 && rowWaiting > 0
            if (rowOverflow) return 'font-bold text-red-600'
            if (onlyWaitingTotal) return 'font-medium text-primary'
            return `font-medium ${
              product.totalPeople === 0
                ? 'text-gray-300'
                : product.totalPeople < 4
                  ? 'text-primary'
                  : 'text-gray-900'
            }`
          })()}
        />
      </td>
    </tr>
  )
}
