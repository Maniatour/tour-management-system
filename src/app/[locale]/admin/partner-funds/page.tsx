'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import PartnerFundsManagement from '@/components/PartnerFundsManagement'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import { Users, Lock } from 'lucide-react'

export default function PartnerFundsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)

  // info@maniatour.com만 접근 가능
  useEffect(() => {
    if (!user?.email) {
      setLoading(false)
      return
    }
    
    const normalizedEmail = user.email.toLowerCase()
    const hasPermission = normalizedEmail === 'info@maniatour.com'
    setHasAccess(hasPermission)
    setLoading(false)
  }, [user?.email])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h1>
          <p className="text-gray-600 mb-6">이 페이지는 info@maniatour.com만 접근할 수 있습니다.</p>
          <button
            onClick={() => router.back()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-2 py-6 max-w-full">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex flex-wrap items-center gap-x-1">
            <AccountingTerm termKey="파트너">파트너</AccountingTerm>{' '}
            <AccountingTerm termKey="파트너자금">자금</AccountingTerm> 관리
          </h1>
        </div>
        <p className="text-gray-600">
          <AccountingTerm termKey="파트너">파트너</AccountingTerm> 간{' '}
          <AccountingTerm termKey="파트너자금">자금</AccountingTerm> 입출금 및 대출 관리를 합니다. 종합 리포트 ›{' '}
          <strong>
            <AccountingTerm termKey="명세대조">명세 대조</AccountingTerm>
          </strong>
          에서 개인 사용으로 표시하고 <AccountingTerm termKey="파트너">파트너</AccountingTerm>를 지정한 항목은 여기로{' '}
          <strong>
            <AccountingTerm termKey="출금">출금</AccountingTerm>
          </strong>
          이 자동 반영됩니다(회사·투어·예약 지출에서 개인+파트너 지정 시 동일).
        </p>
      </div>

      {/* 메인 컨텐츠 */}
      <PartnerFundsManagement />
    </div>
  )
}
