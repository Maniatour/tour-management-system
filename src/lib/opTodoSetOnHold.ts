import { supabase } from '@/lib/supabase'

export type OpTodoHoldResult = {
  id: string
  completed: boolean
  completed_at: string | null
  next_notify_at: string | null
  on_hold: boolean
}

/** 팀 멤버 — Todo 보류 설정/해제 (RLS 우회 RPC) */
export async function setOpTodoOnHold(
  todoId: string,
  onHold: boolean
): Promise<{ data: OpTodoHoldResult | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('op_todo_set_on_hold', {
    p_todo_id: todoId,
    p_on_hold: onHold,
  })

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return { data: data as OpTodoHoldResult | null, error: null }
}
