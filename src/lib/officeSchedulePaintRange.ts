import { officeScheduleCellKey } from '@/lib/officeScheduleMonthDays'

/** 그리드 행 순서 (0=0~9 블록, 9~23=시간별) */
export const OFFICE_SCHEDULE_PAINT_HOUR_SLOTS = [
  0, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
] as const

export type PaintCellCoord = {
  date: string
  hourSlot: number
}

function hourSlotOrder(hourSlot: number): number {
  const idx = OFFICE_SCHEDULE_PAINT_HOUR_SLOTS.indexOf(
    hourSlot as (typeof OFFICE_SCHEDULE_PAINT_HOUR_SLOTS)[number]
  )
  return idx === -1 ? -1 : idx
}

/** 두 좌표 사이 사각형 영역의 모든 셀 (빠른 드래그 시 중간 셀 보간) */
export function cellsInPaintRectangle(
  from: PaintCellCoord,
  to: PaintCellCoord,
  dateStrings: string[]
): PaintCellCoord[] {
  const fromDateIdx = dateStrings.indexOf(from.date)
  const toDateIdx = dateStrings.indexOf(to.date)
  const fromHourIdx = hourSlotOrder(from.hourSlot)
  const toHourIdx = hourSlotOrder(to.hourSlot)

  if (fromDateIdx === -1 || toDateIdx === -1 || fromHourIdx === -1 || toHourIdx === -1) {
    return [to]
  }

  const minDateIdx = Math.min(fromDateIdx, toDateIdx)
  const maxDateIdx = Math.max(fromDateIdx, toDateIdx)
  const minHourIdx = Math.min(fromHourIdx, toHourIdx)
  const maxHourIdx = Math.max(fromHourIdx, toHourIdx)

  const cells: PaintCellCoord[] = []
  for (let di = minDateIdx; di <= maxDateIdx; di++) {
    const date = dateStrings[di]
    for (let hi = minHourIdx; hi <= maxHourIdx; hi++) {
      const hourSlot = OFFICE_SCHEDULE_PAINT_HOUR_SLOTS[hi]
      cells.push({ date, hourSlot })
    }
  }
  return cells
}

export function paintCellId(date: string, hourSlot: number): string {
  return officeScheduleCellKey(date, hourSlot)
}
