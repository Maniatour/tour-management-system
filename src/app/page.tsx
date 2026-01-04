'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    // PWA standalone 모드에서 실행 중이고, 저장된 채팅방 URL이 있으면 리다이렉트
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const savedUrl = localStorage.getItem('pwa_install_url')
      
      if (isStandalone && savedUrl && savedUrl.startsWith('/chat/')) {
        // 저장된 채팅방 URL로 리다이렉트
        router.replace(savedUrl)
        return
      }
    }
    
    // 기본적으로 홈페이지로 리다이렉트
    router.replace('/ko')
  }, [router])

  // 리다이렉트 중 로딩 표시
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
    </div>
  )
}
