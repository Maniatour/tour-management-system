'use client'

import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { resolveSiteAccessPersona } from '@/lib/site-access-persona'
import { isSuperAdminEmail } from '@/lib/superAdmin'
import { opTodoAudiencesForUser } from '@/lib/opTodoSchedule'
import { dispatchOpTodoRefresh } from '@/lib/opTodoRefresh'
import { OpTodoNotificationLayer } from '@/components/team-board/OpTodoNotificationLayer'

/** 모든 admin 페이지에서 체크리스트 알림 표시 (팀 게시판 전용 제거) */
export function AdminOpTodoNotificationLayer() {
  const { user, userRole, userPosition } = useAuth()

  const persona = useMemo(
    () =>
      resolveSiteAccessPersona({
        userRole,
        userPosition,
        isSuper: isSuperAdminEmail(user?.email),
        authUserEmail: user?.email,
      }),
    [userRole, userPosition, user?.email]
  )

  const visible = persona === 'op' || persona === 'office_manager' || persona === 'super'
  const viewAllOpTodos = persona === 'super'
  const audiences = useMemo(
    () => opTodoAudiencesForUser(userPosition, { viewAll: viewAllOpTodos }),
    [userPosition, viewAllOpTodos]
  )

  if (!visible || !user?.email) return null

  return (
    <OpTodoNotificationLayer
      supabase={supabase}
      userEmail={user.email}
      audiences={audiences}
      onRefresh={() => dispatchOpTodoRefresh()}
    />
  )
}
