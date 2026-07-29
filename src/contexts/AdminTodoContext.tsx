'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { OpTodoActionConfig, OpTodoActionType, OpTodoWithAction } from '@/lib/opTodoAction'
import { normalizeOpTodoActionType, parseOpTodoActionConfig } from '@/lib/opTodoAction'

export type AdminTodoActiveAction = {
  todoId: string
  todoTitle: string
  actionType: OpTodoActionType
  actionConfig: OpTodoActionConfig
}

type AdminTodoContextValue = {
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  activeAction: AdminTodoActiveAction | null
  openTodoAction: (todo: OpTodoWithAction) => void
  closeTodoAction: () => void
}

const AdminTodoContext = createContext<AdminTodoContextValue | null>(null)

export function AdminTodoProvider({ children }: { children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeAction, setActiveAction] = useState<AdminTodoActiveAction | null>(null)

  const openTodoAction = useCallback((todo: OpTodoWithAction) => {
    const actionType = normalizeOpTodoActionType(todo.action_type)
    if (actionType === 'none') return
    setActiveAction({
      todoId: todo.id,
      todoTitle: todo.title,
      actionType,
      actionConfig: parseOpTodoActionConfig(todo.action_config),
    })
  }, [])

  const closeTodoAction = useCallback(() => setActiveAction(null), [])

  const value = useMemo(
    () => ({
      panelOpen,
      setPanelOpen,
      activeAction,
      openTodoAction,
      closeTodoAction,
    }),
    [panelOpen, activeAction, openTodoAction, closeTodoAction]
  )

  return <AdminTodoContext.Provider value={value}>{children}</AdminTodoContext.Provider>
}

export function useAdminTodo() {
  const ctx = useContext(AdminTodoContext)
  if (!ctx) throw new Error('useAdminTodo must be used within AdminTodoProvider')
  return ctx
}

export function useAdminTodoOptional() {
  return useContext(AdminTodoContext)
}
