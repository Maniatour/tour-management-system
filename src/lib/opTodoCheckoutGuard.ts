import { supabase } from '@/lib/supabase'
import {
  isMissingOpTodoOnHoldColumnError,
  isOpTodoOnHoldFeatureEnabled,
  markOpTodoOnHoldColumnAvailable,
  markOpTodoOnHoldColumnUnavailable,
} from '@/lib/opTodoOnHoldColumn'
import { setOpTodoOnHold } from '@/lib/opTodoSetOnHold'
import type { OpTodoDepartment } from '@/lib/opTodoSchedule'

export type PendingOpTodoSummary = {
  id: string
  title: string
}

export type FetchPendingOpTodosOptions = {
  departments?: OpTodoDepartment[] | null
  limit?: number
}

/** 퇴근 전 확인용 — 완료되지 않았고 보류 중이 아닌 OP Todo 목록 */
export async function fetchPendingOpTodosForCheckout(
  options: FetchPendingOpTodosOptions = {}
): Promise<PendingOpTodoSummary[]> {
  const limit = options.limit ?? 50

  const runQuery = async (withOnHoldFilter: boolean) => {
    let query = supabase
      .from('op_todos')
      .select('id, title')
      .eq('completed', false)
      .order('category', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (withOnHoldFilter) {
      query = query.eq('on_hold', false)
    }

    if (options.departments?.length) {
      query = query.in('department', options.departments)
    }

    return query
  }

  let withOnHoldFilter = isOpTodoOnHoldFeatureEnabled()
  let { data, error } = await runQuery(withOnHoldFilter)

  if (error && withOnHoldFilter && isMissingOpTodoOnHoldColumnError(error)) {
    markOpTodoOnHoldColumnUnavailable()
    withOnHoldFilter = false
    ;({ data, error } = await runQuery(false))
  } else if (!error && withOnHoldFilter) {
    markOpTodoOnHoldColumnAvailable()
  }

  if (error) throw error
  return (data || []) as PendingOpTodoSummary[]
}

export type BulkHoldResult = {
  success: number
  failed: number
}

/** 미처리 OP Todo를 모두 보류 처리 */
export async function setAllOpTodosOnHold(todoIds: string[]): Promise<BulkHoldResult> {
  if (!todoIds.length) return { success: 0, failed: 0 }

  const results = await Promise.all(
    todoIds.map(async (id) => {
      const { error } = await setOpTodoOnHold(id, true)
      return !error
    })
  )

  return results.reduce<BulkHoldResult>(
    (acc, ok) => {
      if (ok) acc.success += 1
      else acc.failed += 1
      return acc
    },
    { success: 0, failed: 0 }
  )
}
