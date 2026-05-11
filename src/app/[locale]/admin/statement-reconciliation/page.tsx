'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Landmark, BarChart3, XCircle } from 'lucide-react'
import StatementReconciliationTab from '@/components/reports/StatementReconciliationTab'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const SUPER_ADMIN_EMAILS = ['info@maniatour.com', 'wooyong.shim09@gmail.com']

export default function StatementReconciliationPage() {
  const { authUser } = useAuth()
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'
  const [isSuper, setIsSuper] = useState(false)
  const [isCheckingPermission, setIsCheckingPermission] = useState(true)

  useEffect(() => {
    const checkPermission = async () => {
      if (!authUser?.email) {
        setIsCheckingPermission(false)
        return
      }
      const emailLower = authUser.email.toLowerCase().trim()
      if (SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === emailLower)) {
        setIsSuper(true)
        setIsCheckingPermission(false)
        return
      }

      try {
        const { data: teamData, error } = await supabase
          .from('team')
          .select('position')
          .eq('email', authUser.email)
          .eq('is_active', true)
          .maybeSingle()

        if (error || !teamData) {
          setIsSuper(false)
          setIsCheckingPermission(false)
          return
        }

        const position = String((teamData as { position?: string }).position ?? '')
          .toLowerCase()
          .trim()
        setIsSuper(position === 'super')
      } catch (e) {
        console.error('권한 체크 오류:', e)
        setIsSuper(false)
      } finally {
        setIsCheckingPermission(false)
      }
    }

    checkPermission()
  }, [authUser?.email])

  if (isCheckingPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!isSuper) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center max-w-md">
          <XCircle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-3 sm:mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">접근 권한이 없습니다</h2>
          <p className="text-sm sm:text-base text-gray-600">
            명세 대조 페이지는 Super 권한이 있는 사용자만 접근할 수 있습니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-none overflow-x-hidden pb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 border-b border-gray-200 pb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-800 shrink-0">
            <Landmark className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="group relative inline-block max-w-full">
              <h1
                className="text-xl sm:text-2xl font-bold text-gray-900 cursor-help"
                aria-describedby="statement-reconciliation-page-hint"
              >
                명세 대조
              </h1>
              <span id="statement-reconciliation-page-hint" className="sr-only">
                은행·카드 명세와 지출·입금을 맞춥니다. 예약 통계와는 별도 화면입니다.
              </span>
              <div
                role="tooltip"
                className="pointer-events-none absolute left-0 top-full z-50 mt-2 max-w-[min(100vw-2rem,22rem)] rounded-md bg-slate-900 px-3 py-2 text-xs leading-snug text-white shadow-lg opacity-0 transition-opacity duration-150 invisible group-hover:opacity-100 group-hover:visible"
              >
                은행·카드 명세와 지출·입금을 맞춥니다. 예약 통계와는 별도 화면입니다.
              </div>
            </div>
          </div>
        </div>
        <Link
          href={`/${locale}/admin/reservations/statistics`}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 shrink-0"
        >
          <BarChart3 className="h-4 w-4" aria-hidden />
          예약 통계 리포트
        </Link>
      </div>

      <StatementReconciliationTab />
    </div>
  )
}
