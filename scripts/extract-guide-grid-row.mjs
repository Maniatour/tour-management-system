import fs from 'fs'

const gridPath = new URL('../src/components/schedule/ScheduleGuideGrid.tsx', import.meta.url)
const lines = fs.readFileSync(gridPath, 'utf8').split(/\r?\n/)
const start = lines.findIndex((l) => l.includes('{Object.entries(guideScheduleData).map'))
let end = -1
for (let i = lines.length - 1; i > start; i--) {
  if (lines[i].trim() === '})}') {
    end = i
    break
  }
}
if (start < 0 || end < 0) {
  console.error('markers not found', start, end)
  process.exit(1)
}

const body = lines.slice(start + 1, end).map((line) => {
  if (line.startsWith('                ')) return `  ${line.slice(16)}`
  return line
})

const header = `'use client'

import type { DragEvent } from 'react'
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
import type { ScheduleGuideGridProps } from '@/components/schedule/ScheduleGuideGrid'

function tourMatchesScheduleDate(tour: Tour, dateString: string): boolean {
  return normalizeTourDateKey(tour.tour_date) === dateString
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tour = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reservation = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Product = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Team = any

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
    index,
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

`

const outPath = new URL('../src/components/schedule/ScheduleGuideGridRow.tsx', import.meta.url)
fs.writeFileSync(outPath, `${header}\n${body.join('\n')}\n}\n`)
console.log('wrote ScheduleGuideGridRow.tsx', body.length, 'lines')
