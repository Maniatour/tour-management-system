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
      
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push('/auth?error=callback_error')
          return
        }

        if (data.session) {
          // 사용자 역할 확인
          const email = data.session.user.email
          if (email) {
            try {
              // 팀 테이블에서 사용자 정보 조회
              const { data: teamData } = await supabase
                .from('team')
                .select('*')
                .eq('email', email)
                .eq('is_active', true)
                .single()

              const userRole = getUserRole(email, teamData)
              
              // 역할에 따라 리다이렉트
              if (userRole && userRole !== 'customer') {
                console.log('Redirecting admin user to admin page:', userRole)
                router.push('/ko/admin')
              } else {
                console.log('Redirecting customer to home page')
                router.push('/ko')
              }
            } catch (roleError) {
              console.error('Error checking user role:', roleError)
              // 역할 확인 실패 시 기본적으로 홈으로
              router.push('/ko')
            }
          } else {
            router.push('/ko')
          }
        } else {
          router.push('/auth')
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
