import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 사용자의 모든 채팅방에서 안읽은 메시지 수 조회
export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const userEmail = user.email!

    // 사용자가 참여한 채팅방 목록 조회
    const { data: userRooms, error: roomsError } = await supabase
      .from('team_chat_participants')
      .select('room_id')
      .eq('participant_email', userEmail)

    if (roomsError) {
      console.error('채팅방 조회 오류:', roomsError)
      return NextResponse.json({ error: '채팅방을 조회할 수 없습니다' }, { status: 500 })
    }

    if (!userRooms || userRooms.length === 0) {
      return NextResponse.json({ unreadCount: 0, roomCounts: {} })
    }

    const roomIds = userRooms.map(room => room.room_id)

    // 각 채팅방에서 안읽은 메시지 수 계산
    const unreadCounts = await Promise.all(
      roomIds.map(async (roomId) => {
        try {
          // 해당 채팅방의 모든 메시지 조회 (자신이 보낸 메시지 제외)
          const { data: allMessages, error: messagesError } = await supabase
            .from('team_chat_messages')
            .select('id, sender_email')
            .eq('room_id', roomId)
            .neq('sender_email', userEmail) // 자신이 보낸 메시지는 제외

          if (messagesError) {
            console.error(`채팅방 ${roomId} 메시지 조회 오류:`, messagesError)
            return { roomId, count: 0 }
          }

          if (!allMessages || allMessages.length === 0) {
            return { roomId, count: 0 }
          }

          // 각 메시지에 대해 읽음 상태 확인
          const messageIds = allMessages.map(msg => msg.id)
          
          const { data: readStatuses, error: readError } = await supabase
            .from('team_chat_read_status')
            .select('message_id')
            .in('message_id', messageIds)
            .eq('reader_email', userEmail)

          if (readError) {
            console.error(`채팅방 ${roomId} 읽음 상태 조회 오류:`, readError)
            return { roomId, count: 0 }
          }

          // 읽은 메시지 ID 목록
          const readMessageIds = new Set(readStatuses?.map(status => status.message_id) || [])
          
          // 읽지 않은 메시지 수 계산
          const unreadCount = allMessages.filter(msg => !readMessageIds.has(msg.id)).length

          return { roomId, count: unreadCount }
        } catch (error) {
          console.error(`채팅방 ${roomId} 안읽은 메시지 계산 오류:`, error)
          return { roomId, count: 0 }
        }
      })
    )

    // 전체 안읽은 메시지 수와 채팅방별 안읽은 메시지 수 계산
    const totalUnreadCount = unreadCounts.reduce((sum, room) => sum + room.count, 0)
    const roomCounts = unreadCounts.reduce((acc, room) => {
      acc[room.roomId] = room.count
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      unreadCount: totalUnreadCount,
      roomCounts
    })
  } catch (error) {
    console.error('안읽은 메시지 수 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
