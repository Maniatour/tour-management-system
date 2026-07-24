'use client'

import { useMemo } from 'react'
import type { RefObject, DragEvent, UIEvent } from 'react'
import dayjs from 'dayjs'
import {
  ScheduleTotalColumnWithTooltip,
  type ScheduleProductDayTotal,
  type ScheduleProductGridProductRow,
  type ScheduleMonthDayCell,
} from '@/lib/scheduleProductGridHelpers'
import { useScheduleGridWindowVirtualizer } from '@/hooks/useScheduleGridWindowVirtualizer'
import ScheduleProductGridRow from '@/components/schedule/ScheduleProductGridRow'
import ScheduleHoverTooltip from '@/components/schedule/ScheduleHoverTooltip'
import type { ScheduleProductRef } from '@/lib/scheduleAirportPickDropGroup'

export type ScheduleProductGridProps = {
  isDisplayMode: boolean
  locale: string
  monthDays: ScheduleMonthDayCell[]
  monthDaysCore: ScheduleMonthDayCell[]
  monthDaysCoreDateStrings: string[]
  dynamicMinTableWidthPx: number
  dayColumnWidthCalc: string
  productScheduleStickyTopPx: number
  productScheduleHeaderScrollRef: RefObject<HTMLDivElement>
  productScheduleBodyScrollRef: RefObject<HTMLDivElement>
  onProductScheduleHeaderScroll: (e: UIEvent<HTMLDivElement>) => void
  onProductScheduleBodyScroll: (e: UIEvent<HTMLDivElement>) => void
  dateNotes: Record<string, { note: string; created_by?: string }>
  scheduleHealthHighlightDateSet: Set<string>
  scheduleHealthProductCellAlertSet: Set<string>
  scheduleInteractionDragging: boolean
  isToday: (dateString: string) => boolean
  openDateNoteModal: (dateString: string) => void
  productScheduleData: Record<string, ScheduleProductGridProductRow>
  productTotals: Record<string, ScheduleProductDayTotal>
  productScheduleGrandBreakdown: { ko: number; en: number; choiceCounts: Record<string, number> }
  productColors: Record<string, string>
  defaultPresetIds: string[]
  selectedProducts: string[]
  draggedProductRow: string | null
  miscTourProductIds: string[]
  miscTourDayProductBreakdown: Record<string, Record<string, { name: string; total: number; waiting: number }>>
  products: ScheduleProductRef[]
  handleProductRowDragOver: (e: DragEvent, productId: string) => void
  handleProductRowDragLeave: (e: DragEvent) => void
  handleProductRowDrop: (e: DragEvent, productId: string) => void
  handleProductRowDragStart: (e: DragEvent, productId: string) => void
  handleProductRowDragEnd: () => void
  moveProduct: (fromIndex: number, toIndex: number) => void | Promise<void>
  setMiscTourModalDraft: (ids: string[]) => void
  setShowMiscTourModal: (open: boolean) => void
  openProductCellReservationsModal: (productId: string, dateString: string, productName: string) => void
}

export default function ScheduleProductGrid(props: ScheduleProductGridProps) {
  const {
    isDisplayMode,
    locale,
    monthDays,
    monthDaysCore,
    monthDaysCoreDateStrings,
    dynamicMinTableWidthPx,
    dayColumnWidthCalc,
    productScheduleStickyTopPx,
    productScheduleHeaderScrollRef,
    productScheduleBodyScrollRef,
    onProductScheduleHeaderScroll,
    onProductScheduleBodyScroll,
    dateNotes,
    scheduleHealthHighlightDateSet,
    scheduleHealthProductCellAlertSet,
    scheduleInteractionDragging,
    isToday,
    openDateNoteModal,
    productScheduleData,
    productTotals,
    productScheduleGrandBreakdown,
    productColors,
    defaultPresetIds,
    selectedProducts,
    draggedProductRow,
    miscTourProductIds,
    miscTourDayProductBreakdown,
    products,
    handleProductRowDragOver,
    handleProductRowDragLeave,
    handleProductRowDrop,
    handleProductRowDragStart,
    handleProductRowDragEnd,
    moveProduct,
    setMiscTourModalDraft,
    setShowMiscTourModal,
    openProductCellReservationsModal,
  } = props

  const productRows = useMemo(
    () => Object.entries(productScheduleData),
    [productScheduleData],
  )
  const productGridColSpan = monthDays.length + 2
  const {
    anchorRef: productRowsAnchorRef,
    active: virtualizeProductRows,
    virtualizer: productRowVirtualizer,
    virtualItems: virtualProductRows,
    totalSize: virtualProductRowsTotalSize,
  } = useScheduleGridWindowVirtualizer({
    enabled: true,
    count: productRows.length,
  })

  const sharedRowProps = {
    isDisplayMode,
    useContentVisibility: !virtualizeProductRows,
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
  }

  const renderRows = () => {
    if (virtualizeProductRows && virtualProductRows && virtualProductRows.length > 0) {
      const paddingTop = virtualProductRows[0]?.start ?? 0
      const paddingBottom =
        virtualProductRowsTotalSize - (virtualProductRows[virtualProductRows.length - 1]?.end ?? 0)

      return (
        <>
          {paddingTop > 0 && (
            <tr aria-hidden>
              <td
                colSpan={productGridColSpan}
                style={{ height: paddingTop, padding: 0, border: 'none', lineHeight: 0 }}
              />
            </tr>
          )}
          {virtualProductRows.map((virtualRow) => {
            const entry = productRows[virtualRow.index]
            if (!entry) return null
            const [productId, product] = entry
            return (
              <ScheduleProductGridRow
                key={productId}
                productId={productId}
                product={product}
                index={virtualRow.index}
                {...sharedRowProps}
                rowProps={{
                  'data-index': virtualRow.index,
                  ref: productRowVirtualizer.measureElement,
                }}
              />
            )
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td
                colSpan={productGridColSpan}
                style={{ height: paddingBottom, padding: 0, border: 'none', lineHeight: 0 }}
              />
            </tr>
          )}
        </>
      )
    }

    return productRows.map(([productId, product], index) => (
      <ScheduleProductGridRow
        key={productId}
        productId={productId}
        product={product}
        index={index}
        {...sharedRowProps}
      />
    ))
  }

  return (
    <>
      <div
        ref={productScheduleHeaderScrollRef}
        onScroll={onProductScheduleHeaderScroll}
        className="sticky z-[1010] scrollbar-hide min-w-0 overflow-x-auto overflow-y-visible bg-primary/5"
        style={{
          top: productScheduleStickyTopPx,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table
          className="w-full border-separate border-spacing-0"
          style={{ tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px` }}
        >
          <thead className="bg-primary/5">
            <tr className="align-top">
              <th
                className="px-2 py-0.5 text-left text-xs font-medium text-gray-700 align-top sticky left-0 z-[1011] bg-primary/5 border-b border-r border-gray-300 shadow-[1px_0_0_0_rgb(209,213,219)]"
                style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }}
              >
                상품명
              </th>
              {monthDays.map(({ date, dayOfWeek, dateString, isEdgePadding }) => {
                const hasNote = dateNotes[dateString]?.note
                const healthHeaderAlert =
                  !isEdgePadding && scheduleHealthHighlightDateSet.has(dateString)
                return (
                  <th
                    key={dateString}
                    className={`p-0 text-center text-xs font-medium align-top border-b border-gray-200 ${
                      isEdgePadding
                        ? 'bg-slate-100/90 text-gray-700'
                        : healthHeaderAlert
                          ? 'bg-red-600 text-[#ffff00]'
                          : 'bg-primary/5 text-gray-700'
                    }`}
                    style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                  >
                    <ScheduleHoverTooltip
                      disabled={scheduleInteractionDragging}
                      maxWidth={320}
                      content={
                        hasNote ? (
                          <>
                            <div className="font-semibold mb-1">{dateString}</div>
                            <div className="whitespace-pre-wrap break-words">{dateNotes[dateString].note}</div>
                          </>
                        ) : (
                          '클릭하여 날짜 노트 작성'
                        )
                      }
                    >
                      <div
                        className={`
                          px-1 py-0.5 cursor-pointer transition-colors relative
                          ${healthHeaderAlert
                            ? 'bg-red-600 hover:bg-red-700'
                            : isToday(dateString)
                              ? 'border-l-2 border-r-2 border-red-500 bg-red-50'
                              : hasNote
                                ? 'bg-yellow-50 border-2 border-yellow-400 rounded'
                                : ''
                          }
                          ${!healthHeaderAlert && hasNote && !isToday(dateString) ? 'hover:bg-yellow-100' : !healthHeaderAlert ? 'hover:bg-muted' : ''}
                        `}
                        onClick={() => openDateNoteModal(dateString)}
                      >
                        <div
                          className={`flex items-center justify-center ${
                            healthHeaderAlert
                              ? 'font-bold text-[#ffff00]'
                              : isToday(dateString)
                                ? 'font-bold text-red-700'
                                : hasNote
                                  ? 'font-semibold text-yellow-800'
                                  : isEdgePadding
                                    ? 'text-slate-700'
                                    : ''
                          }`}
                        >
                          <span>{isEdgePadding ? dayjs(dateString).format('M/D') : `${date}일`}</span>
                        </div>
                        <div
                          className={`text-xs flex items-center justify-center gap-1 ${
                            healthHeaderAlert
                              ? 'font-semibold text-[#ffff00]'
                              : isToday(dateString)
                                ? 'text-red-600'
                                : hasNote
                                  ? 'text-yellow-700 font-medium'
                                  : 'text-gray-500'
                          }`}
                        >
                          {dayOfWeek}
                          {hasNote && <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />}
                        </div>
                      </div>
                    </ScheduleHoverTooltip>
                  </th>
                )
              })}
              <th
                className="px-2 py-0.5 text-center text-xs font-medium text-gray-700 align-top bg-primary/5 border-b border-gray-200"
                style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
              >
                합계
              </th>
            </tr>
          </thead>
        </table>
      </div>
      <div
        ref={productScheduleBodyScrollRef}
        onScroll={onProductScheduleBodyScroll}
        className="scrollbar-hide min-w-0 overflow-x-auto"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table
          className="w-full border-separate border-spacing-0"
          style={{ tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px` }}
        >
          <tbody ref={productRowsAnchorRef} className="divide-y divide-gray-200">
            {renderRows()}
            <tr className="bg-primary/10 font-semibold">
              <td
                className="px-2 py-0.5 text-xs text-gray-900 sticky left-0 z-40 bg-primary/10 border-r border-gray-300 shadow-[1px_0_0_0_rgb(209,213,219)]"
                style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }}
              >
                일별 합계
              </td>
              {monthDays.map(({ dateString }) => {
                const dayTotal = productTotals[dateString]
                const dayColOverflow = Object.values(productScheduleData).some((p) => {
                  const br = p.dailyData[dateString]?.tourCapacityBreakdown
                  return br != null && br.totalAssigned > br.totalMax
                })
                return (
                  <td
                    key={dateString}
                    className="p-0 text-center text-xs"
                    style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                  >
                    <div className={`${isToday(dateString) ? 'border-2 border-red-500 bg-red-50' : ''} px-1 py-0.5`}>
                      <div
                        className={(() => {
                          const confirmed = dayTotal.totalPeople
                          const waiting = dayTotal.waitingPeople ?? 0
                          const onlyWaiting = confirmed === 0 && waiting > 0
                          if (dayColOverflow) {
                            return `font-bold ${isToday(dateString) ? 'text-red-700' : 'text-red-600'}`
                          }
                          if (onlyWaiting) {
                            return `font-medium ${isToday(dateString) ? 'text-primary' : 'text-primary'}`
                          }
                          return `font-medium ${
                            confirmed === 0
                              ? 'text-gray-300'
                              : confirmed < 4
                                ? 'text-primary'
                                : 'text-gray-900'
                          }`
                        })()}
                      >
                        {dayTotal.totalPeople}
                      </div>
                    </div>
                  </td>
                )
              })}
              <td
                className="px-2 py-0.5 text-center text-xs font-medium"
                style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
              >
                <ScheduleTotalColumnWithTooltip
                  total={Object.values(productScheduleData).reduce((sum, product) => sum + product.totalPeople, 0)}
                  breakdown={productScheduleGrandBreakdown}
                  valueClassName="font-medium text-gray-900"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
