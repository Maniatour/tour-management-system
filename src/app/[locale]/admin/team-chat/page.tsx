'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, Plus, Settings, Pin, Search, X, Paperclip, Image, File, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import { translateText, detectLanguage } from '@/lib/translation'

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

interface TeamMember {
  email: string
  name_ko: string
  name_en?: string
  position: string
  avatar_url?: string
  is_active: boolean
}

export default function TeamChatPage() {
  const { user } = useAuth()
  const [selectedRoom, setSelectedRoom] = useState<TeamChatRoom | null>(null)
  const [messages, setMessages] = useState<TeamChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [showRoomSettings, setShowRoomSettings] = useState(false)
  const [replyingTo, setReplyingTo] = useState<TeamChatMessage | null>(null)
  const [settingsPositionTab, setSettingsPositionTab] = useState<string>('all')
  const [roomParticipants, setRoomParticipants] = useState<Array<{
    participant_email: string
    participant_name: string
    participant_position: string
    is_admin: boolean
  }>>([])
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [translating, setTranslating] = useState<Record<string, boolean>>({})
  const [uploading, setUploading] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [newRoomData, setNewRoomData] = useState({
    room_name: '',
    room_type: 'general' as 'general' | 'department' | 'project' | 'announcement',
    description: '',
    participant_emails: [] as string[]
  })
  const [selectedPositionTab, setSelectedPositionTab] = useState<string>('all')
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)

  // 안읽은 메시지 수 조회 함수
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        return
      }

      const response = await fetch('/api/team-chat/unread-count', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setTotalUnreadCount(result.unreadCount || 0)
      }
    } catch (error) {
      console.error('안읽은 메시지 수 조회 오류:', error)
    }
  }, [])

  // 팀 채팅방 데이터 로딩
  const { data: chatRoomsData, loading, refetch: refetchChatRooms } = useOptimizedData<TeamChatRoom[]>({
    fetchFn: async () => {
      try {
        // Supabase 세션에서 토큰 가져오기
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          console.error('세션이 없습니다')
          return []
        }

        const response = await fetch('/api/team-chat/rooms', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
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

        // 각 채팅방의 마지막 메시지와 읽지 않은 메시지 수 계산
        const roomsWithStats = await Promise.all(
          rooms.map(async (room) => {
            try {
              // 마지막 메시지 가져오기 (API 엔드포인트 사용)
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

              // 읽지 않은 메시지 수는 성능상 이유로 0으로 설정
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
        console.error('팀 채팅방 데이터 로딩 오류:', error)
        throw error
      }
    },
    dependencies: [user?.email]
  })

  // 메시지 로딩
  const loadMessages = useCallback(async (roomId: string) => {
    if (!roomId) return

    try {
      // Supabase 세션에서 토큰 가져오기
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
        console.error('메시지 로딩 오류:', result.error)
        return
      }

      setMessages(result.messages || [])
    } catch (error) {
      console.error('메시지 로딩 중 예외 발생:', error)
    }
  }, [])

  // 채팅방 데이터 로딩 후 안읽은 메시지 수 조회
  useEffect(() => {
    if (chatRoomsData && user?.email) {
      fetchUnreadCount()
    }
  }, [chatRoomsData, user?.email, fetchUnreadCount])

  // 실시간 메시지 수신을 위한 Supabase 구독
  useEffect(() => {
    if (!user?.email) return

    const channel = supabase
      .channel('team-chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_chat_messages'
        },
        (payload) => {
          console.log('새 메시지 수신:', payload)
          // 안읽은 메시지 수 업데이트
          fetchUnreadCount()
          
          // 현재 선택된 채팅방의 메시지 목록도 업데이트
          if (selectedRoom && payload.new.room_id === selectedRoom.id) {
            loadMessages(selectedRoom.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.email, selectedRoom, fetchUnreadCount, loadMessages])

  const chatRooms = chatRoomsData || []

  // 팀원 목록 로딩
  const { data: teamMembers } = useOptimizedData<TeamMember[]>({
    fetchFn: async () => {
      try {
        const { data, error } = await supabase
          .from('team')
          .select('email, name_ko, name_en, position, avatar_url, is_active')
          .eq('is_active', true)
          .order('name_ko')

        if (error) {
          console.error('팀원 목록 조회 오류:', error)
          // 에러가 발생해도 빈 배열을 반환하여 앱이 중단되지 않도록 함
          return []
        }
        return data || []
      } catch (error) {
        console.error('팀원 목록 로딩 오류:', error)
        // 에러가 발생해도 빈 배열을 반환하여 앱이 중단되지 않도록 함
        return []
      }
    }
  })

  // 팀원을 position별로 그룹화
  const groupedTeamMembers = teamMembers?.reduce((acc, member) => {
    const position = member.position || '기타'
    if (!acc[position]) {
      acc[position] = []
    }
    acc[position].push(member)
    return acc
  }, {} as Record<string, TeamMember[]>) || {}

  // position 목록 생성
  const positionTabs = [
    { key: 'all', label: '전체', count: teamMembers?.length || 0 },
    ...Object.keys(groupedTeamMembers).map(position => ({
      key: position,
      label: position,
      count: groupedTeamMembers[position].length
    }))
  ]

  // 선택된 탭에 따른 팀원 필터링
  const filteredTeamMembers = selectedPositionTab === 'all' 
    ? teamMembers || []
    : groupedTeamMembers[selectedPositionTab] || []

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

  // 메시지 전송
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || sending) return

    setSending(true)
    try {
      // Supabase 세션에서 토큰 가져오기
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
      
      console.log('메시지 전송 응답 상태:', response.status)
      
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
      // 메시지 목록만 새로고침 (전체 페이지 새로고침 방지)
      await loadMessages(selectedRoom.id)
      
      // 안읽은 메시지 수 업데이트
      await fetchUnreadCount()
    } catch (error) {
      console.error('메시지 전송 오류:', error)
    } finally {
      setSending(false)
    }
  }

  // 메시지 읽음 처리 함수
  const markMessagesAsRead = useCallback(async (roomId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token || !user?.email) {
        return
      }

      // 해당 채팅방의 모든 메시지 조회 (자신이 보낸 메시지 제외)
      const { data: allMessages, error: messagesError } = await supabase
        .from('team_chat_messages')
        .select('id')
        .eq('room_id', roomId)
        .neq('sender_email', user.email)

      if (messagesError) {
        console.error('메시지 조회 오류:', messagesError)
        return
      }

      if (!allMessages || allMessages.length === 0) {
        return
      }

      // 각 메시지에 대해 읽음 상태 확인
      const messageIds = allMessages.map(msg => msg.id)
      
      const { data: readStatuses, error: readError } = await supabase
        .from('team_chat_read_status')
        .select('message_id')
        .in('message_id', messageIds)
        .eq('reader_email', user.email)

      if (readError) {
        console.error('읽음 상태 조회 오류:', readError)
        return
      }

      // 읽은 메시지 ID 목록
      const readMessageIds = new Set(readStatuses?.map(status => status.message_id) || [])
      
      // 읽지 않은 메시지들만 읽음 처리
      const unreadMessages = allMessages.filter(msg => !readMessageIds.has(msg.id))

      if (unreadMessages.length > 0) {
        // 각 읽지 않은 메시지를 읽음 처리
        for (const message of unreadMessages) {
          try {
            await fetch('/api/team-chat/messages', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                action: 'mark_read',
                room_id: roomId,
                message_id: message.id,
                reader_email: user.email
              })
            })
          } catch (error) {
            console.error('메시지 읽음 처리 오류:', error)
          }
        }

        // 안읽은 메시지 수 다시 조회
        await fetchUnreadCount()
      }
    } catch (error) {
      console.error('메시지 읽음 처리 중 오류:', error)
    }
  }, [user?.email, fetchUnreadCount])

  // 채팅방 선택
  const selectRoom = async (room: TeamChatRoom) => {
    setSelectedRoom(room)
    await loadMessages(room.id)
    
    // 메시지 읽음 처리
    await markMessagesAsRead(room.id)
  }

  // 참여자 로드
  const loadRoomParticipants = async (roomId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        return
      }

      const response = await fetch(`/api/team-chat/participants?room_id=${roomId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      console.log('참여자 조회 응답 상태:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('참여자 조회 HTTP 오류:', response.status, errorText)
        return
      }
      
      const result = await response.json()
      console.log('참여자 조회 응답:', result)

      if (result.error) {
        console.error('참여자 조회 오류:', result.error)
        return
      }

      setRoomParticipants(result.participants || [])
    } catch (error) {
      console.error('참여자 로딩 중 예외 발생:', error)
    }
  }

  // 참여자 추가
  const addParticipant = async (roomId: string, email: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        return
      }

      const response = await fetch('/api/team-chat/participants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          room_id: roomId,
          participant_emails: [email]
        })
      })
      
      const result = await response.json()
      console.log('참여자 추가 응답:', result)

      if (result.error) {
        console.error('참여자 추가 오류:', result.error)
        return
      }

      // 참여자 목록 새로고침
      await loadRoomParticipants(roomId)
    } catch (error) {
      console.error('참여자 추가 중 예외 발생:', error)
    }
  }

  // 참여자 제거
  const removeParticipant = async (roomId: string, email: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        return
      }

      const response = await fetch(`/api/team-chat/participants?room_id=${roomId}&participant_email=${email}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      const result = await response.json()
      console.log('참여자 제거 응답:', result)

      if (result.error) {
        console.error('참여자 제거 오류:', result.error)
        return
      }

      // 참여자 목록 새로고침
      await loadRoomParticipants(roomId)
    } catch (error) {
      console.error('참여자 제거 중 예외 발생:', error)
    }
  }

  // 메시지 삭제
  const deleteMessage = async (messageId: string) => {
    if (!selectedRoom) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        return
      }

      const response = await fetch('/api/team-chat/messages', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ message_id: messageId })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('메시지 삭제 HTTP 오류:', response.status, errorText)
        alert(`메시지 삭제 실패: ${response.status} ${errorText}`)
        return
      }

      const result = await response.json()
      if (result.error) {
        console.error('메시지 삭제 오류:', result.error)
        alert(`메시지 삭제 오류: ${result.error}`)
        return
      }

      // 메시지 목록에서 삭제
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
    } catch (error) {
      console.error('메시지 삭제 중 예외 발생:', error)
      alert('메시지 삭제 중 오류가 발생했습니다')
    }
  }

  // 메시지 삭제 가능 여부 확인 (5분 이내)
  const canDeleteMessage = (createdAt: string) => {
    const messageTime = new Date(createdAt)
    const now = new Date()
    const diffMinutes = (now.getTime() - messageTime.getTime()) / (1000 * 60)
    return diffMinutes <= 5 // 5분 이내
  }

  // 메시지 번역
  const translateMessage = async (messageId: string, text: string) => {
    if (translations[messageId] || translating[messageId]) return

    setTranslating(prev => ({ ...prev, [messageId]: true }))

    try {
      const detectedLang = detectLanguage(text)
      const targetLang = detectedLang === 'ko' ? 'en' : 'ko'
      
      const result = await translateText(text, detectedLang, targetLang)
      
      setTranslations(prev => ({
        ...prev,
        [messageId]: result.translatedText
      }))
    } catch (error) {
      console.error('번역 중 예외 발생:', error)
      alert(`번역 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setTranslating(prev => ({ ...prev, [messageId]: false }))
    }
  }

  // 파일 업로드
  const handleFileUpload = async (file: File) => {
    if (!selectedRoom) return

    setUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('roomId', selectedRoom.id)

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      const result = await response.json()

      if (result.error) {
        console.error('파일 업로드 오류:', result.error)
        alert(`파일 업로드 실패: ${result.error}`)
        return
      }

      // 파일을 메시지로 전송
      await sendFileMessage(result.file)
    } catch (error) {
      console.error('파일 업로드 중 예외 발생:', error)
      alert('파일 업로드 중 오류가 발생했습니다')
    } finally {
      setUploading(false)
      setShowFileUpload(false)
    }
  }

  // 파일 메시지 전송
  const sendFileMessage = async (file: {
    name: string
    size: number
    type: string
    url: string
    path: string
  }) => {
    if (!selectedRoom) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('세션이 없습니다')
        return
      }

      const messageData = {
        room_id: selectedRoom.id,
        message: `📎 파일: ${file.name}`,
        message_type: 'file',
        file_url: file.url,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type
      }

      const response = await fetch('/api/team-chat/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(messageData)
      })
      
      const result = await response.json()

      if (result.error) {
        console.error('파일 메시지 전송 오류:', result.error)
        return
      }

      await loadMessages(selectedRoom.id)
    } catch (error) {
      console.error('파일 메시지 전송 중 예외 발생:', error)
    }
  }

  // 실시간 메시지 구독
  useEffect(() => {
    if (!selectedRoom) return

    const channel = supabase
      .channel(`team_chat_${selectedRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_chat_messages',
          filter: `room_id=eq.${selectedRoom.id}`
        },
        async (payload) => {
          const newMessage = payload.new as TeamChatMessage
          
          // 답글 정보가 있다면 가져오기
          if (newMessage.reply_to_id) {
            const { data: replyMessage } = await supabase
              .from('team_chat_messages')
              .select('id, message, sender_name')
              .eq('id', newMessage.reply_to_id)
              .single()
            
            if (replyMessage) {
              newMessage.reply_to_message = replyMessage
            }
          }

          // 읽음 상태 정보 가져오기
          const { data: readStatus } = await supabase
            .from('team_chat_read_status')
            .select('reader_email, read_at')
            .eq('message_id', newMessage.id)

          newMessage.read_by = readStatus || []

          setMessages(prev => [...prev, newMessage])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'team_chat_messages',
          filter: `room_id=eq.${selectedRoom.id}`
        },
        (payload) => {
          const updatedMessage = payload.new as TeamChatMessage
          setMessages(prev => 
            prev.map(msg => 
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedRoom, refetchChatRooms])

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

    // 오늘인 경우 시간만 표시
    if (diffDays === 0) {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    // 어제인 경우
    if (diffDays === 1) {
      return `어제 ${date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    }
    
    // 7일 이내인 경우
    if (diffDays < 7) {
      return `${diffDays}일 전 ${date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    }
    
    // 7일 이상인 경우 날짜와 시간 모두 표시
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }


  // 채팅방 생성
  const createRoom = async () => {
    if (!newRoomData.room_name.trim()) return

    try {
      // Supabase 세션에서 토큰 가져오기
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
      setSelectedPositionTab('all')
      // 채팅방 목록만 새로고침
      await refetchChatRooms()
    } catch (error) {
      console.error('채팅방 생성 오류:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[90vh]">
        <div className="text-gray-500">팀 채팅을 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="flex h-[90vh] bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* 왼쪽: 채팅방 목록 - 모바일에서는 숨김/표시 토글 */}
      <div className={`${selectedRoom ? 'hidden lg:flex' : 'flex'} lg:w-80 w-full bg-white/80 backdrop-blur-sm border-r border-gray-200 flex-col shadow-lg`}>
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">팀 채팅</h1>
              <p className="text-sm text-gray-500">팀원들과 소통하세요</p>
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
                placeholder="채팅방 검색..."
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
              <option value="all">전체</option>
              <option value="general">일반</option>
              <option value="department">부서</option>
              <option value="project">프로젝트</option>
              <option value="announcement">공지</option>
            </select>
          </div>
        </div>

        {/* 채팅방 목록 */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
              <p>채팅방이 없습니다</p>
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
                    {/* 채팅방 이름과 타입 */}
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
                        {room.room_type === 'general' ? '일반' :
                         room.room_type === 'department' ? '부서' :
                         room.room_type === 'project' ? '프로젝트' :
                         room.room_type === 'announcement' ? '공지' : room.room_type}
                      </span>
                    </div>
                    
                    {/* 설명과 참여자 수 */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center">
                        <span className="truncate">
                          {room.description || `${room.participants_count}명 참여`}
                        </span>
                      </div>
                      {room.last_message && (
                        <span className="text-xs text-gray-400">
                          {formatTime(room.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    
                    {/* 마지막 메시지 */}
                    {room.last_message && (
                      <p className="text-xs text-gray-600 truncate mt-1">
                        <span className="font-medium">{room.last_message.sender_name}:</span>
                        {room.last_message.message}
                      </p>
                    )}
                  </div>
                  
                  {/* 읽지 않은 메시지 수 */}
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

      {/* 오른쪽: 채팅 영역 - 모바일에서는 전체 화면 */}
      <div className={`${selectedRoom ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
        {selectedRoom ? (
          <>
            {/* 채팅방 헤더 */}
            <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {/* 모바일에서 뒤로가기 버튼 추가 */}
                  <div className="flex items-center space-x-2 mb-2 lg:hidden">
                    <button
                      onClick={() => setSelectedRoom(null)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                      title="채팅방 목록으로 돌아가기"
                    >
                      ←
                    </button>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 truncate">
                    {selectedRoom.room_name}
                  </h2>
                  <p className="text-sm text-gray-500 truncate">
                    {selectedRoom.description || `${selectedRoom.participants_count}명 참여`}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={refreshMessages}
                    disabled={refreshing}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="메시지 새로고침"
                  >
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={async () => {
                      setShowRoomSettings(true)
                      if (selectedRoom) {
                        await loadRoomParticipants(selectedRoom.id)
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    title="채팅방 설정"
                  >
                    <Settings size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-2 lg:p-4 space-y-3 lg:space-y-4 bg-gradient-to-b from-transparent to-green-50/30">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>아직 메시지가 없습니다</p>
                  <p className="text-sm">첫 메시지를 보내보세요!</p>
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
                      {message.reply_to_message && (
                        <div className="mb-2 p-2 bg-gray-200 rounded text-sm">
                          <p className="font-medium">{message.reply_to_message.sender_name}</p>
                          <p className="text-gray-600">{message.reply_to_message.message}</p>
                        </div>
                      )}
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
                          
                          {/* 파일 메시지 표시 */}
                          {message.message_type === 'file' && message.file_url && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                              <div className="flex items-center space-x-2">
                                {message.file_type?.startsWith('image/') ? (
                                  <Image size={20} className="text-blue-600" />
                                ) : (
                                  <File size={20} className="text-gray-600" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {message.file_name || '파일'}
                                  </p>
                                  {message.file_size && (
                                    <p className="text-xs text-gray-500">
                                      {(message.file_size / 1024).toFixed(1)} KB
                                    </p>
                                  )}
                                </div>
                                <a
                                  href={message.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  다운로드
                                </a>
                              </div>
                              {message.file_type?.startsWith('image/') && (
                                <div className="mt-2">
                                  <img
                                    src={message.file_url}
                                    alt={message.file_name || 'Uploaded image'}
                                    className="max-w-full h-auto max-h-64 rounded"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* 번역 버튼과 번역 결과 */}
                          {message.message_type === 'text' && (
                            <div className="mt-2">
                              <button
                                onClick={() => translateMessage(message.id, message.message)}
                                disabled={translating[message.id]}
                                className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                              >
                                {translating[message.id] ? '번역 중...' : '번역'}
                              </button>
                              
                              {translations[message.id] && (
                                <div className="mt-1 p-2 bg-blue-50 rounded text-xs text-blue-800">
                                  <span className="font-medium">번역: </span>
                                  {translations[message.id]}
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-xs opacity-70">
                              {formatTime(message.created_at)}
                            </div>
                            {message.sender_email === user?.email && canDeleteMessage(message.created_at) && (
                              <button
                                onClick={() => {
                                  if (confirm('이 메시지를 삭제하시겠습니까?')) {
                                    deleteMessage(message.id)
                                  }
                                }}
                                className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="메시지 삭제 (5분 이내만 가능)"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
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

            {/* 답글 표시 */}
            {replyingTo && (
              <div className="bg-gray-50 border-t border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{replyingTo.sender_name}</span>에게 답글
                    </p>
                    <p className="text-sm text-gray-500 truncate">{replyingTo.message}</p>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* 메시지 입력 */}
            <div className="bg-white/90 backdrop-blur-sm border-t border-gray-200 p-2 lg:p-4 flex-shrink-0 shadow-lg">
              <div className="flex items-center space-x-2 w-full">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm lg:text-base"
                  disabled={sending || uploading}
                />
                <button
                  onClick={() => setShowFileUpload(true)}
                  disabled={sending || uploading}
                  className="px-2 lg:px-3 py-2 text-gray-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="파일 첨부"
                >
                  <Paperclip size={18} className="lg:w-5 lg:h-5" />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending || uploading}
                  className="flex-shrink-0 px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base"
                >
                  <span className="hidden lg:inline">{sending ? '전송 중...' : uploading ? '업로드 중...' : '전송'}</span>
                  <span className="lg:hidden">{sending ? '...' : uploading ? '...' : '전송'}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MessageCircle size={64} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">채팅방을 선택하세요</h3>
              <p>왼쪽에서 채팅방을 선택하여 대화를 시작하세요</p>
            </div>
          </div>
        )}
      </div>

      {/* 채팅방 생성 모달 */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">새 채팅방 만들기</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  채팅방 이름
                </label>
                <input
                  type="text"
                  value={newRoomData.room_name}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, room_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="채팅방 이름을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  채팅방 유형
                </label>
                <select
                  value={newRoomData.room_type}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, room_type: e.target.value as 'general' | 'department' | 'project' | 'announcement' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="general">일반</option>
                  <option value="department">부서</option>
                  <option value="project">프로젝트</option>
                  <option value="announcement">공지</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명 (선택사항)
                </label>
                <textarea
                  value={newRoomData.description}
                  onChange={(e) => setNewRoomData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="채팅방 설명을 입력하세요"
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  참여자 선택 (선택사항)
                </label>
                
                {/* Position 탭 */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {positionTabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setSelectedPositionTab(tab.key)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedPositionTab === tab.key
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                {/* 선택된 팀원들 */}
                {newRoomData.participant_emails.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-600 mb-1">선택된 참여자:</div>
                    <div className="flex flex-wrap gap-1">
                      {newRoomData.participant_emails.map((email) => {
                        const member = teamMembers?.find(m => m.email === email)
                        return (
                          <span
                            key={email}
                            className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                          >
                            {member?.name_ko || email.split('@')[0]}
                            <button
                              onClick={() => {
                                setNewRoomData(prev => ({
                                  ...prev,
                                  participant_emails: prev.participant_emails.filter(e => e !== email)
                                }))
                              }}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 팀원 목록 */}
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                  {filteredTeamMembers.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredTeamMembers.map((member) => (
                        <button
                          key={member.email}
                          onClick={() => {
                            const isSelected = newRoomData.participant_emails.includes(member.email)
                            if (isSelected) {
                              setNewRoomData(prev => ({
                                ...prev,
                                participant_emails: prev.participant_emails.filter(email => email !== member.email)
                              }))
                            } else {
                              setNewRoomData(prev => ({
                                ...prev,
                                participant_emails: [...prev.participant_emails, member.email]
                              }))
                            }
                          }}
                          className={`p-2 text-left rounded-lg border transition-colors ${
                            newRoomData.participant_emails.includes(member.email)
                              ? 'bg-blue-50 border-blue-300 text-blue-900'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="text-sm font-medium">{member.name_ko}</div>
                          <div className="text-xs text-gray-500">{member.position}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      <p className="text-sm">
                        {selectedPositionTab === 'all' 
                          ? '팀원을 불러오는 중...' 
                          : '해당 직책의 팀원이 없습니다.'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowCreateRoom(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={createRoom}
                disabled={!newRoomData.room_name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 채팅방 설정 모달 */}
      {showRoomSettings && selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                채팅방 설정
              </h3>
              <button
                onClick={() => setShowRoomSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  채팅방 이름
                </label>
                <input
                  type="text"
                  value={selectedRoom.room_name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  채팅방 타입
                </label>
                <select
                  value={selectedRoom.room_type}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled
                >
                  <option value="general">일반</option>
                  <option value="department">부서</option>
                  <option value="project">프로젝트</option>
                  <option value="announcement">공지</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <textarea
                  value={selectedRoom.description || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  참여자 관리 ({roomParticipants.length}명)
                </label>
                
                {/* Position 탭 */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {positionTabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setSettingsPositionTab(tab.key)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        settingsPositionTab === tab.key
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                {/* 현재 참여자들 */}
                {roomParticipants.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-600 mb-1">현재 참여자:</div>
                    <div className="flex flex-wrap gap-1">
                      {roomParticipants.map((participant) => (
                        <span
                          key={participant.participant_email}
                          className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full"
                        >
                          {participant.participant_name}
                          {participant.is_admin && (
                            <span className="ml-1 text-blue-600">👑</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 팀원 선택 */}
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                  {filteredTeamMembers.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredTeamMembers.map((member) => {
                        const isParticipant = roomParticipants.some(p => p.participant_email === member.email)
                        return (
                          <button
                            key={member.email}
                            onClick={async () => {
                              if (selectedRoom) {
                                if (isParticipant) {
                                  await removeParticipant(selectedRoom.id, member.email)
                                } else {
                                  await addParticipant(selectedRoom.id, member.email)
                                }
                              }
                            }}
                            className={`p-2 text-left rounded-lg border transition-colors ${
                              isParticipant
                                ? 'bg-green-50 border-green-300 text-green-900'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="text-sm font-medium">{member.name_ko}</div>
                            <div className="text-xs text-gray-500">{member.position}</div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      <p className="text-sm">
                        {settingsPositionTab === 'all'
                          ? '팀원을 불러오는 중...'
                          : '해당 직책의 팀원이 없습니다.'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowRoomSettings(false)
                  setSettingsPositionTab('all')
                  setRoomParticipants([])
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 파일 업로드 모달 */}
      {showFileUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                파일 첨부
              </h3>
              <button
                onClick={() => setShowFileUpload(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="file-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleFileUpload(file)
                    }
                  }}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center space-y-2"
                >
                  <Paperclip size={48} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      파일을 선택하거나 여기에 드래그하세요
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      이미지, PDF, 문서 파일 (최대 10MB)
                    </p>
                  </div>
                </label>
              </div>

              <div className="text-xs text-gray-500">
                <p>지원 형식: JPG, PNG, GIF, WebP, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT</p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowFileUpload(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
