'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import PartnerFundsManagement from '@/components/PartnerFundsManagement'
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">파트너 자금 관리</h1>
        </div>
        <p className="text-gray-600">파트너 간 자금 입출금 및 대출 관리를 합니다.</p>
      </div>

      {/* 메인 컨텐츠 */}
      <PartnerFundsManagement />
    </div>
  )
}
