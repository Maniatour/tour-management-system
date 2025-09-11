'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, MessageCircle, Users, Globe } from 'lucide-react'
import Link from 'next/link'
import TourChatRoom from '@/components/TourChatRoom'
import { supabase } from '@/lib/supabase'

interface ChatRoom {
  id: string
  tour_id: string
  room_name: string
  room_code: string
  description?: string
  is_active: boolean
  created_by: string
  created_at: string
}

interface TourInfo {
  id: string
  product_id: string
  tour_date: string
  tour_status: string
}

export default function PublicChatPage({ params }: { params: { code: string } }) {
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [tourInfo, setTourInfo] = useState<TourInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')

  const { code } = params

  useEffect(() => {
    loadRoomInfo()
  }, [code])

  const loadRoomInfo = async () => {
    try {
      setLoading(true)
      setError(null)

      // 채팅방 정보 조회
      const { data: roomData, error: roomError } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          tours!inner(
            id,
            product_id,
            tour_date,
            tour_status
          )
        `)
        .eq('room_code', code)
        .eq('is_active', true)
        .single()

      if (roomError) throw roomError

      if (!roomData) {
        setError('채팅방을 찾을 수 없습니다. 링크가 만료되었거나 잘못된 링크입니다.')
        return
      }

      setRoom(roomData)
      setTourInfo(roomData.tours)
    } catch (error) {
      console.error('Error loading room info:', error)
      setError('채팅방을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinChat = () => {
    if (!customerName.trim()) {
      alert('이름을 입력해주세요.')
      return
    }
    // 채팅방에 참여 처리 (선택적)
    console.log('Customer joined chat:', customerName)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">채팅방을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            <MessageCircle size={64} className="mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">채팅방을 찾을 수 없습니다</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft size={16} className="mr-2" />
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  if (!room || !tourInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">채팅방 정보를 불러올 수 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={20} className="mr-2" />
                홈으로
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{room.room_name}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                  <div className="flex items-center">
                    <Globe size={16} className="mr-1" />
                    투어 날짜: {new Date(tourInfo.tour_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <Users size={16} className="mr-1" />
                    가이드와 소통
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 채팅방 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <MessageCircle size={20} className="text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">채팅방 안내</h3>
              <p className="text-sm text-blue-700 mt-1">
                이 채팅방은 투어 관련 소통을 위한 공간입니다. 
                픽업 시간, 장소, 특이사항 등에 대해 가이드와 실시간으로 소통할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 고객 이름 입력 (첫 방문 시) */}
        {!customerName && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">채팅방 참여</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이름을 입력해주세요
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="예: 김고객"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleJoinChat}
                disabled={!customerName.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                채팅방 참여하기
              </button>
            </div>
          </div>
        )}

        {/* 채팅방 */}
        {customerName && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MessageCircle size={20} className="text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">실시간 채팅</h3>
                    <p className="text-sm text-gray-500">
                      안녕하세요, {customerName}님! 가이드와 소통해보세요.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4">
              <TourChatRoom
                tourId={room.tour_id}
                guideEmail={room.created_by}
                isPublicView={true}
                roomCode={room.room_code}
              />
            </div>
          </div>
        )}

        {/* 사용 안내 */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">사용 안내</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 픽업 시간이나 장소에 대한 문의사항이 있으시면 언제든지 말씀해주세요.</li>
            <li>• 투어 중 특별한 요청사항이나 질문이 있으시면 실시간으로 소통할 수 있습니다.</li>
            <li>• 가이드가 답변을 드릴 때까지 잠시 기다려주세요.</li>
            <li>• 채팅방은 투어 종료 후에도 일정 기간 유지됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
