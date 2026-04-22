import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClientWithToken } from '@/lib/supabase'

// 사용자의 모든 채팅방에서 안읽은 메시지 수 조회
export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]

    // 서버에서는 전역 anon 클라이언트로 .from() 하면 RLS에 사용자가 안 잡혀 500이 난다 → JWT로 RLS 적용 클라이언트 사용
    const supabaseUser = createSupabaseClientWithToken(token)

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const userEmail = user.email!

    // 사용자가 참여한 채팅방 목록 조회
    const { data: userRooms, error: roomsError } = await supabaseUser
      .from('team_chat_participants')
      .select('room_id')
      .eq('participant_email', userEmail)

    if (roomsError) {
      console.error('채팅방 조회 오류:', roomsError)
      return NextResponse.json({ unreadCount: 0, roomCounts: {} })
    }

    if (!userRooms || userRooms.length === 0) {
      return NextResponse.json({ unreadCount: 0, roomCounts: {} })
    }

    const roomIds = userRooms.map(room => room.room_id)

    // 한 번의 쿼리로 모든 채팅방의 안읽은 메시지 수 계산 (성능 최적화)
    const { data: unreadData, error: unreadError } = await supabaseUser
      .from('team_chat_messages')
      .select(`
        room_id,
        id,
        sender_email
      `)
      .in('room_id', roomIds)
      .neq('sender_email', userEmail) // 자신이 보낸 메시지는 제외

    if (unreadError) {
      console.error('안읽은 메시지 조회 오류:', unreadError)
      return NextResponse.json({ unreadCount: 0, roomCounts: {} })
    }

    if (!unreadData || unreadData.length === 0) {
      return NextResponse.json({ unreadCount: 0, roomCounts: {} })
    }

    // 읽음 상태를 한 번에 조회
    const messageIds = unreadData.map(msg => msg.id)
    const { data: readStatuses, error: readError } = await supabaseUser
      .from('team_chat_read_status')
      .select('message_id')
      .in('message_id', messageIds)
      .eq('reader_email', userEmail)

    if (readError) {
      console.error('읽음 상태 조회 오류:', readError)
      return NextResponse.json({ unreadCount: 0, roomCounts: {} })
    }

    // 읽은 메시지 ID 목록
    const readMessageIds = new Set(readStatuses?.map(status => status.message_id) || [])
    
    // 채팅방별로 안읽은 메시지 수 계산
    const unreadCounts = roomIds.map(roomId => {
      const roomMessages = unreadData.filter(msg => msg.room_id === roomId)
      const unreadCount = roomMessages.filter(msg => !readMessageIds.has(msg.id)).length
      return { roomId, count: unreadCount }
    })

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
