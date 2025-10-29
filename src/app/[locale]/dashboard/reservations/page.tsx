'use client'

import React, { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

export default function ReservationsRedirect() {
  const { user, simulatedUser, isSimulating } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const t = useTranslations('common')

  useEffect(() => {
    const redirectToCustomerReservations = async () => {
      // 현재 사용자 확인 (시뮬레이션 상태 우선)
      const currentUser = isSimulating ? simulatedUser : user
      
      if (!currentUser) {
        console.log('No user found, redirecting to login')
        router.push(`/${locale}/auth`)
        return
      }

      try {
        // 고객 정보 조회 (이메일 기반)
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .eq('email', currentUser.email)
          .single()

        if (customerError) {
          console.error('Customer lookup error:', customerError)
          router.push(`/${locale}/`)
          return
        }

        if (customerData && typeof customerData === 'object' && 'id' in customerData) {
          // 고객별 예약 목록 페이지로 리다이렉트
          const customerId = (customerData as { id: string }).id
          router.push(`/${locale}/dashboard/reservations/${customerId}`)
        } else {
          // 고객 정보가 없으면 홈으로 리다이렉트
          router.push(`/${locale}/`)
        }
      } catch (error) {
        console.error('Error during redirect:', error)
        router.push(`/${locale}/`)
      }
    }

    redirectToCustomerReservations()
  }, [user, simulatedUser, isSimulating, router, locale])

  // 리다이렉트 중 로딩 표시
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{t('redirectingToReservations')}</p>
      </div>
    </div>
  )
}