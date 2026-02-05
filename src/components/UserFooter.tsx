'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, MessageCircle, AlertCircle, Bell, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

interface UserFooterProps {
  locale: string
}

export default function UserFooter({ locale }: UserFooterProps) {
  const pathname = usePathname()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  const t = useTranslations('common')
  const [showAnnouncements, setShowAnnouncements] = useState(false)
  const [showTeamChats, setShowTeamChats] = useState(false)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [teamChats, setTeamChats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    if (currentUserEmail && userRole && userRole !== 'customer') {
      loadAnnouncements()
      loadTeamChats()
    }
  }, [currentUserEmail, userRole])

  // 전달사항 로드
  const loadAnnouncements = async () => {
    if (!currentUserEmail || !userRole || userRole === 'customer') return

    try {
      setLoading(true)
      
      // 내 포지션 조회
      const { data: myTeamData } = await supabase
        .from('team')
        .select('position')
        .eq('email', currentUserEmail)
        .eq('is_active', true)
        .single()

      const myPosition = myTeamData?.position

      // 내가 확인한 공지 목록
      const { data: myAcks } = await supabase
        .from('team_announcement_acknowledgments')
        .select('announcement_id')
        .eq('ack_by', currentUserEmail)

      const ackedIds = myAcks?.map(r => r.announcement_id) || []

      // 내 이메일이 포함된 공지
      const { data: annsByEmail } = await supabase
        .from('team_announcements')
        .select('*')
        .contains('recipients', [currentUserEmail])
        .eq('is_archived', false)

      // 내 포지션이 포함된 공지
      let annsByPos: any[] = []
      if (myPosition) {
        const { data } = await supabase
          .from('team_announcements')
          .select('*')
          .contains('target_positions', [myPosition])
          .eq('is_archived', false)
        annsByPos = data || []
      }

      const targetedAnns = [...(annsByEmail || []), ...annsByPos]
        .filter(a => a && !ackedIds.includes(a.id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5) // 최근 5개만

      setAnnouncements(targetedAnns)
    } catch (error) {
      console.error('Error loading announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  // 팀채팅 로드
  const loadTeamChats = async () => {
    if (!currentUserEmail || !userRole || userRole === 'customer') return

    try {
      setLoading(true)
      
      // 사용자가 참여 중인 팀 채팅방만 조회
      const { data: chatRoomsData } = await supabase
        .from('team_chat_rooms')
        .select(`
          id, 
          room_name, 
          created_at, 
          updated_at,
          team_chat_participants!inner(participant_email)
        `)
        .eq('is_active', true)
        .eq('team_chat_participants.participant_email', currentUserEmail)
        .order('updated_at', { ascending: false })
        .limit(5)

      // 각 채팅방의 마지막 메시지 시간을 가져오기 위해 추가 쿼리
      if (chatRoomsData && chatRoomsData.length > 0) {
        const roomIds = chatRoomsData.map(room => room.id)
        
        const { data: lastMessages } = await supabase
          .from('team_chat_messages')
          .select('room_id, created_at')
          .in('room_id', roomIds)
          .order('created_at', { ascending: false })

        // 마지막 메시지 시간을 채팅방에 추가
        const chatRoomsWithLastMessage = chatRoomsData.map(room => {
          const lastMessage = lastMessages?.find(msg => msg.room_id === room.id)
          return {
            id: room.id,
            name: room.room_name,
            created_at: room.created_at,
            last_message_at: lastMessage?.created_at || room.updated_at
          }
        })

        setTeamChats(chatRoomsWithLastMessage)
      } else {
        setTeamChats([])
      }
    } catch (error) {
      console.error('Error loading team chats:', error)
    } finally {
      setLoading(false)
    }
  }

  // 전달사항 확인 처리
  const handleAnnouncementAck = async (announcementId: string) => {
    try {
      if (!currentUserEmail) return

      const { error } = await supabase
        .from('team_announcement_acknowledgments')
        .insert({
          announcement_id: announcementId,
          ack_by: currentUserEmail,
          ack_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error acknowledging announcement:', error)
        return
      }

      // 전달사항 다시 로드
      loadAnnouncements()
    } catch (error) {
      console.error('Error acknowledging announcement:', error)
    }
  }

  const footerItems = [
    {
      name: t('home'),
      href: `/${locale}`,
      icon: Home,
      showForAll: true
    },
    {
      name: t('products'),
      href: `/${locale}/products`,
      icon: Calendar,
      showForAll: true
    },
    {
      name: t('myReservations'),
      href: `/${locale}/dashboard/reservations`,
      icon: Calendar,
      showForAll: false,
      showForCustomer: true
    },
    {
      name: t('announcements'),
      href: '#',
      icon: AlertCircle,
      showForAll: false,
      onClick: () => setShowAnnouncements(true),
      badge: announcements.length > 0 ? announcements.length : null
    },
    {
      name: t('teamChat'),
      href: '#',
      icon: MessageCircle,
      showForAll: false,
      onClick: () => setShowTeamChats(true),
      badge: teamChats.length > 0 ? teamChats.length : null
    }
  ]

  const isActive = (href: string) => {
    return pathname === href
  }

  // 팀원이 아닌 경우 전달사항과 팀채팅 숨김
  const shouldShowTeamFeatures = userRole && userRole !== 'customer'
  
  // 고객인 경우 고객용 메뉴 표시
  const isCustomer = userRole === 'customer'

  return (
    <>
      {/* 푸터 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40" style={{ height: 'var(--footer-height)' }}>
        <div className="grid grid-cols-4 h-full">
          {footerItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            
            // 팀 기능은 팀원만, 고객 기능은 고객만 볼 수 있음
            if (!item.showForAll && !shouldShowTeamFeatures && !(item.showForCustomer && isCustomer)) {
              return null
            }
            
            return (
              <button
                key={item.name}
                onClick={item.onClick || (() => {})}
                className={`flex flex-col items-center justify-center space-y-1 px-2 py-2 transition-colors relative ${
                  active
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.href !== '#' && (
                  <Link href={item.href} className="absolute inset-0" />
                )}
                <div className="relative">
                  <Icon 
                    size={20} 
                    className={`${active ? 'text-blue-600' : 'text-gray-500'}`}
                  />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center text-[10px] font-bold text-white bg-red-600 rounded-full min-w-[16px] h-[16px] px-1">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-xs font-medium ${
                  active ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {item.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 전달사항 모달 */}
      {showAnnouncements && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">전달사항</h3>
              <button
                onClick={() => setShowAnnouncements(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 콘텐츠 */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">전달사항을 불러오는 중...</p>
                </div>
              ) : announcements.length > 0 ? (
                <div className="space-y-3">
                  {announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="border border-orange-200 rounded-lg p-3 bg-orange-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 mb-1">
                            {announcement.title}
                          </h4>
                          <p className="text-sm text-gray-600 mb-2">
                            {announcement.content}
                          </p>
                          <div className="flex items-center text-xs text-gray-500">
                            <span>작성자: {announcement.created_by}</span>
                            <span className="mx-2">•</span>
                            <span>{new Date(announcement.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAnnouncementAck(announcement.id)}
                          className="ml-2 px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 transition-colors"
                        >
                          확인
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">새로운 전달사항이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 팀채팅 모달 */}
      {showTeamChats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">팀 채팅</h3>
              <button
                onClick={() => setShowTeamChats(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 콘텐츠 */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">채팅방을 불러오는 중...</p>
                </div>
              ) : teamChats.length > 0 ? (
                <div className="space-y-2">
                  {teamChats.map((chat) => (
                    <Link
                      key={chat.id}
                      href={`/${locale}/admin/team-chat/${chat.id}`}
                      className="block border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowTeamChats(false)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {chat.name}
                          </h4>
                          <p className="text-sm text-gray-500">
                            마지막 메시지: {chat.last_message_at ? new Date(chat.last_message_at).toLocaleString() : '없음'}
                          </p>
                        </div>
                        <MessageCircle className="w-5 h-5 text-green-500" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">활성화된 팀 채팅방이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
