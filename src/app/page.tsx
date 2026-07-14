'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClientSupabase } from '@/lib/supabase'
import { guidePreferredAppLocale } from '@/lib/guideLanguageDetection'
import { isSafePwaStartPath, persistPwaStartPath } from '@/lib/pwaStartUrl'

const ROOT_REDIRECT_FAILSAFE_MS = 12_000

export default function RootPage() {
  const router = useRouter()
  const { user, userRole, loading, isInitialized, isSimulating, simulatedUser } = useAuth()

  useEffect(() => {
    let cancelled = false

    const redirectFailsafe = setTimeout(() => {
      if (cancelled) return
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const savedUrl = localStorage.getItem('pwa_install_url')
      if (isStandalone && savedUrl && isSafePwaStartPath(savedUrl)) {
        router.replace(savedUrl)
        return
      }
      // 가이드용 PWA인데 저장 경로가 없으면 가이드 홈으로
      if (isStandalone) {
        router.replace('/ko/guide')
        return
      }
      const pl = localStorage.getItem('preferred-locale')
      router.replace(pl === 'en' ? '/en' : '/ko')
    }, ROOT_REDIRECT_FAILSAFE_MS)

    const run = async () => {
      if (typeof window === 'undefined') return

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const savedUrl = localStorage.getItem('pwa_install_url')

      // PWA 단독 실행: 설치 시점에 저장한 URL(채팅·가이드)로 복원
      if (isStandalone && savedUrl && isSafePwaStartPath(savedUrl)) {
        persistPwaStartPath(savedUrl)
        if (!cancelled) router.replace(savedUrl)
        return
      }

      // 기존 바로가기(start_url `/`) + 저장 URL 없음 → 가이드 앱으로
      if (isStandalone) {
        if (!cancelled) router.replace('/ko/guide')
        return
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
      clearTimeout(redirectFailsafe)
    }
  }, [router, user, userRole, loading, isInitialized, isSimulating, simulatedUser])

  // 리다이렉트 중 로딩 표시
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>
  )
}
