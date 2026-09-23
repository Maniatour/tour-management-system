'use client'

import { useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import type { ScheduleDateNoteEntry } from '@/lib/scheduleDateNotes'
import type { ScheduleRequiredGuideLang } from '@/lib/scheduleGuideLanguageMatch'
import type { ScheduleAssignedTourPulseIssue } from '@/lib/scheduleAssignedTourPulse'
import { buildAutoAssignPreviewGridModel } from '@/lib/schedule/autoAssignPreviewGrid'
import type { AutoAssignPreviewData } from '@/lib/schedule/autoAssignScheduleInput'
import ScheduleGuideGrid from '@/components/schedule/ScheduleGuideGrid'
import ScheduleProductGrid from '@/components/schedule/ScheduleProductGrid'
import { ScheduleTooltipZIndexContext } from '@/components/schedule/ScheduleHoverTooltip'

type OffRow = { team_email: string; off_date: string; reason: string; status: string }

type PendingOff = OffRow & { action: 'approve' | 'delete' | 'reject' }

type ScheduleAutoAssignPreviewBoardProps = {
  preview: AutoAssignPreviewData
  locale: string
  teamMembers: Array<{ email?: string | null; nick_name?: string | null; name_ko?: string | null; position?: string | null; [key: string]: unknown }>
  products: Array<{ id?: string | null; name?: string | null; name_ko?: string | null; [key: string]: unknown }>
  productColors: Record<string, string>
  defaultPresetIds: string[]
  selectedProducts: string[]
  miscTourProductIds: string[]
  cdlDriverEmailSet: Set<string>
  cdlKoreanDriverEmailSet: Set<string>
  airportPickupMemberIdSet: Set<string>
  airportSendingMemberIdSet: Set<string>
  getMultiDayTourDays: (productId: string) => number
  isToday: (dateString: string) => boolean
  isGuideVisibleUntilCutoff: (dateString: string) => boolean
  dateNotes: Record<string, ScheduleDateNoteEntry>
  pendingOffScheduleChanges: Record<string, PendingOff>
  offScheduleAssignmentCellClass: (status: string | undefined) => string
  getColorFromClass: (colorClass: string | undefined) => string
  getBorderColorValue: (borderColorClass: string) => string
  getTourBorderColor: (tourId: string, dateString: string, productId: string, guideId: string) => string
  openTourDetailModal: (tourId: string) => void
  showGuideModalContent: (title: string, content: string, tourId?: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTourSummary: (tour: any) => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGuideScheduleTourHoverText: (tour: any) => ReactNode
  guideLanguageMismatchByTourId: ReadonlyMap<string, ScheduleRequiredGuideLang[]>
  assignedTourConfirmationPulseByTourId: ReadonlyMap<string, ScheduleAssignedTourPulseIssue[]>
}

const noop = () => {}
const noopDrag = (event: DragEvent) => {
  event.preventDefault()
}

export default function ScheduleAutoAssignPreviewBoard({
  preview,
  locale,
  teamMembers,
  products,
  productColors,
  defaultPresetIds,
  selectedProducts,
  miscTourProductIds,
  cdlDriverEmailSet,
  cdlKoreanDriverEmailSet,
  airportPickupMemberIdSet,
  airportSendingMemberIdSet,
  getMultiDayTourDays,
  isToday,
  isGuideVisibleUntilCutoff,
  dateNotes,
  pendingOffScheduleChanges,
  offScheduleAssignmentCellClass,
  getColorFromClass,
  getBorderColorValue,
  getTourBorderColor,
  openTourDetailModal,
  showGuideModalContent,
  getTourSummary,
  getGuideScheduleTourHoverText,
  guideLanguageMismatchByTourId,
  assignedTourConfirmationPulseByTourId,
}: ScheduleAutoAssignPreviewBoardProps) {
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const [hoveredGuideRow, setHoveredGuideRow] = useState<string | null>(null)
  const model = useMemo(
    () =>
      buildAutoAssignPreviewGridModel({
        preview,
        teamMembers,
        products,
        selectedProducts,
        miscTourProductIds,
        productColors,
        defaultPresetIds,
        airportPickupMemberIdSet,
        airportSendingMemberIdSet,
        getMultiDayTourDays,
      }),
    [
      airportPickupMemberIdSet,
      airportSendingMemberIdSet,
      defaultPresetIds,
      getMultiDayTourDays,
      miscTourProductIds,
      preview,
      productColors,
      products,
      selectedProducts,
      teamMembers,
    ],
  )

  const isOffDate = (teamMemberId: string, dateString: string) => {
    const member = teamMembers.find((item) => item.email === teamMemberId)
    const email = member?.email || teamMemberId
    const pending = pendingOffScheduleChanges[`${email}_${dateString}`]
    if (pending?.action === 'delete') return false
    if (pending?.action === 'approve') return true
    return preview.offSchedules.some((off) => off.team_email === email && off.off_date === dateString)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoverText = (tour: any) => {
    const base = getGuideScheduleTourHoverText(tour)
    const lines = preview.result.slots
      .filter((slot) => slot.tourId === String(tour.id || ''))
      .flatMap((slot) => slot.reasonLines)
      .filter(Boolean)
    if (lines.length === 0) return base
    return (
      <div>
        {base}
        <div className="mt-2 whitespace-pre-line border-t border-white/20 pt-2">{lines.join('\n')}</div>
      </div>
    )
  }

  return (
    <ScheduleTooltipZIndexContext.Provider value={10080}>
    <div className="min-w-0 overflow-x-hidden rounded-xl border border-gray-200 bg-white">
      <ScheduleProductGrid
        fitWidth
        isDisplayMode={false}
        locale={locale}
        monthDays={model.monthDays}
        monthDaysCore={model.monthDaysCore}
        monthDaysCoreDateStrings={model.monthDaysCoreDateStrings}
        dynamicMinTableWidthPx={model.dynamicMinTableWidthPx}
        dayColumnWidthCalc={model.dayColumnWidthCalc}
        productScheduleStickyTopPx={0}
        productScheduleHeaderScrollRef={headerScrollRef}
        productScheduleBodyScrollRef={bodyScrollRef}
        onProductScheduleHeaderScroll={noop}
        onProductScheduleBodyScroll={noop}
        dateNotes={dateNotes}
        scheduleHealthHighlightDateSet={new Set()}
        scheduleHealthProductCellAlerts={new Map()}
        scheduleInteractionDragging={false}
        isToday={isToday}
        isGuideVisibleUntilCutoff={isGuideVisibleUntilCutoff}
        openDateNoteModal={noop}
        productScheduleData={model.productScheduleData}
        productTotals={model.productTotals}
        productScheduleGrandBreakdown={{ ko: 0, en: 0, ja: 0, choiceCounts: {} }}
        productColors={productColors}
        defaultPresetIds={defaultPresetIds}
        selectedProducts={model.selectedProducts}
        draggedProductRow={null}
        miscTourProductIds={miscTourProductIds}
        miscTourDayProductBreakdown={{}}
        products={products as never}
        handleProductRowDragOver={noopDrag}
        handleProductRowDragLeave={noopDrag}
        handleProductRowDrop={noopDrag}
        handleProductRowDragStart={noopDrag}
        handleProductRowDragEnd={noop}
        moveProduct={noop}
        setMiscTourModalDraft={noop}
        setShowMiscTourModal={noop}
        openProductCellReservationsModal={noop}
      />
      <ScheduleGuideGrid
        fitWidth
        locale={locale}
        monthDays={model.monthDays}
        dayColumnWidthCalc={model.dayColumnWidthCalc}
        dynamicMinTableWidthPx={model.dynamicMinTableWidthPx}
        isToday={isToday}
        isGuideVisibleUntilCutoff={isGuideVisibleUntilCutoff}
        guideTotals={model.guideTotals}
        guideVsProductDailyTotalMismatch={{ byDate: {}, month: false }}
        guideScheduleData={model.guideScheduleData}
        selectedTeamMembers={model.selectedTeamMembers}
        cdlDriverEmailSet={cdlDriverEmailSet}
        cdlKoreanDriverEmailSet={cdlKoreanDriverEmailSet}
        scheduleGridLastDay={model.lastDay}
        firstDayOfMonth={model.firstDay}
        currentDate={model.firstDay.toDate()}
        tours={model.tours}
        reservations={model.reservations}
        teamMembers={teamMembers}
        productColors={productColors}
        defaultPresetIds={defaultPresetIds}
        products={products}
        airportPickupMemberIdSet={airportPickupMemberIdSet}
        airportSendingMemberIdSet={airportSendingMemberIdSet}
        getMultiDayTourDays={getMultiDayTourDays}
        scheduleInteractionDragging={false}
        hoveredGuideRow={hoveredGuideRow}
        setHoveredGuideRow={setHoveredGuideRow}
        moveTeamMember={noop}
        canEditTeamFromSchedule={false}
        openTeamEditFromSchedule={noop}
        isOffDate={isOffDate}
        dateNotes={dateNotes}
        highlightedDate={null}
        pendingOffScheduleChanges={pendingOffScheduleChanges}
        offSchedules={preview.offSchedules}
        offScheduleAssignmentCellClass={offScheduleAssignmentCellClass}
        openOffScheduleActionModal={noop}
        handleCreateOffSchedule={noop}
        draggedTour={null}
        draggedUnassignedTour={null}
        monthVehiclesWithColors={{ vehicleIdToColor: new Map() }}
        getColorFromClass={getColorFromClass}
        getBorderColorValue={getBorderColorValue}
        getTourBorderColor={getTourBorderColor}
        setDraggedRole={noop}
        handleDrop={noop}
        handleGuideScheduleDropZoneDragOver={noopDrag}
        handleGuideScheduleDropZoneDragLeave={noopDrag}
        handleGuideCellDrop={noop}
        handleDragStart={noop}
        handleAssignedTourDragEnd={noop}
        openTourDetailModal={openTourDetailModal}
        showGuideModalContent={showGuideModalContent}
        getTourSummary={getTourSummary}
        getGuideScheduleTourHoverText={hoverText}
        guideLanguageMismatchByTourId={guideLanguageMismatchByTourId}
        assignedTourConfirmationPulseByTourId={assignedTourConfirmationPulseByTourId}
        scheduleHealthProductCellAlerts={new Map()}
      />
    </div>
    </ScheduleTooltipZIndexContext.Provider>
  )
}
