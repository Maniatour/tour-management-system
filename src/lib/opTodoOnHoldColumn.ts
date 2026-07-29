/** op_todos.on_hold 컬럼 미적용 DB와의 호환 (마이그레이션 전 400 방지) */

export const OP_TODO_SELECT_WITHOUT_HOLD =
  'id,title,description,category,department,completed,completed_at,action_type,action_config,linked_hub_article_id,notify_enabled,notify_time,notify_weekday,notify_day_of_month,notify_month,next_notify_at,created_at'

export const OP_TODO_SELECT_WITH_HOLD =
  'id,title,description,category,department,completed,completed_at,on_hold,action_type,action_config,linked_hub_article_id,notify_enabled,notify_time,notify_weekday,notify_day_of_month,notify_month,next_notify_at,created_at'

let onHoldColumnAvailable: boolean | null = null

export function isOpTodoOnHoldFeatureEnabled(): boolean {
  return onHoldColumnAvailable !== false
}

export function getOpTodoSelectColumns(): string {
  return onHoldColumnAvailable === false ? OP_TODO_SELECT_WITHOUT_HOLD : OP_TODO_SELECT_WITH_HOLD
}

export function markOpTodoOnHoldColumnUnavailable(): void {
  onHoldColumnAvailable = false
}

export function markOpTodoOnHoldColumnAvailable(): void {
  onHoldColumnAvailable = true
}

export function isMissingOpTodoOnHoldColumnError(error: unknown): boolean {
  const message = [
    (error as { message?: string })?.message,
    (error as { details?: string })?.details,
    (error as { hint?: string })?.hint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!message) return false
  return (
    message.includes('on_hold') ||
    (message.includes('column') && message.includes('does not exist')) ||
    message.includes('could not find')
  )
}

export function withOpTodoOnHoldDefault<T extends { on_hold?: boolean | null }>(
  row: T
): T & { on_hold: boolean } {
  return { ...row, on_hold: row.on_hold === true }
}
