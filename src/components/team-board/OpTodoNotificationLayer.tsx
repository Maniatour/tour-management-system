'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { Bell, Check, Clock } from 'lucide-react'
import {
  computeNextNotifyAtIso,
  type OpTodoNotifyCategory,
  type OpTodoNotifyScheduleInput,
} from '@/lib/opTodoSchedule'

dayjs.extend(utc)
dayjs.extend(timezone)
const TZ = 'Asia/Seoul'

export type OpTodoNotifyRow = {
  id: string
  title: string
  category: OpTodoNotifyCategory
  department: string
  completed: boolean
  notify_enabled: boolean | null
  notify_time: string | null
  notify_weekday: number | null
  notify_day_of_month: number | null
  notify_month: number | null
  next_notify_at: string | null
}

type SnoozeRow = {
  todo_id: string
  user_email: string
  suppress_until: string
}

type OpTodoNotificationLayerProps = {
  supabase: SupabaseClient
  userEmail: string | null | undefined
  audiences: ('office' | 'guide' | 'common')[]
  /** 완료·스누즈 후 목록 갱신 */
  onRefresh: () => void | Promise<void>
  pollMs?: number
}

function scheduleFromRow(row: OpTodoNotifyRow): OpTodoNotifyScheduleInput | null {
  if (!row.notify_time) return null
  return {
    category: row.category,
    notifyTime: row.notify_time,
    notifyWeekday: row.notify_weekday,
    notifyDayOfMonth: row.notify_day_of_month,
    notifyMonth: row.notify_month,
  }
}

export function OpTodoNotificationLayer({
  supabase,
  userEmail,
  audiences,
  onRefresh,
  pollMs = 25000,
}: OpTodoNotificationLayerProps) {
  const [stack, setStack] = useState<OpTodoNotifyRow[]>([])
  const stackRef = useRef<OpTodoNotifyRow[]>([])

  const audienceSet = useMemo(() => new Set(audiences), [audiences])
  const emailKey = (userEmail || '').toLowerCase()

  const refreshDue = useCallback(async () => {
    if (!emailKey) {
      if (stackRef.current.length === 0) {
        stackRef.current = []
        setStack([])
      }
      return
    }
    if (stackRef.current.length > 0) return

    const nowIso = new Date().toISOString()
    const { data: todos, error: tErr } = await supabase
      .from('op_todos')
      .select(
        'id,title,category,department,completed,notify_enabled,notify_time,notify_weekday,notify_day_of_month,notify_month,next_notify_at'
      )
      .eq('notify_enabled', true)
      .eq('completed', false)
      .not('next_notify_at', 'is', null)
      .lte('next_notify_at', nowIso)

    if (tErr) {
      console.error('OpTodoNotificationLayer fetch todos:', tErr)
      return
    }

    const rows = (todos || []) as OpTodoNotifyRow[]
    const scoped = rows.filter((r) => audienceSet.has(r.department as 'office' | 'guide' | 'common'))
    if (scoped.length === 0) {
      setStack([])
      return
    }

    const ids = scoped.map((r) => r.id)
    const { data: snz, error: sErr } = await supabase
      .from('op_todo_notify_snooze')
      .select('todo_id,user_email,suppress_until')
      .in('todo_id', ids)
      .eq('user_email', emailKey)

    if (sErr) console.error('OpTodoNotificationLayer snooze:', sErr)

    const snoozeByTodo = new Map<string, string>()
    for (const s of (snz || []) as SnoozeRow[]) {
      snoozeByTodo.set(s.todo_id, s.suppress_until)
    }

    const now = Date.now()
    const visible = scoped.filter((r) => {
      const until = snoozeByTodo.get(r.id)
      if (!until) return true
      return new Date(until).getTime() <= now
    })

    stackRef.current = visible
    setStack(visible)
  }, [supabase, emailKey, audienceSet])

  useEffect(() => {
    void refreshDue()
    const id = window.setInterval(() => void refreshDue(), pollMs)
    return () => window.clearInterval(id)
  }, [refreshDue, pollMs])

  const active = stack[0] ?? null

  const pop = useCallback(() => {
    setStack((s) => {
      const next = s.slice(1)
      stackRef.current = next
      return next
    })
  }, [])

  const upsertSnooze = async (until: Date) => {
    if (!active || !emailKey) return
    const { error } = await supabase.from('op_todo_notify_snooze').upsert(
      {
        todo_id: active.id,
        user_email: emailKey,
        suppress_until: until.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'todo_id,user_email' }
    )
    if (error) console.error('snooze upsert', error)
    pop()
    await Promise.resolve(onRefresh())
    void refreshDue()
  }

  const handleComplete = async () => {
    if (!active) return
    try {
      const sch = scheduleFromRow(active)
      const nextIso =
        sch && active.notify_enabled ? computeNextNotifyAtIso(sch, new Date()) : null
      const { error } = await supabase.rpc('op_todo_notify_handle_complete', {
        p_todo_id: active.id,
        p_next_notify_at: nextIso,
      })
      if (error) console.error('op_todo_notify_handle_complete', error)
      await supabase.from('op_todo_notify_snooze').delete().eq('todo_id', active.id).eq('user_email', emailKey)
    } catch (e) {
      console.error(e)
    } finally {
      pop()
      await Promise.resolve(onRefresh())
      void refreshDue()
    }
  }

  const labelCategory = (c: string) =>
    c === 'daily' ? '일일' : c === 'weekly' ? '주간' : c === 'monthly' ? '월간' : '연간'

  if (!active) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-amber-50 px-4 py-3">
          <Bell className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">체크리스트 알림</p>
            <p className="text-xs text-amber-800/80">{labelCategory(active.category)} · {active.department}</p>
          </div>
        </div>
        <div className="px-4 py-4 space-y-3">
          <p className="text-base font-medium text-gray-900 leading-snug">{active.title}</p>
          <p className="text-xs text-gray-500">
            예정 시각에 도래한 항목입니다. 처리 후 완료하거나, 나중에 다시 알림을 받을 수 있습니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3">
          <button
            type="button"
            onClick={() => void handleComplete()}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Check className="h-4 w-4" />
            처리 완료
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void upsertSnooze(new Date(Date.now() + 10 * 60 * 1000))}
              className="flex items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-800 hover:bg-gray-100"
            >
              <Clock className="h-3.5 w-3.5" />
              10분 후
            </button>
            <button
              type="button"
              onClick={() => void upsertSnooze(new Date(Date.now() + 60 * 60 * 1000))}
              className="flex items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-800 hover:bg-gray-100"
            >
              <Clock className="h-3.5 w-3.5" />
              1시간 후
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const t = active.notify_time || '09:00'
              const [hh, mm] = t.split(':').map((x) => parseInt(x, 10) || 0)
              const next = dayjs().tz(TZ).add(1, 'day').hour(hh).minute(mm).second(0).millisecond(0)
              void upsertSnooze(next.toDate())
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-100"
          >
            내일 같은 시각에 다시 알림
          </button>
        </div>
      </div>
    </div>
  )
}
