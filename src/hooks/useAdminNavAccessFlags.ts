'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { isManagerTeamPosition } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { isSuperAdminEmail } from '@/lib/superAdmin'

/**
 * 사이드바·사이트 디렉터리와 동일 기준: Super(이메일 또는 team.position) 및 예약 통계(Super·Office Manager).
 */
export function useAdminNavAccessFlags() {
  const { authUser } = useAuth()
  const [isSuper, setIsSuper] = useState(false)
  const [canAccessReservationStatistics, setCanAccessReservationStatistics] = useState(false)

  useEffect(() => {
    const checkSuperPermission = async () => {
      if (!authUser?.email) {
        setIsSuper(false)
        setCanAccessReservationStatistics(false)
        return
      }

      if (isSuperAdminEmail(authUser.email)) {
        setIsSuper(true)
        setCanAccessReservationStatistics(true)
        return
      }

      try {
        const executeQuery = async (retries = 3): Promise<{ data: unknown; error: unknown }> => {
          try {
            return await supabase
              .from('team')
              .select('position')
              .eq('email', authUser.email)
              .eq('is_active', true)
              .maybeSingle()
          } catch (error) {
            if (
              retries > 0 &&
              error instanceof Error &&
              (error.message.includes('Failed to fetch') ||
                error.message.includes('ERR_CONNECTION_CLOSED') ||
                error.message.includes('ERR_QUIC_PROTOCOL_ERROR') ||
                error.message.includes('network'))
            ) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - retries)))
              return executeQuery(retries - 1)
            }
            throw error
          }
        }

        const { data: teamData, error } = await executeQuery()

        if (error || !teamData) {
          setIsSuper(false)
          setCanAccessReservationStatistics(false)
          return
        }

        const position = String((teamData as { position?: string }).position ?? '')
          .toLowerCase()
          .trim()
        const posSuper = position === 'super'
        const posManager = isManagerTeamPosition((teamData as { position?: string }).position)
        setIsSuper(posSuper)
        setCanAccessReservationStatistics(posSuper || posManager)
      } catch (error) {
        console.error('Super 권한 체크 오류:', error)
        setIsSuper(false)
        setCanAccessReservationStatistics(false)
      }
    }

    checkSuperPermission()
  }, [authUser?.email])

  return { isSuper, canAccessReservationStatistics }
}
