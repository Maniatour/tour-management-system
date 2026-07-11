import { cloneOffDayMap, type OffDayMap } from '@/lib/officeScheduleOffDays'

export type SlotSnapshot = Map<string, { note: string | null }>

export type ScheduleSnapshot = {
  slots: SlotSnapshot
  offDays: OffDayMap
}

export const OFFICE_SCHEDULE_MAX_UNDO = 50

export function cloneSlotSnapshot(map: SlotSnapshot): SlotSnapshot {
  return new Map(map)
}

export function cloneScheduleSnapshot(snapshot: ScheduleSnapshot): ScheduleSnapshot {
  return {
    slots: cloneSlotSnapshot(snapshot.slots),
    offDays: cloneOffDayMap(snapshot.offDays),
  }
}

export function pushUndoSnapshot(stack: SlotSnapshot[], snapshot: SlotSnapshot): SlotSnapshot[] {
  const next = [...stack, cloneSlotSnapshot(snapshot)]
  if (next.length > OFFICE_SCHEDULE_MAX_UNDO) next.shift()
  return next
}

export function pushScheduleUndoSnapshot(
  stack: ScheduleSnapshot[],
  snapshot: ScheduleSnapshot
): ScheduleSnapshot[] {
  const next = [...stack, cloneScheduleSnapshot(snapshot)]
  if (next.length > OFFICE_SCHEDULE_MAX_UNDO) next.shift()
  return next
}
