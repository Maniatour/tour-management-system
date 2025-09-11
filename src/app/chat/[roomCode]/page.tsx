'use client'

import { useParams } from 'next/navigation'
import TourChatRoom from '@/components/TourChatRoom'

export default function PublicChatPage() {
  const params = useParams()
  const roomCode = params.roomCode as string

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">K</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Kovegas 투어 채팅방</h1>
                <p className="text-sm text-gray-500">실시간 소통을 위한 채팅방입니다</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              방 코드: {roomCode}
            </div>
          </div>
        </div>
      </div>

      {/* 채팅방 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            <TourChatRoom
              tourId=""
              guideEmail=""
              isPublicView={true}
              roomCode={roomCode}
            />
          </div>
        </div>

        {/* 안내사항 */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">💬 채팅방 이용 안내</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 이 채팅방은 투어 관련 소통을 위한 공간입니다</li>
            <li>• 픽업 시간, 장소, 준비물 등에 대해 언제든지 문의하세요</li>
            <li>• 가이드가 실시간으로 답변을 드립니다</li>
            <li>• 투어 중 특별한 요청사항이 있으면 말씀해주세요</li>
            <li>• 예의를 지켜주시고, 불필요한 메시지는 자제해주세요</li>
          </ul>
        </div>

        {/* 연락처 정보 */}
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">📞 긴급 연락처</h3>
          <div className="text-sm text-gray-600">
            <p>채팅방에서 답변이 어려운 긴급한 상황이 있으시면:</p>
            <p className="mt-1 font-medium">📱 전화: +82-10-1234-5678</p>
            <p className="text-xs text-gray-500 mt-1">(한국 시간 기준 24시간 연락 가능)</p>
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div className="mt-12 bg-white border-t">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">K</span>
            </div>
            <span className="font-semibold text-gray-900">Kovegas</span>
          </div>
          <p className="text-sm text-gray-500">
            고품질 투어 서비스로 특별한 여행을 만들어드립니다
          </p>
        </div>
      </div>
    </div>
  )
}
