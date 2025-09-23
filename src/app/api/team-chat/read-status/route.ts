import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 읽음 상태 업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message_ids, reader_email } = body

    if (!message_ids || !Array.isArray(message_ids) || !reader_email) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

    // 읽음 상태 데이터 준비
    const readStatusData = message_ids.map((messageId: string) => ({
      message_id: messageId,
      reader_email
    }))

    const { error } = await supabase
      .from('team_chat_read_status')
      .upsert(readStatusData, { 
        onConflict: 'message_id,reader_email',
        ignoreDuplicates: true 
      })

    if (error) {
      console.error('읽음 상태 업데이트 오류:', error)
      return NextResponse.json({ error: '읽음 상태를 업데이트할 수 없습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('읽음 상태 업데이트 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 읽음 상태 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('message_id')
    const roomId = searchParams.get('room_id')
    const readerEmail = searchParams.get('reader_email')

    if (!readerEmail) {
      return NextResponse.json({ error: '사용자 이메일이 필요합니다' }, { status: 400 })
    }

    let query = supabase
      .from('team_chat_read_status')
      .select(`
        *,
        team_chat_messages!inner(
          id,
          room_id,
          message,
          sender_name,
          created_at
        )
      `)
      .eq('reader_email', readerEmail)

    if (messageId) {
      query = query.eq('message_id', messageId)
    }

    if (roomId) {
      query = query.eq('team_chat_messages.room_id', roomId)
    }

    const { data: readStatus, error } = await query

    if (error) {
      console.error('읽음 상태 조회 오류:', error)
      return NextResponse.json({ error: '읽음 상태를 조회할 수 없습니다' }, { status: 500 })
    }

    return NextResponse.json({ readStatus: readStatus || [] })
  } catch (error) {
    console.error('읽음 상태 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
