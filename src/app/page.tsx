'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClientSupabase } from '@/lib/supabase'
import { guidePreferredAppLocale } from '@/lib/guideLanguageDetection'

const PWA_SAVED_PATH_RE = /^\/(ko|en)\/guide(\/|$)/
const PWA_ADMIN_PATH_RE = /^\/(ko|en)\/admin(\/|$)/

export default function RootPage() {
  const router = useRouter()
  const { user, userRole, loading, isInitialized, isSimulating, simulatedUser } = useAuth()

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (typeof window === 'undefined') return

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const savedUrl = localStorage.getItem('pwa_install_url')

      // PWA 단독 실행: 설치 시점에 저장한 URL(채팅·가이드)로 복원
      if (isStandalone && savedUrl?.startsWith('/')) {
        if (
          savedUrl.startsWith('/chat/') ||
          PWA_SAVED_PATH_RE.test(savedUrl) ||
          PWA_ADMIN_PATH_RE.test(savedUrl)
        ) {
          if (!cancelled) router.replace(savedUrl)
          return
        }
      }

      if (!isInitialized || loading) return

      const effectiveUser = isSimulating && simulatedUser ? simulatedUser : user

      if (effectiveUser?.email && userRole === 'team_member') {
        const sb = createClientSupabase()
        const { data: row } = await sb
          .from('team')
          .select('languages')
          .eq('email', effectiveUser.email)
          .maybeSingle()
        if (cancelled) return
        const appLoc = guidePreferredAppLocale(row, effectiveUser.email)
        router.replace(`/${appLoc}/guide`)
        return
      }

      const pl = localStorage.getItem('preferred-locale')
      if (pl === 'en') {
        router.replace('/en')
        return
      }
      router.replace('/ko')
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [router, user, userRole, loading, isInitialized, isSimulating, simulatedUser])

  // 리다이렉트 중 로딩 표시
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
    </div>
  )
}
