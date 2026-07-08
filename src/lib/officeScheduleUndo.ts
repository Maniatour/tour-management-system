export type SlotSnapshot = Map<string, { note: string | null }>

export const OFFICE_SCHEDULE_MAX_UNDO = 50

export function cloneSlotSnapshot(map: SlotSnapshot): SlotSnapshot {
  return new Map(map)
}

export function pushUndoSnapshot(stack: SlotSnapshot[], snapshot: SlotSnapshot): SlotSnapshot[] {
  const next = [...stack, cloneSlotSnapshot(snapshot)]
  if (next.length > OFFICE_SCHEDULE_MAX_UNDO) next.shift()
  return next
}
