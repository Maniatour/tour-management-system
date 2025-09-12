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
  const [tempName, setTempName] = useState('')

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
        setError('Chat room not found. The link may have expired or is invalid.')
        return
      }

      setRoom(roomData)
      setTourInfo(roomData.tours)
    } catch (error) {
      console.error('Error loading room info:', error)
      setError('An error occurred while loading the chat room.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinChat = () => {
    const trimmedName = tempName.trim()
    
    if (!trimmedName) {
      alert('Please enter your name.')
      return
    }
    
    if (trimmedName.length < 2) {
      alert('Please enter a name with at least 2 characters.')
      return
    }
    
    // 임시 이름을 실제 이름으로 설정
    setCustomerName(trimmedName)
    console.log('Customer joined chat:', trimmedName)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleJoinChat()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat room...</p>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Chat Room Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  if (!room || !tourInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Unable to load chat room information.</p>
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
                Home
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{room.room_name}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                  <div className="flex items-center">
                    <Globe size={16} className="mr-1" />
                    Tour Date: {new Date(tourInfo.tour_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <Users size={16} className="mr-1" />
                    Chat with Guide
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
              <h3 className="font-semibold text-blue-900">Chat Room Information</h3>
              <p className="text-sm text-blue-700 mt-1">
                This chat room is for tour-related communication. 
                You can communicate with your guide in real-time about pickup times, locations, special requests, and more.
              </p>
            </div>
          </div>
        </div>

        {/* 고객 이름 입력 (첫 방문 시) */}
        {!customerName && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Join Chat Room</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Please enter your name
                </label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., John Smith"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleJoinChat}
                disabled={!tempName.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Chat Room
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
                    <h3 className="font-semibold text-gray-900">Live Chat</h3>
                    <p className="text-sm text-gray-500">
                      Hello, {customerName}! Chat with your guide here.
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
                customerName={customerName}
              />
            </div>
          </div>
        )}

        {/* 사용 안내 */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Usage Guide</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Feel free to ask about pickup times, locations, or any other questions.</li>
            <li>• You can communicate in real-time with your guide about special requests or questions during the tour.</li>
            <li>• Please wait a moment for your guide to respond.</li>
            <li>• The chat room will remain available for a certain period after the tour ends.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
