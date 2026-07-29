'use client'

import { useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAdminTodoOptional } from '@/contexts/AdminTodoContext'
import {
  normalizeOpTodoActionType,
  parseOpTodoActionConfig,
  type OpTodoWithAction,
} from '@/lib/opTodoAction'
import {
  isOpTodoNavigationAction,
  openOpTodoAdminFallback,
  runOpTodoNavigationAction,
} from '@/lib/opTodoRunNavigationAction'

export function opTodoHasAction(todo: OpTodoWithAction): boolean {
  return normalizeOpTodoActionType(todo.action_type) !== 'none'
}

export function useOpTodoActionClick(surface: 'admin' | 'guide') {
  const router = useRouter()
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'
  const adminTodo = useAdminTodoOptional()

  return useCallback(
    (todo: OpTodoWithAction) => {
      const actionType = normalizeOpTodoActionType(todo.action_type)
      if (actionType === 'none') return false

      const config = parseOpTodoActionConfig(todo.action_config)

      if (isOpTodoNavigationAction(actionType)) {
        runOpTodoNavigationAction(actionType, config, { locale, router, surface })
        return true
      }

      if (surface === 'admin' && adminTodo) {
        adminTodo.openTodoAction(todo)
        return true
      }

      if (surface === 'guide') {
        openOpTodoAdminFallback(actionType, config, locale)
        return true
      }

      return false
    },
    [adminTodo, locale, router, surface]
  )

}
