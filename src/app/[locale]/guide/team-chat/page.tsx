'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { MessageCircle, Plus, Settings, Pin, Search, X, Paperclip, Image, File, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import { useTranslations } from 'next-intl'

interface TeamChatRoom {
  id: string
  room_name: string
  room_type: 'general' | 'department' | 'project' | 'announcement'
  description?: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  last_message_at?: string
  unread_count: number
  participants_count: number
  team_chat_participants?: Array<{ count: number }>
  last_message?: {
    id: string
    message: string
    sender_name: string
    sender_position?: string
    created_at: string
  }
}

interface TeamChatMessage {
  id: string
  room_id: string
  sender_email: string
  sender_name: string
  sender_position?: string
  message: string
  message_type: 'text' | 'image' | 'file' | 'system' | 'announcement'
  file_url?: string
  file_name?: string
  file_size?: number
  file_type?: string
  is_pinned: boolean
  reply_to_id?: string
  reply_to_message?: {
    id: string
    message: string
    sender_name: string
  }
  created_at: string
  read_by: Array<{
    reader_email: string
    read_at: string
  }>
}

export default function GuideTeamChatPage() {
  const { user, simulatedUser, isSimulating } = useAuth()
  const t = useTranslations('teamChat')
  const [selectedRoom, setSelectedRoom] = useState<TeamChatRoom | null>(null)
  const [messages, setMessages] = useState<TeamChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [replyingTo, setReplyingTo] = useState<TeamChatMessage | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [newRoomData, setNewRoomData] = useState({
    room_name: '',
    room_type: 'general' as 'general' | 'department' | 'project' | 'announcement',
    description: '',
    participant_emails: [] as string[]
  })

  // 팀 채팅방 데이터 로딩
  const { data: chatRoomsData, loading, refetch: refetchChatRooms } = useOptimizedData<TeamChatRoom[]>({
    fetchFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          console.error('세션이 없습니다')
          return []
        }

        const headers: Record<string, string> = {
          'Authorization': `Bearer ${session.access_token}`
        }
        
        if (isSimulating && simulatedUser?.email) {
          headers['x-simulated-user-email'] = simulatedUser.email
        }

        const response = await fetch('/api/team-chat/rooms', {
          headers
        })
        
        const result = await response.json()
        console.log('채팅방 조회 응답:', result)

        if (result.error) {
          console.error('채팅방 조회 오류:', result.error)
          return []
        }

        const rooms = (result.rooms || []) as TeamChatRoom[]
        if (!rooms || rooms.length === 0) {
          return []
        }

        const roomsWithStats = await Promise.all(
          rooms.map(async (room) => {
            try {
              const { data: { session } } = await supabase.auth.getSession()
              let lastMessage = null
              
              if (session?.access_token) {
                try {
                  const response = await fetch(`/api/team-chat/last-message?room_id=${room.id}`, {
                    headers: {
                      'Authorization': `Bearer ${session.access_token}`
                    }
                  })

                  if (response.ok) {
                    const result = await response.json()
                    lastMessage = result.lastMessage
                  }
                } catch (error) {
                  console.error(`채팅방 ${room.id} 마지막 메시지 조회 오류:`, error)
                }
              }

              const unreadCount = 0

              return {
                ...room,
                last_message: lastMessage,
                unread_count: unreadCount,
                participants_count: room.team_chat_participants?.[0]?.count || 0
              }
            } catch (error) {
              console.error(`채팅방 ${room.id} 통계 계산 오류:`, error)
              return {
                ...room,
                last_message: null,
                unread_count: 0,
                participants_count: room.team_chat_participants?.[0]?.count || 0
              }
            }
          })
        )

        return roomsWithStats
      } catch (error) {
        console.error('Team chat room data loading error:', error)
        throw error
      }
    },
    dependencies: [user?.email]
  })

  // 메시지 로딩
  const loadMessages = useCallback(async (roomId: string) => {
    if (!roomId) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        return
      }

      const response = await fetch(`/api/team-chat/messages?room_id=${roomId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      const result = await response.json()
      console.log('메시지 조회 응답:', result)

      if (result.error) {
        console.error('Message loading error:', result.error)
        return
      }

      setMessages(result.messages || [])
    } catch (error) {
      console.error('Exception occurred while loading messages:', error)
    }
  }, [])

  // 메시지 전송
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || sending) return

    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        setSending(false)
        return
      }

      const messageData = {
        room_id: selectedRoom.id,
        message: newMessage.trim(),
        message_type: 'text',
        reply_to_id: replyingTo?.id || null
      }

      const response = await fetch('/api/team-chat/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(messageData)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('메시지 전송 HTTP 오류:', response.status, errorText)
        alert(`메시지 전송 실패: ${response.status} ${errorText}`)
        return
      }
      
      const result = await response.json()
      console.log('메시지 전송 응답:', result)

      if (result.error) {
        console.error('메시지 전송 오류:', result.error)
        alert(`메시지 전송 오류: ${result.error}`)
        return
      }

      setNewMessage('')
      setReplyingTo(null)
      await loadMessages(selectedRoom.id)
    } catch (error) {
      console.error('메시지 전송 오류:', error)
    } finally {
      setSending(false)
    }
  }

  // 채팅방 선택
  const selectRoom = async (room: TeamChatRoom) => {
    setSelectedRoom(room)
    await loadMessages(room.id)
  }

  // 메시지 새로고침
  const refreshMessages = useCallback(async () => {
    if (!selectedRoom) return
    
    setRefreshing(true)
    try {
      await loadMessages(selectedRoom.id)
    } finally {
      setRefreshing(false)
    }
  }, [selectedRoom, loadMessages])

  // 채팅방 생성
  const createRoom = async () => {
    if (!newRoomData.room_name.trim()) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        return
      }

      const response = await fetch('/api/team-chat/rooms', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(newRoomData)
      })
      
      const result = await response.json()
      console.log('채팅방 생성 응답:', result)

      if (result.error) {
        console.error('채팅방 생성 오류:', result.error)
        return
      }

      setShowCreateRoom(false)
      setNewRoomData({
        room_name: '',
        room_type: 'general',
        description: '',
        participant_emails: []
      })
      await refetchChatRooms()
    } catch (error) {
      console.error('채팅방 생성 오류:', error)
    }
  }

  const chatRooms = chatRoomsData || []

  // 필터링된 채팅방 목록
  const filteredRooms = chatRooms.filter(room => {
    const matchesSearch = room.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || room.room_type === filterType
    return matchesSearch && matchesType
  })

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    if (diffDays === 1) {
      return `어제 ${date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    }
    
    if (diffDays < 7) {
      return `${diffDays}일 전 ${date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    }
    
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[90vh]">
        <div className="text-gray-500">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="flex h-[90vh] bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* 왼쪽: 채팅방 목록 */}
      <div className={`${selectedRoom ? 'hidden lg:flex' : 'flex'} lg:w-80 w-full bg-white/80 backdrop-blur-sm border-r border-gray-200 flex-col shadow-lg`}>
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('title')}</h1>
              <p className="text-sm text-gray-500">{t('subtitle')}</p>
            </div>
            <button
              onClick={() => setShowCreateRoom(true)}
              className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="새 채팅방 만들기"
            >
              <Plus size={16} />
            </button>
          </div>
          
          {/* 검색 및 필터 */}
          <div className="space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('filterAll')}</option>
              <option value="general">{t('filterGeneral')}</option>
              <option value="department">{t('filterDepartment')}</option>
              <option value="project">{t('filterProject')}</option>
              <option value="announcement">{t('filterAnnouncement')}</option>
            </select>
          </div>
        </div>

        {/* 채팅방 목록 */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
              <p>{t('noRooms')}</p>
            </div>
          ) : (
            filteredRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => selectRoom(room)}
                className={`p-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedRoom?.id === room.id 
                    ? 'bg-blue-50 border-l-2 border-l-blue-500' 
                    : room.unread_count > 0 
                      ? 'bg-yellow-50 border-l-2 border-l-yellow-400' 
                      : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className={`text-xs truncate ${
                        room.unread_count > 0 
                          ? 'font-bold text-gray-900' 
                          : 'font-medium text-gray-900'
                      }`}>
                        {room.room_name}
                        {room.unread_count > 0 && ' • 새 메시지'}
                        {room.room_type === 'announcement' && (
                          <Pin size={10} className="inline ml-1 text-yellow-500" />
                        )}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        room.room_type === 'announcement' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : room.room_type === 'department'
                          ? 'bg-blue-100 text-blue-800'
                          : room.room_type === 'project'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {room.room_type === 'general' ? t('typeGeneral') :
                         room.room_type === 'department' ? t('typeDepartment') :
                         room.room_type === 'project' ? t('typeProject') :
                         room.room_type === 'announcement' ? t('typeAnnouncement') : room.room_type}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center">
                        <span className="truncate">
                          {room.description || t('participantsCount', { count: room.participants_count })}
                        </span>
                      </div>
                      {room.last_message && (
                        <span className="text-xs text-gray-400">
                          {formatTime(room.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    
                    {room.last_message && (
                      <p className="text-xs text-gray-600 truncate mt-1">
                        <span className="font-medium">{room.last_message.sender_name}:</span>
                        {room.last_message.message}
                      </p>
                    )}
                  </div>
                  
                  {room.unread_count > 0 && (
                    <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium ml-2">
                      {room.unread_count}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽: 채팅 영역 */}
      <div className={`${selectedRoom ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
        {selectedRoom ? (
          <>
            {/* 채팅방 헤더 */}
            <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2 lg:hidden">
                    <button
                      onClick={() => setSelectedRoom(null)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                      title={t('backToRoomList')}
                    >
                      ←
                    </button>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 truncate">
                    {selectedRoom.room_name}
                  </h2>
                  <p className="text-sm text-gray-500 truncate">
                    {selectedRoom.description || t('participantsCount', { count: selectedRoom.participants_count })}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={refreshMessages}
                    disabled={refreshing}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('refreshMessages')}
                  >
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-2 lg:p-4 space-y-3 lg:space-y-4 bg-gradient-to-b from-transparent to-green-50/30">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>{t('noMessages')}</p>
                  <p className="text-sm">{t('sendFirstMessage')}</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_email === user?.email ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`group max-w-xs lg:max-w-md px-3 lg:px-4 py-2 rounded-lg shadow-sm ${
                        message.sender_email === user?.email
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                          : message.message_type === 'system'
                          ? 'bg-gray-200/80 backdrop-blur-sm text-gray-700 text-center'
                          : 'bg-white/90 backdrop-blur-sm text-gray-900 border border-gray-200/50'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        <div className="flex-1">
                          {message.message_type !== 'system' && (
                            <div className="text-xs font-medium mb-1">
                              {message.sender_name}
                              {message.sender_position && (
                                <span className="text-gray-500 ml-1">({message.sender_position})</span>
                              )}
                            </div>
                          )}
                          <div className="text-sm">{message.message}</div>
                          
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-xs opacity-70">
                              {formatTime(message.created_at)}
                            </div>
                          </div>
                        </div>
                        {message.is_pinned && (
                          <Pin size={14} className="text-yellow-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 메시지 입력 */}
            <div className="bg-white/90 backdrop-blur-sm border-t border-gray-200 p-2 lg:p-4 flex-shrink-0 shadow-lg">
              <div className="flex items-center space-x-2 w-full">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder={t('messagePlaceholder')}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm lg:text-base"
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="flex-shrink-0 px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base"
                >
                  <span className="hidden lg:inline">{sending ? t('sending') : t('send')}</span>
                  <span className="lg:hidden">{sending ? '...' : t('send')}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MessageCircle size={64} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">{t('selectRoom')}</h3>
              <p>{t('selectRoomDescription')}</p>
            </div>
          </div>
        )}
      </div>

      {/* 채팅방 생성 모달 */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">{t('createRoom')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('roomName')}
                </label>
                <input
                  type="text"
                  value={newRoomData.room_name}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, room_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('roomNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('roomType')}
                </label>
                <select
                  value={newRoomData.room_type}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, room_type: e.target.value as 'general' | 'department' | 'project' | 'announcement' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="general">{t('typeGeneral')}</option>
                  <option value="department">{t('typeDepartment')}</option>
                  <option value="project">{t('typeProject')}</option>
                  <option value="announcement">{t('typeAnnouncement')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('description')}
                </label>
                <textarea
                  value={newRoomData.description}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder={t('descriptionPlaceholder')}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowCreateRoom(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={createRoom}
                disabled={!newRoomData.room_name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
