/**
 * Fixed daily todo panels: empty queue → auto complete;
 * actionable work appears → auto reopen (especially live intake panels).
 *
 * Panel-level 보류(onHold) is never auto-changed.
 */

export type TodoPanelAutoCompleteMode = 'live' | 'snapshot'

/** Panels that receive new work throughout the day (reservations, cancellations, etc.). */
export const TODO_PANEL_AUTO_COMPLETE_MODE = {
  'tour-envelope-print': 'snapshot',
  'pickup-notification': 'snapshot',
  'guide-schedule-confirm': 'snapshot',
  'customer-info-review': 'live',
  'cancel-rebooking-follow-up': 'live',
  'pending-customer-management': 'live',
  'ota-closure': 'snapshot',
  'tour-hotel-management': 'snapshot',
  'tour-hotel-price-check': 'snapshot',
  'tour-hotel-cc-form': 'live',
  'tour-settlement': 'snapshot',
  'reservation-agency-management': 'live',
  'antelope-canyon-booking': 'live',
  'bento-check': 'snapshot',
} as const satisfies Record<string, TodoPanelAutoCompleteMode>

export type TodoPanelAutoCompleteId = keyof typeof TODO_PANEL_AUTO_COMPLETE_MODE

export function getTodoPanelAutoCompleteMode(
  panelId: TodoPanelAutoCompleteId
): TodoPanelAutoCompleteMode {
  return TODO_PANEL_AUTO_COMPLETE_MODE[panelId]
}

/** Tours still pending (not completed, not on hold). */
export function todoPanelPendingTourCount(progress: {
  done: number
  onHold: number
  total: number
}): number {
  return Math.max(0, progress.total - progress.done - progress.onHold)
}

/**
 * Decide next panel completed flag.
 * - workCount === 0 → complete
 * - workCount > 0 → incomplete only when:
 *   - live initial reconcile (completed while away, work already waiting), or
 *   - queue transitioned from empty → nonempty (0 → N)
 * Manual complete with remaining work can stick until the queue goes empty again.
 */
export function resolveTodoPanelAutoComplete(input: {
  workCount: number
  completed: boolean
  onHold: boolean
  mode: TodoPanelAutoCompleteMode
  prevWorkCount: number | null
  /** First stable load after mount/enable — live panels may reopen once. */
  initialReconcile?: boolean
}): boolean | null {
  if (input.onHold) return null

  if (input.workCount === 0 && !input.completed) return true

  if (input.workCount > 0 && input.completed) {
    if (input.initialReconcile && input.mode === 'live') return false
    if (input.prevWorkCount === 0) return false
  }

  return null
}
