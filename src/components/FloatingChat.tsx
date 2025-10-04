'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Minimize2, Maximize2, Palette } from 'lucide-react'
import TourChatRoom from './TourChatRoom'
import { useFloatingChat } from '@/contexts/FloatingChatContext'
import { supabase } from '@/lib/supabase'

// 색상 옵션
const COLOR_OPTIONS = [
  { name: '파랑', class: 'from-blue-600 to-blue-700' },
  { name: '초록', class: 'from-green-600 to-green-700' },
  { name: '빨강', class: 'from-red-600 to-red-700' },
  { name: '노랑', class: 'from-yellow-600 to-yellow-700' },
  { name: '보라', class: 'from-purple-600 to-purple-700' },
  { name: '핑크', class: 'from-pink-600 to-pink-700' },
  { name: '인디고', class: 'from-indigo-600 to-indigo-700' },
  { name: '회색', class: 'from-gray-600 to-gray-700' }
]

interface FloatingChatProps {
  chatInfo: {
    id: string
    tourId: string
    tourDate: string
    guideEmail: string
    tourName?: string
  }
  onClose: (chatId: string) => void
  index?: number // 순서 (여러 창일 때 위치 조정용)
}

export default function FloatingChat({ chatInfo, onClose, index = 0 }: FloatingChatProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false )
  const [isResizing, setIsResizing] = useState(false)
  
  // 드래그 오프셋 저장용 ref
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  
  // 마지막 업데이트 시간 저장
  const lastUpdateRef = useRef(0)
  const UPDATE_THROTTLE = 16 // 60fps 유지를 위한 16ms 간격
  
  // localStorage에서 크기와 위치 정보 로드 (개별 창마다)
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 }
    const saved = localStorage.getItem(`floatingChat.position.${chatInfo.id}`)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // 기본 위치에서 index만큼 오프셋 적용
        const baseX = window.innerWidth - 420
        const baseY = window.innerHeight - 600
        return { 
          x: Math.max(0, baseX - (index * 440)), 
          y: Math.max(0, baseY - (index * 20))
        }
      }
    }
    // 기본 위치에서 index만큼 오프셋 적용
    const baseX = window.innerWidth - 420
    const baseY = window.innerHeight - 600
    return { 
      x: Math.max(0, baseX - (index * 440)), 
      y: Math.max(0, baseY - (index * 20))
    }
  })
  
  const [size, setSize] = useState(() => {
    if (typeof window !== 'undefined') return { width: 400, height: 500 }
    const saved = localStorage.getItem(`floatingChat.size.${chatInfo.id}`)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return { width: 400, height: 500 }
      }
    }
    return { width: 400, height: 500 }
  })

  // 투어 정보 상태
  const [tourInfo, setTourInfo] = useState<{
    tour_date: string
    product_name: string
    tour_status: string
    assigned_people: number
  } | null>(null)

  // 안읽은 메시지 수 상태
  const [unreadCount, setUnreadCount] = useState(0)

  // 헤더 색상 상태
  const [headerColor, setHeaderColor] = useState(() => {
    if (typeof window === 'undefined') return 'from-blue-600 to-blue-700'
    const saved = localStorage.getItem(`floatingChat.color.${chatInfo.id}`)
    return saved || 'from-blue-600 to-blue-700'
  })

  // 색상 선택 드롭다운 열림 상태
  const [showColorPicker, setShowColorPicker] = useState(false)

  // 외부 클릭 감지로 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showColorPicker) {
        setShowColorPicker(false)
      }
    }

    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColorPicker])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('[data-drag-handle]')) {
      // 드래그 시작 시점의 오프셋 계산
      const rect = e.currentTarget.getBoundingClientRect()
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
      setIsDragging(true)
      e.preventDefault()
    }
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
    e.stopPropagation()
  }

  const handleEdgeResizeStart = (e: React.MouseEvent, direction: 'right' | 'bottom' | 'corner') => {
    setIsResizing(true)
    e.preventDefault()
    e.stopPropagation()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (typeof window === 'undefined') return
    
    const now = performance.now()
    if (now - lastUpdateRef.current < UPDATE_THROTTLE) return
    lastUpdateRef.current = now

    if (isDragging) {
      // 정확한 오프셋을 사용하여 위치 계산 (화면 아래로도 이동 가능하도록 제한 완화)
      const newX = Math.max(-size.width + 50, Math.min(window.innerWidth - 50, e.clientX - dragOffsetRef.current.x))
      const newY = Math.max(-40, Math.min(window.innerHeight - 20, e.clientY - dragOffsetRef.current.y))

      setPosition({ x: newX, y: newY })
    }

    if (isResizing) {
      const newWidth = Math.max(300, Math.min(window.innerWidth - position.x, e.clientX - position.x))
      const newHeight = Math.max(300, Math.min(window.innerHeight - position.y, e.clientY - position.y))

      setSize({ width: newWidth, height: newHeight })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing])

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - size.width),
        y: Math.min(prev.y, window.innerHeight - size.height),
      }))
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [size.width, size.height])

  // 위치와 크기 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`floatingChat.position.${chatInfo.id}`, JSON.stringify(position))
    }
  }, [position, chatInfo.id])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`floatingChat.size.${chatInfo.id}`, JSON.stringify(size))
    }
  }, [size, chatInfo.id])

  // 헤더 색상 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`floatingChat.color.${chatInfo.id}`, headerColor)
    }
  }, [headerColor, chatInfo.id])

  // 투어 정보 가져오기
  useEffect(() => {
    if (!chatInfo?.tourId) return

    const fetchTourInfo = async () => {
      try {
        const { data: tourData, error: tourError } = await supabase
          .from('tours')
          .select(`
            tour_date,
            tour_status,
            product_id,
            reservation_ids,
            product:products!inner(
              name_ko,
              name_en,
              internal_name_ko
            )
          `)
          .eq('id', chatInfo.tourId)
          .single()

        if (tourError) {
          console.error('Error fetching tour info:', tourError)
          return
        }

        // 투어에 배정된 예약 정보로 배정 인원 calcular (정확한 필터링)
        let assignedPeople = 0
        
        if (tourData.reservation_ids && tourData.reservation_ids.length > 0) {
          const { data: reservationsData, error: reservationsError } = await supabase
            .from('reservations')
            .select('adults, child, infant')
            .in('id', tourData.reservation_ids)
          
          if (reservationsError) {
            console.error('Error fetching reservations:', reservationsError)
          } else if (reservationsData) {
            assignedPeople = reservationsData.reduce((total, reservation) => {
              return total + 
                (reservation.adults || 0) + 
                (reservation.child || 0) + 
                (reservation.infant || 0)
            }, 0)
          }
        }


        const product = tourData.product as any
        const finalTourDate = chatInfo.tourDate || tourData.tour_date
        setTourInfo({
          tour_date: chatInfo.tourDate || tourData.tour_date, // 전달된 tourDate 우선 사용
          product_name: product?.internal_name_ko || product?.name_ko || product?.name_en || '상품명 없음',
          tour_status: tourData.tour_status,
          assigned_people: assignedPeople
        })
      } catch (error) {
        console.error('Error fetching tour info:', error)
      }
    }

    fetchTourInfo()
  }, [chatInfo?.tourId])

  // 안읽은 메시지 수 가져오기
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        // 먼저 투어 ID로 채팅방을 찾기
        const { data: chatRoom, error: roomError } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('tour_id', chatInfo.tourId)
          .single()

        if (roomError || !chatRoom) {
          console.log('No chat room found for tour:', chatInfo.tourId)
          setUnreadCount(0)
          return
        }

        // 채팅방 UUID로 안읽은 메시지 수 조회
        const { data, error } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('room_id', chatRoom.id)
          .eq('is_read', false)
          .neq('sender_type', 'admin')

        if (error) {
          console.error('Error fetching unread count:', error)
          return
        }

        setUnreadCount(data?.length || 0)
      } catch (error) {
        console.error('Error fetching unread count:', error)
      }
    }

    fetchUnreadCount()

    // 실시간 구독으로 새 메시지 감지 (chat_rooms 테이블 기준)
    const subscription = supabase
      .channel('unread-messages')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chat_messages'
        }, 
        () => {
          // 새 메시지가 올 때 카운트 새로고침
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [chatInfo.tourId])

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  // 상태 표시 함수
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Recruiting':
        return '모집중'
      case 'Confirmed':
        return '확정'
      case 'Completed':
        return '완료'
      case 'Cancelled':
        return '취소'
      default:
        return status
    }
  }

  // 상태 스타일 함수
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Recruiting':
        return 'bg-yellow-100 text-yellow-800'
      case 'Confirmed':
        return 'bg-green-100 text-green-800'
      case 'Completed':
        return 'bg-blue-100 text-blue-800'
      case 'Cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isMinimized) {
    return (
      <div
        className="fixed z-50 bg-transparent shadow-2xl"
        style={{
          width: `${size.width}px`,
          height: '50px',
          left: `${position.x}px`,
          top: `${position.y}px`,
          minWidth: '300px',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 헤더만 표시 */}
        <div
          data-drag-handle
          className={`bg-gradient-to-r ${headerColor} text-white rounded-lg cursor-grab select-none ${isDragging ? 'cursor-grabbing' : ''}`}
          style={{ height: '50px' }}
        >
          {/* 컴팩트 헤더 */}
          <div className="flex items-center justify-between p-2 px-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* 안읽은 메시지 표시 */}
              {unreadCount > 0 && (
                <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium flex-shrink-0">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
              
              {tourInfo ? (
                <span className="text-xs font-medium whitespace-nowrap overflow-hidden truncate">
                  {(() => {
                    // YYYY-MM-DD 형식을 안전하게 파싱
                    const [year, month, day] = tourInfo.tour_date.split('-').map(Number)
                    const date = new Date(year, month - 1, day) // month는 0부터 시작
                    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`

                    const productName = tourInfo.product_name.length > 15 ? `${tourInfo.product_name.slice(0, 15)}...` : tourInfo.product_name
                    
                    return (
                      <>
                        {formattedDate} [{productName}] 👥{tourInfo.assigned_people} [{getStatusLabel(tourInfo.tour_status)}]
                      </>
                    )
                  })()}
                </span>
              ) : (
                <span className="text-xs font-medium">
                  투어 채팅방
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={toggleMinimize}
                className="p-1 hover:bg-black/20 rounded transition-colors"
                title="최대화"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => onClose(chatInfo.id)}
                className="p-1 hover:bg-black/20 rounded transition-colors"
                title="닫기"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
  <div
      className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200"
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxWidth: '90vw',
        maxHeight: '90vh',
        minWidth: '300px',
        minHeight: '300px',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* 헤더 - 드래그 가능 */}
      <div
        data-drag-handle
        className={`bg-gradient-to-r ${headerColor} text-white rounded-t-lg cursor-grab select-none ${isDragging ? 'cursor-grabbing' : ''}`}
      >
        {/* 컴팩트 헤더 */}
        <div className="flex items-center justify-between p-2 px-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* 안읽은 메시지 표시 */}
            {unreadCount > 0 && (
              <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium flex-shrink-0">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
            
            {tourInfo ? (
              <span className="text-xs font-medium whitespace-nowrap overflow-hidden truncate">
                {(() => {
                  // YYYY-MM-DD 형식을 안전하게 파싱
                  const [year, month, day] = tourInfo.tour_date.split('-').map(Number)
                  const date = new Date(year, month - 1, day) // month는 0부터 시작
                  const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`
                  const productName = tourInfo.product_name.length > 15 ? `${tourInfo.product_name.slice(0, 15)}...` : tourInfo.product_name
                  
                  return (
                    <>
                      {formattedDate} [{productName}] 👥{tourInfo.assigned_people} [{getStatusLabel(tourInfo.tour_status)}]
                    </>
                  )
                })()}
              </span>
            ) : (
              <span className="text-xs font-medium">
                투어 채팅방
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isMinimized && (
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="p-1 hover:bg-black/20 rounded transition-colors"
                  title="색상 변경"
                >
                  <Palette className="h-3 w-3" />
                </button>
                
                {/* 색상 선택 드롭다운 */}
                {showColorPicker && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 grid grid-cols-4 gap-1 min-w-[160px]">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => {
                          setHeaderColor(color.class)
                          setShowColorPicker(false)
                        }}
                        className={`p-2 rounded text-xs hover:bg-gray-100 transition-colors ${color.class.includes('blue') ? 'text-blue-600' : 
                          color.class.includes('green') ? 'text-green-600' : 
                          color.class.includes('red') ? 'text-red-600' : 
                          color.class.includes('yellow') ? 'text-yellow-600' : 
                          color.class.includes('purple') ? 'text-purple-600' : 
                          color.class.includes('pink') ? 'text-pink-600' : 
                          color.class.includes('indigo') ? 'text-indigo-600' : 'text-gray-600'}`}
                      >
                        <div className={`w-4 h-4 rounded ${headerColor === color.class ? 'ring-2 ring-white' : ''} bg-gradient-to-r ${color.class}`}></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={toggleMinimize}
              className="p-1 hover:bg-black/20 rounded transition-colors"
              title={isMinimized ? '최대화' : '최소화'}
            >
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </button>
            <button
              onClick={() => onClose(chatInfo.id)}
              className="p-1 hover:bg-black/20 rounded transition-colors"
              title="닫기"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 채팅 내용 */}
      {!isMinimized && (
        <div className="relative overflow-hidden h-[calc(100%-50px)]">
          <TourChatRoom
            tourId={chatInfo.tourId}
            guideEmail={chatInfo.guideEmail}
            tourDate={chatInfo.tourDate}
            isModalView={true}
          />
          
          {/* 리사이즈 핸들들 */}
          {/* 우측 가장자리 */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-e-resize opacity-0 hover:opacity-100 transition-opacity hover:bg-gray-400"
            onMouseDown={(e) => handleEdgeResizeStart(e, 'right')}
          />
          
          {/* 아래 가장자리 */}
          <div
            className="absolute bottom-0 left-0 w-full h-1 cursor-s-resize opacity-0 hover:opacity-100 transition-opacity hover:bg-gray-400"
            onMouseDown={(e) => handleEdgeResizeStart(e, 'bottom')}
          />
          
          {/* 우하단 모서리 */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleEdgeResizeStart(e, 'corner')}
            style={{
              background: 'linear-gradient(135deg, transparent 0px, transparent 2px, #9CA3AF 2px, #9CA3AF 4px, transparent 4px), linear-gradient(-45deg, transparent 0px, transparent 2px, #9CA3AF 2px, #9CA3AF 4px, transparent 4px)',
              backgroundColor: 'transparent'
            }}
          />
        </div>
      )}
    </div>
  )
}
