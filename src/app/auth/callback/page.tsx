'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'
import { getUserRole } from '@/lib/roles'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = createClientSupabase()
      
      console.log('Auth callback page loaded')
      
      try {
        const { data, error } = await supabase.auth.getSession()
        
        console.log('Auth callback session check:', { 
          hasSession: !!data.session, 
          hasUser: !!data.session?.user,
          userEmail: data.session?.user?.email,
          error 
        })
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push('/auth?error=callback_error')
          return
        }

        if (data.session) {
          console.log('Auth callback successful, redirecting to admin page')
          // URL에서 locale 추출
          const currentPath = window.location.pathname
          const pathSegments = currentPath.split('/').filter(Boolean)
          const locale = pathSegments[0] || 'ko'
          router.push(`/${locale}/admin`)
        } else {
          console.log('No session found, redirecting to auth page')
          // URL에서 locale 추출
          const currentPath = window.location.pathname
          const pathSegments = currentPath.split('/').filter(Boolean)
          const locale = pathSegments[0] || 'ko'
          router.push(`/${locale}/auth`)
        }
      } catch (err) {
        console.error('Unexpected error:', err)
        router.push('/auth?error=unexpected_error')
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
