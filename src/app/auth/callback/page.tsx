'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback: Handling OAuth callback')
        
        // URL에서 locale 추출
        const currentPath = window.location.pathname
        let locale = 'ko' // 기본값
        if (currentPath.startsWith('/ko/')) {
          locale = 'ko'
        } else if (currentPath.startsWith('/en/')) {
          locale = 'en'
        } else if (currentPath.startsWith('/ja/')) {
          locale = 'ja'
        }
        
        console.log('Auth callback: Detected locale:', locale)
        
        // Supabase가 자동으로 URL의 토큰을 처리하도록 함
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback: Error getting session:', error)
          router.replace(`/${locale}/auth?error=session_error`)
          return
        }
        
        if (data.session?.user) {
          console.log('Auth callback: User authenticated:', data.session.user.email)
          
          // 가이드인지 확인하고 선호 언어로 리다이렉트
          try {
            const { data: teamData, error: teamError } = await supabase
              .from('team')
              .select('position, languages')
              .eq('email', data.session.user.email)
              .eq('is_active', true)
              .single()

            if (!teamError && teamData) {
              const position = teamData.position?.toLowerCase() || ''
              const isGuide = position.includes('guide') || position.includes('tour guide') || position.includes('tourguide')
              
              if (isGuide && teamData.languages && Array.isArray(teamData.languages) && teamData.languages.length > 0) {
                const firstLanguage = teamData.languages[0]
                let preferredLocale = 'ko' // 기본값
                
                // 언어 코드를 locale로 변환
                switch (firstLanguage.toUpperCase()) {
                  case 'KR':
                  case 'KO':
                    preferredLocale = 'ko'
                    break
                  case 'EN':
                    preferredLocale = 'en'
                    break
                  case 'JP':
                  case 'JA':
                    preferredLocale = 'ja'
                    break
                  case 'CN':
                  case 'ZH':
                    preferredLocale = 'zh'
                    break
                  default:
                    preferredLocale = 'ko'
                }
                
                console.log('Auth callback: Guide detected, redirecting to preferred language:', preferredLocale)
                router.replace(`/${preferredLocale}/guide`)
                return
              }
            }
          } catch (error) {
            console.error('Auth callback: Error checking guide language:', error)
          }
          
          // 가이드가 아니거나 언어 정보가 없는 경우 기본 리다이렉트
          setTimeout(() => {
            router.replace(`/${locale}`)
          }, 100)
        } else {
          console.log('Auth callback: No session found')
          router.replace(`/${locale}/auth?error=no_session`)
        }
      } catch (error) {
        console.error('Auth callback: Unexpected error:', error)
        router.replace(`/ko/auth?error=unexpected_error`)
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  )
}