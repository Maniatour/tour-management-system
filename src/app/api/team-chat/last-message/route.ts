import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 채팅방의 마지막 메시지 조회
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

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')

    if (!roomId) {
      return NextResponse.json({ error: '채팅방 ID가 필요합니다' }, { status: 400 })
    }

    const { data: lastMessage, error } = await supabase
      .from('team_chat_messages')
      .select('id, message, sender_name, sender_position, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116은 데이터가 없을 때 발생
      console.error('마지막 메시지 조회 오류:', error)
      return NextResponse.json({ 
        error: '마지막 메시지를 불러올 수 없습니다', 
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ lastMessage: lastMessage || null })
  } catch (error) {
    console.error('마지막 메시지 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
