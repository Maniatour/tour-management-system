import type { DailyReportTodoMatrixStatus } from '@/lib/dailyReport/types'

export type DailyReportTodoClickAction = 'completed' | 'uncompleted'

export type DailyReportTodoClickLog = {
  todo_id: string
  user_email: string | null
  action: string
  timestamp: string | null
}

export type DailyReportTodoClickIndex = {
  lastActionByTodo: Map<string, DailyReportTodoClickAction>
  completersByTodo: Map<string, Set<string>>
  completedAtByTodoEmail: Map<string, Map<string, string>>
}

function isClickAction(action: string): action is DailyReportTodoClickAction {
  return action === 'completed' || action === 'uncompleted'
}

function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** 기간 내 클릭 로그를 시각 순으로 접어, 마지막 액션·직원별 완료 시각을 만든다. */
export function buildDailyReportTodoClickIndex(
  logs: DailyReportTodoClickLog[]
): DailyReportTodoClickIndex {
  const lastActionByTodo = new Map<string, DailyReportTodoClickAction>()
  const completersByTodo = new Map<string, Set<string>>()
  const completedAtByTodoEmail = new Map<string, Map<string, string>>()

  const sorted = [...logs].sort((a, b) => {
    const ta = a.timestamp || ''
    const tb = b.timestamp || ''
    if (ta !== tb) return compareIso(ta, tb)
    if (a.action === b.action) return 0
    if (a.action === 'uncompleted') return 1
    if (b.action === 'uncompleted') return -1
    return 0
  })

  for (const log of sorted) {
    if (!isClickAction(log.action)) continue
    const todoId = log.todo_id
    if (!todoId) continue
    const email = (log.user_email || '').trim().toLowerCase()

    lastActionByTodo.set(todoId, log.action)

    if (!email) continue

    const completers = completersByTodo.get(todoId) ?? new Set<string>()
    const byEmail = completedAtByTodoEmail.get(todoId) ?? new Map<string, string>()

    if (log.action === 'completed') {
      completers.add(email)
      if (log.timestamp) byEmail.set(email, log.timestamp)
    } else {
      completers.delete(email)
      byEmail.delete(email)
    }

    completersByTodo.set(todoId, completers)
    completedAtByTodoEmail.set(todoId, byEmail)
  }

  return { lastActionByTodo, completersByTodo, completedAtByTodoEmail }
}

export function isTodoHandledInPeriod(opts: {
  todoId: string
  lastActionByTodo: Map<string, DailyReportTodoClickAction>
  currentlyCompleted: boolean
  completedAt: string | null
  rangeStartIso: string
  rangeEndIso: string
}): boolean {
  const last = opts.lastActionByTodo.get(opts.todoId)
  if (last === 'completed') return true
  if (last === 'uncompleted') return false
  return Boolean(
    opts.currentlyCompleted &&
      opts.completedAt &&
      opts.completedAt >= opts.rangeStartIso &&
      opts.completedAt <= opts.rangeEndIso
  )
}

export function resolveDailyReportTodoMatrixStatus(opts: {
  hasQueue: boolean
  handledInPeriod: boolean
  onHold: boolean
}): DailyReportTodoMatrixStatus {
  if (opts.handledInPeriod) return 'completed'
  if (!opts.hasQueue) return 'na'
  if (opts.onHold) return 'on_hold'
  return 'pending'
}

export function latestIso(...values: Array<string | null | undefined>): string | null {
  let latest: string | null = null
  for (const value of values) {
    if (!value) continue
    if (!latest || value > latest) latest = value
  }
  return latest
}
