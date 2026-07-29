import { supabase } from '@/lib/supabase'
import { computeNextNotifyAtIso, type OpTodoNotifyCategory } from '@/lib/opTodoSchedule'

export type OpTodoToggleTarget = {
  id: string
  category: OpTodoNotifyCategory | string
  notify_enabled?: boolean | null
  notify_time?: string | null
  notify_weekday?: number | null
  notify_day_of_month?: number | null
  notify_month?: number | null
}

export type OpTodoToggleResult = {
  id: string
  completed: boolean
  completed_at: string | null
  next_notify_at: string | null
  on_hold?: boolean
}

function nextNotifyAtForComplete(todo: OpTodoToggleTarget): string | null {
  if (!todo.notify_enabled || !todo.notify_time) return null
  const category = todo.category
  if (category !== 'daily' && category !== 'weekly' && category !== 'monthly' && category !== 'yearly') {
    return null
  }
  return computeNextNotifyAtIso({
    category,
    notifyTime: todo.notify_time,
    notifyWeekday: todo.notify_weekday ?? null,
    notifyDayOfMonth: todo.notify_day_of_month ?? null,
    notifyMonth: todo.notify_month ?? null,
  })
}

export function mergeOpTodoAfterToggle<T extends OpTodoToggleTarget & { next_notify_at?: string | null; on_hold?: boolean | null }>(
  todo: T,
  data: OpTodoToggleResult | null | undefined,
  completed: boolean
): T {
  return {
    ...todo,
    completed: data?.completed ?? completed,
    completed_at: data?.completed_at ?? (completed ? new Date().toISOString() : null),
    next_notify_at: data?.next_notify_at ?? todo.next_notify_at ?? null,
    on_hold: data?.on_hold ?? todo.on_hold ?? false,
  }
}

export async function toggleOpTodoCompletion(
  todo: OpTodoToggleTarget,
  completed: boolean
): Promise<{ data: OpTodoToggleResult | null; error: Error | null }> {
  const p_next_notify_at = completed ? nextNotifyAtForComplete(todo) : null

  const { data, error } = await supabase.rpc('op_todo_toggle_completion', {
    p_todo_id: todo.id,
    p_completed: completed,
    p_next_notify_at,
  })

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  const row = data as OpTodoToggleResult | null
  return { data: row, error: null }
}
