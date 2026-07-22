import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.join(__dirname, '../src/components/schedule/ScheduleGuideGrid.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split('\n')

const mapStart = lines.findIndex((l) => l.includes('{/* 각 가이드별 데이터 */}'))
let mapEnd = -1
for (let i = lines.length - 1; i > mapStart; i--) {
  if (lines[i].trim() === '})}' && lines[i + 1]?.trim() === '</tbody>') {
    mapEnd = i
    break
  }
}

if (mapStart < 0 || mapEnd < 0) {
  console.error('markers not found', { mapStart, mapEnd })
  process.exit(1)
}

const newImports = `'use client'

import { useMemo } from 'react'
import dayjs from 'dayjs'
import type {
  ScheduleGuideDayTotal,
  ScheduleGuideScheduleRow,
  ScheduleGuideVsProductMismatch,
  ScheduleMonthDayCell,
} from '@/lib/scheduleGuideGridTypes'
import { useScheduleGridWindowVirtualizer } from '@/hooks/useScheduleGridWindowVirtualizer'
import ScheduleGuideGridRow from '@/components/schedule/ScheduleGuideGridRow'
`

// Replace header through PendingOffChange type - find line after imports block
const headerEnd = lines.findIndex((l) => l.startsWith('export type ScheduleGuideGridProps'))
const oldHeader = lines.slice(0, headerEnd).join('\n')

// Find insertion point for virtualizer - after `} = props` and getProductDisplayProps line
const propsEnd = lines.findIndex((l) => l.trim() === 'const getProductDisplayProps = getScheduleProductDisplayProps')
const virtualizerBlock = `
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
`

const beforeMap = lines.slice(0, mapStart)
const afterTbody = lines.slice(mapEnd + 2) // skip `})}` and `</tbody>`

const replacement = [
  '              {/* 각 가이드별 데이터 */}',
  '            </tbody>',
  '            <tbody ref={guideRowsAnchorRef} className="divide-y divide-gray-200">',
  '              {renderGuideRows()}',
  '            </tbody>',
]

// Rebuild file
const propsSectionStart = lines.findIndex((l) => l.startsWith('export default function ScheduleGuideGrid'))
const propsSection = lines.slice(propsSectionStart, propsEnd + 1)

// Remove getProductDisplayProps line from props section end
const propsSectionClean = propsSection.filter(
  (l) => !l.includes('getProductDisplayProps'),
)

const middle = lines.slice(propsEnd + 1, mapStart)

const result = [
  newImports.trimEnd(),
  '',
  ...lines.slice(headerEnd, propsSectionStart),
  ...propsSectionClean,
  virtualizerBlock.trimEnd(),
  ...middle,
  ...replacement,
  ...afterTbody,
].join('\n')

fs.writeFileSync(filePath, result)
console.log('patched ScheduleGuideGrid.tsx', { mapStart, mapEnd, lines: result.split('\n').length })
