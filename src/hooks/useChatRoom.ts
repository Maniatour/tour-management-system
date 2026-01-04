import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChatRoom } from '@/types/chat'

interface UseChatRoomProps {
  tourId?: string | undefined
  isPublicView: boolean
  roomCode?: string | undefined
}

export function useChatRoom({ tourId, isPublicView, roomCode }: UseChatRoomProps) {
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [loading, setLoading] = useState(true)
  const roomRef = useRef<ChatRoom | null>(null)
  
  // room을 ref에 저장
  useEffect(() => {
    roomRef.current = room
  }, [room])

  const loadRoom = useCallback(async () => {
    if (!tourId) {
      setLoading(false)
      return
    }
    
    try {
      const { data: existingRooms, error: findError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('tour_id', tourId)
        .eq('is_active', true)
        .limit(1)

      if (findError) throw findError

      const existingRoom = existingRooms?.[0] as ChatRoom | undefined

      if (existingRoom) {
        // 같은 room이면 setRoom을 호출하지 않음 (무한 루프 방지)
        if (roomRef.current?.id !== existingRoom.id) {
          setRoom(existingRoom)
        }
      } else {
        setRoom(null)
      }
    } catch (error) {
      console.error('Error loading room:', error)
    } finally {
      setLoading(false)
    }
  }, [tourId])

  const loadRoomByCode = useCallback(async (code: string) => {
    if (!code) {
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      const { data: rooms, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('room_code', code)
        .eq('is_active', true)
        .limit(1)

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      const foundRoom = rooms?.[0] as ChatRoom | undefined
      
      // 같은 room이면 setRoom을 호출하지 않음 (무한 루프 방지)
      if (foundRoom && roomRef.current?.id !== foundRoom.id) {
        setRoom(foundRoom)
      } else if (!foundRoom && roomRef.current !== null) {
        setRoom(null)
      }
    } catch (error) {
      console.error('Error loading room by code:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // loadRoom과 loadRoomByCode를 ref로 저장하여 의존성 배열에서 제거
  const loadRoomRef = useRef(loadRoom)
  const loadRoomByCodeRef = useRef(loadRoomByCode)
  
  useEffect(() => {
    loadRoomRef.current = loadRoom
  }, [loadRoom])
  
  useEffect(() => {
    loadRoomByCodeRef.current = loadRoomByCode
  }, [loadRoomByCode])
  
  // 초기화 플래그를 ref로 관리하여 무한 루핑 방지
  const initializationRef = useRef<{ 
    key?: string;
    initialized?: boolean 
  }>({})
  
  // 채팅방 로드 또는 생성
  useEffect(() => {
    let isMounted = true
    
    // 이미 같은 파라미터로 초기화되었는지 확인
    const currentKey = `${tourId || ''}_${isPublicView}_${roomCode || ''}`
    
    if (initializationRef.current.key === currentKey && initializationRef.current.initialized) {
      return
    }
    
    // 초기화 플래그 업데이트
    initializationRef.current = { 
      key: currentKey,
      initialized: false 
    }
    
    const initializeChat = async () => {
      if (!isMounted) return
      
      try {
        if (isPublicView && roomCode) {
          await loadRoomByCodeRef.current(roomCode)
        } else if (!isPublicView && tourId) {
          await loadRoomRef.current()
        } else if (isPublicView && !roomCode) {
          if (isMounted) {
            setLoading(false)
          }
        }
        
        // 초기화 완료 표시
        if (isMounted) {
          initializationRef.current.initialized = true
        }
      } catch (error) {
        console.error('Error initializing chat:', error)
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initializeChat()
    
    return () => {
      isMounted = false
    }
  }, [tourId, isPublicView, roomCode])

  return {
    room,
    setRoom,
    loading,
    setLoading,
    roomRef,
    loadRoom,
    loadRoomByCode
  }
}

