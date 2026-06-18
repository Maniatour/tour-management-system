'use client'

import dynamic from 'next/dynamic'

const FloatingChatContainer = dynamic(
  () => import('@/components/FloatingChatContainer'),
  { ssr: false }
)

/** 채팅 창이 열릴 때만 무거운 FloatingChat·TourChatRoom 번들 로드 */
export default function LazyFloatingChatContainer() {
  return <FloatingChatContainer />
}
