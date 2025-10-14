'use client'

import React, { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function GuideTeamChatRoomPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.id as string

  useEffect(() => {
    // 특정 채팅방으로 리다이렉트
    if (roomId) {
      router.replace(`/guide/team-chat?room=${roomId}`)
    } else {
      router.replace('/guide/team-chat')
    }
  }, [router, roomId])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">채팅방으로 이동 중...</p>
      </div>
    </div>
  )
}
