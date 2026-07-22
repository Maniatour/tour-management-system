import fs from 'fs'

const path = 'src/components/ScheduleView.tsx'
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/)
const start = 7079
const end = 7957
const body = lines.slice(start, end + 1).join('\n')

const header = `'use client'

import type { DragEvent } from 'react'
import dayjs from 'dayjs'
import { ChevronUp, ChevronDown } from 'lucide-react'
import {
  getScheduleColorRowKeyForProductId,
  getScheduleProductColorForProductId,
} from '@/lib/scheduleAirportPickDropGroup'
import type {
  ScheduleGuideDailyData,
  ScheduleGuideScheduleRow,
  ScheduleGuideDayTotal,
  ScheduleGuideVsProductMismatch,
  ScheduleGuideVehicleColors,
  ScheduleMonthDayCell,
} from '@/lib/scheduleGuideGridTypes'

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
  getMultiDayTourDays: (productId: string | null | undefined) => number
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
  draggedTour: Tour | null
  draggedUnassignedTour: Tour | null
  monthVehiclesWithColors: ScheduleGuideVehicleColors
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
    draggedTour,
    draggedUnassignedTour,
    monthVehiclesWithColors,
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

  return (
    <>
`

const footer = `
    </>
  )
}
`

fs.writeFileSync('src/components/schedule/ScheduleGuideGrid.tsx', header + body + footer, 'utf8')
console.log('ScheduleGuideGrid.tsx written')
