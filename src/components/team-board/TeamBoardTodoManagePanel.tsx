'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { computeNextNotifyAtIso } from '@/lib/opTodoSchedule'
import { OpTodoFormModal } from '@/components/admin/todo/OpTodoFormModal'
import { EMPTY_OP_TODO_FORM, type OpTodoFormValues } from '@/components/admin/todo/OpTodoFormFields'
import {
  getOpTodoActionLabel,
  normalizeOpTodoActionType,
  parseOpTodoActionConfig,
} from '@/lib/opTodoAction'

export type TeamBoardOpTodo = {
  id: string
  title: string
  description: string | null
  scope: 'common' | 'individual'
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
  department: 'office' | 'guide' | 'common'
  assigned_to: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  notify_enabled?: boolean | null
  notify_time?: string | null
  notify_weekday?: number | null
  notify_day_of_month?: number | null
  notify_month?: number | null
  next_notify_at?: string | null
  action_type?: string | null
  action_config?: Record<string, unknown> | null
  linked_hub_article_id?: string | null
}

function formatOpTodoNotifySchedule(todo: TeamBoardOpTodo): string {
  if (!todo.notify_enabled) return '-'
  const days = ['일', '월', '화', '수', '목', '금', '토']
  if (todo.category === 'daily') return '매일'
  if (todo.category === 'weekly') return `${days[todo.notify_weekday ?? 1]}요일`
  if (todo.category === 'monthly') return `매월 ${todo.notify_day_of_month ?? 1}일`
  return `${todo.notify_month ?? 1}월 ${todo.notify_day_of_month ?? 1}일`
}

function todoToFormValues(todo: TeamBoardOpTodo): OpTodoFormValues {
  return {
    title: todo.title,
    category: todo.category,
    department: todo.department,
    notify_enabled: !!todo.notify_enabled,
    notify_time: todo.notify_time || '09:00',
    notify_weekday: todo.notify_weekday ?? 1,
    notify_day_of_month: todo.notify_day_of_month ?? 1,
    notify_month: todo.notify_month ?? 1,
    action_type: normalizeOpTodoActionType(todo.action_type),
    action_config: parseOpTodoActionConfig(todo.action_config),
    linked_hub_article_id: todo.linked_hub_article_id ?? null,
  }
}

type TeamBoardTodoManagePanelProps = {
  locale: string
  manageOpen: boolean
  onManageClose: () => void
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  opTodos: TeamBoardOpTodo[]
  onTodosChange: (updater: (prev: TeamBoardOpTodo[]) => TeamBoardOpTodo[]) => void
  authEmail: string | null | undefined
  editTodoId?: string | null
  onEditTodoIdChange?: (id: string | null) => void
  /** 생성 모달 열 때 폼에 미리 채울 값 */
  createFormSeed?: Partial<OpTodoFormValues> | null
  onCreateFormSeedApplied?: () => void
}

export function TeamBoardTodoManagePanel({
  locale,
  manageOpen,
  onManageClose,
  createOpen,
  onCreateOpenChange,
  opTodos,
  onTodosChange,
  authEmail,
  editTodoId,
  onEditTodoIdChange,
  createFormSeed,
  onCreateFormSeedApplied,
}: TeamBoardTodoManagePanelProps) {
  const [newTodo, setNewTodo] = useState<OpTodoFormValues>({ ...EMPTY_OP_TODO_FORM })
  const [editingTodo, setEditingTodo] = useState<TeamBoardOpTodo | null>(null)
  const [editForm, setEditForm] = useState<OpTodoFormValues>({ ...EMPTY_OP_TODO_FORM })
  const [saving, setSaving] = useState(false)

  const closeCreate = useCallback(() => {
    onCreateOpenChange(false)
    setNewTodo({ ...EMPTY_OP_TODO_FORM })
  }, [onCreateOpenChange])

  const closeEdit = useCallback(() => {
    setEditingTodo(null)
    setEditForm({ ...EMPTY_OP_TODO_FORM })
    onEditTodoIdChange?.(null)
  }, [onEditTodoIdChange])

  const openCreate = useCallback(() => {
    setNewTodo({ ...EMPTY_OP_TODO_FORM })
    onCreateOpenChange(true)
  }, [onCreateOpenChange])

  const startEdit = useCallback((todo: TeamBoardOpTodo) => {
    setEditingTodo(todo)
    setEditForm(todoToFormValues(todo))
  }, [])

  useEffect(() => {
    if (!editTodoId) return
    const todo = opTodos.find((t) => t.id === editTodoId)
    if (todo) startEdit(todo)
  }, [editTodoId, opTodos, startEdit])

  useEffect(() => {
    if (!createOpen || !createFormSeed) return
    setNewTodo({ ...EMPTY_OP_TODO_FORM, ...createFormSeed })
    onCreateFormSeedApplied?.()
  }, [createOpen, createFormSeed, onCreateFormSeedApplied])

  const buildNotifyPayload = (form: OpTodoFormValues) => {
    const schedule = form.notify_enabled
      ? {
          category: form.category,
          notifyTime: form.notify_time,
          notifyWeekday: form.notify_weekday,
          notifyDayOfMonth: form.notify_day_of_month,
          notifyMonth: form.notify_month,
        }
      : null
    const nextNotify = schedule ? computeNextNotifyAtIso(schedule) : null
    return {
      notify_enabled: !!form.notify_enabled,
      notify_time: form.notify_enabled ? form.notify_time : null,
      notify_weekday: form.notify_enabled && form.category === 'weekly' ? form.notify_weekday : null,
      notify_day_of_month:
        form.notify_enabled && (form.category === 'monthly' || form.category === 'yearly')
          ? form.notify_day_of_month
          : null,
      notify_month: form.notify_enabled && form.category === 'yearly' ? form.notify_month : null,
      next_notify_at: form.notify_enabled ? nextNotify : null,
    }
  }

  const createTodo = async () => {
    if (!newTodo.title.trim() || !authEmail) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('op_todos')
        .insert([
          {
            title: newTodo.title.trim(),
            description: null,
            scope: 'common',
            category: newTodo.category,
            department: newTodo.department,
            assigned_to: null,
            created_by: authEmail,
            ...buildNotifyPayload(newTodo),
            action_type: newTodo.action_type,
            action_config: newTodo.action_config,
            linked_hub_article_id: newTodo.linked_hub_article_id,
          },
        ] as never[])
        .select()
        .single()
      if (error) throw error
      onTodosChange((prev) => [data as TeamBoardOpTodo, ...prev])
      closeCreate()
    } catch (e) {
      console.error(e)
      alert('ToDo 생성 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const updateTodo = async () => {
    if (!editingTodo || !editForm.title.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('op_todos')
        .update({
          title: editForm.title.trim(),
          category: editForm.category,
          department: editForm.department,
          ...buildNotifyPayload(editForm),
          action_type: editForm.action_type,
          action_config: editForm.action_config,
          linked_hub_article_id: editForm.linked_hub_article_id,
        } as never)
        .eq('id', editingTodo.id)
        .select()
        .single()
      if (error) throw error
      onTodosChange((prev) => prev.map((t) => (t.id === editingTodo.id ? (data as TeamBoardOpTodo) : t)))
      closeEdit()
    } catch (e) {
      console.error(e)
      alert('ToDo 수정 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const deleteTodo = async () => {
    if (!editingTodo) return
    if (!confirm('정말로 이 항목을 삭제하시겠습니까?')) return
    setSaving(true)
    try {
      const { error } = await supabase.from('op_todos').delete().eq('id', editingTodo.id)
      if (error) throw error
      onTodosChange((prev) => prev.filter((t) => t.id !== editingTodo.id))
      closeEdit()
    } catch (e) {
      console.error(e)
      alert('ToDo 삭제 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {manageOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Todo / Notification 관리</h3>
                <p className="mt-1 text-sm text-gray-500">
                  행을 클릭하면 수정 모달이 열립니다. 클릭 시 연결·알림 설정을 함께 편집할 수 있습니다.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-xs text-gray-500 sm:inline">
                  총 {opTodos.length}개 / 알림 {opTodos.filter((t) => t.notify_enabled).length}개
                </span>
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  새 항목 추가
                </button>
                <button
                  type="button"
                  onClick={onManageClose}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                  aria-label="닫기"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-[900px] w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Todo</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">부서</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">반복</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">클릭 연결</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">알림</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">날짜/요일</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">시간(KST)</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">다음 알림</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {opTodos.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">
                          등록된 Todo가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      opTodos.map((todo) => {
                        const actionType = normalizeOpTodoActionType(todo.action_type)
                        const actionConfig = parseOpTodoActionConfig(todo.action_config)
                        return (
                          <tr
                            key={todo.id}
                            onClick={() => startEdit(todo)}
                            className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                              todo.completed ? 'bg-gray-50' : ''
                            }`}
                          >
                            <td className="px-3 py-2.5 align-top">
                              <div
                                className={`font-medium ${
                                  todo.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                                }`}
                              >
                                {todo.title}
                              </div>
                              <div className="mt-0.5 text-xs text-gray-400">
                                작성: {new Date(todo.created_at).toLocaleDateString('ko-KR')}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                                {todo.department === 'office'
                                  ? 'Office'
                                  : todo.department === 'guide'
                                    ? 'Guide'
                                    : '공통'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <span className="rounded bg-primary/5 px-2 py-1 text-xs text-primary">
                                {todo.category === 'daily'
                                  ? '일일'
                                  : todo.category === 'weekly'
                                    ? '주간'
                                    : todo.category === 'monthly'
                                      ? '월간'
                                      : '연간'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 align-top text-xs text-gray-600">
                              {actionType === 'none' ? (
                                <span className="text-gray-400">없음</span>
                              ) : (
                                getOpTodoActionLabel(actionType, actionConfig, locale)
                              )}
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <span
                                className={`rounded px-2 py-1 text-xs ${
                                  todo.notify_enabled
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {todo.notify_enabled ? '보냄' : '안 보냄'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 align-top text-xs text-gray-500">
                              {formatOpTodoNotifySchedule(todo)}
                            </td>
                            <td className="px-3 py-2.5 align-top text-xs text-gray-600">
                              {todo.notify_enabled ? todo.notify_time || '09:00' : '-'}
                            </td>
                            <td className="px-3 py-2.5 align-top text-xs text-gray-500">
                              {todo.next_notify_at
                                ? new Date(todo.next_notify_at).toLocaleString('ko-KR')
                                : '-'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <OpTodoFormModal
        open={createOpen}
        mode="create"
        locale={locale}
        values={newTodo}
        onChange={setNewTodo}
        onClose={closeCreate}
        onSave={createTodo}
        saving={saving}
      />

      <OpTodoFormModal
        open={!!editingTodo}
        mode="edit"
        locale={locale}
        values={editForm}
        onChange={setEditForm}
        onClose={closeEdit}
        onSave={updateTodo}
        onDelete={deleteTodo}
        saving={saving}
      />
    </>
  )
}
