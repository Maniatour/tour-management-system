'use client'

import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { isManagerTeamPosition } from '@/lib/roles'
import { isSuperAdminActor } from '@/lib/superAdmin'

/**
 * 사이드바·사이트 디렉터리와 동일 기준: Super(이메일 또는 team.position) 및 예약 통계(Super·Office Manager).
 * AuthContext의 userPosition을 우선 사용해 별도 team 조회를 줄입니다.
 */
export function useAdminNavAccessFlags() {
  const { authUser, userPosition } = useAuth()

  return useMemo(() => {
    if (!authUser?.email) {
      return { isSuper: false, canAccessReservationStatistics: false }
    }

    const isSuper = isSuperAdminActor(authUser.email, userPosition)
    const posManager = isManagerTeamPosition(userPosition)
    const canAccessReservationStatistics = isSuper || posManager

    return { isSuper, canAccessReservationStatistics }
  }, [authUser?.email, userPosition])
}
