import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 메시지 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!roomId) {
      return NextResponse.json({ error: '채팅방 ID가 필요합니다' }, { status: 400 })
    }

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

    const { data: messages, error } = await supabase
      .from('team_chat_messages')
      .select(`
        *,
        reply_to_message:team_chat_messages!reply_to_id(
          id,
          message,
          sender_name
        ),
        team_chat_read_status(
          reader_email,
          read_at
        )
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('메시지 조회 오류:', error)
      return NextResponse.json({ error: '메시지를 불러올 수 없습니다' }, { status: 500 })
    }

    return NextResponse.json({ messages: messages || [] })
  } catch (error) {
    console.error('메시지 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 새 메시지 전송
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      room_id, 
      message, 
      message_type = 'text',
      reply_to_id,
      file_url,
      file_name,
      file_size,
      file_type
    } = body

    // 필수 필드 검증
    if (!room_id || !message) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

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

    // 팀 정보 조회
    const { data: teamData, error: teamError } = await supabase
      .from('team')
      .select('name_ko, position')
      .eq('email', user.email!)
      .eq('is_active', true)
      .single()

    if (teamError || !teamData) {
      return NextResponse.json({ error: '팀 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const team = teamData as { name_ko: string; position: string }

    // 메시지 생성
    const { data: newMessage, error } = await (supabase as unknown as { 
      from: (table: string) => { 
        insert: (data: Record<string, unknown>) => { 
          select: (query: string) => { 
            single: () => Promise<{ data: unknown; error: unknown }> 
          } 
        } 
      } 
    })
      .from('team_chat_messages')
      .insert({
        room_id,
        sender_email: user.email!,
        sender_name: team.name_ko || user.email!.split('@')[0],
        sender_position: team.position,
        message,
        message_type,
        reply_to_id: reply_to_id || null,
        file_url: file_url || null,
        file_name: file_name || null,
        file_size: file_size || null,
        file_type: file_type || null
      })
      .select(`
        *,
        reply_to_message:team_chat_messages!reply_to_id(
          id,
          message,
          sender_name
        )
      `)
      .single()

    if (error) {
      console.error('메시지 전송 오류:', error)
      console.error('메시지 데이터:', {
        room_id,
        sender_email: user.email,
        sender_name: team.name_ko || user.email!.split('@')[0],
        sender_position: team.position,
        message,
        message_type,
        reply_to_id: reply_to_id || null,
        file_url: file_url || null,
        file_name: file_name || null,
        file_size: file_size || null,
        file_type: file_type || null
      })
      return NextResponse.json({ 
        error: '메시지를 전송할 수 없습니다', 
        details: (error as { message?: string }).message || '알 수 없는 오류'
      }, { status: 500 })
    }

    // 채팅방 업데이트 시간 갱신
    await (supabase as unknown as { 
      from: (table: string) => { 
        update: (data: Record<string, unknown>) => { 
          eq: (column: string, value: unknown) => Promise<unknown> 
        } 
      } 
    })
      .from('team_chat_rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', room_id)

    return NextResponse.json({ message: newMessage })
  } catch (error) {
    console.error('메시지 전송 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 메시지 삭제
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { message_id } = body

    if (!message_id) {
      return NextResponse.json({ error: '메시지 ID가 필요합니다' }, { status: 400 })
    }

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

    // 메시지 소유자 확인
    const { data: message, error: messageError } = await supabase
      .from('team_chat_messages')
      .select('sender_email, created_at')
      .eq('id', message_id)
      .single()

    if (messageError || !message) {
      return NextResponse.json({ error: '메시지를 찾을 수 없습니다' }, { status: 404 })
    }

    const messageData = message as { sender_email: string; created_at: string }

    if (messageData.sender_email !== user.email) {
      return NextResponse.json({ error: '본인의 메시지만 삭제할 수 있습니다' }, { status: 403 })
    }

    // 5분 이내인지 확인
    const messageTime = new Date(messageData.created_at)
    const now = new Date()
    const diffMinutes = (now.getTime() - messageTime.getTime()) / (1000 * 60)
    
    if (diffMinutes > 5) {
      return NextResponse.json({ error: '메시지는 전송 후 5분 이내에만 삭제할 수 있습니다' }, { status: 400 })
    }

    // 메시지 삭제
    const { error: deleteError } = await supabase
      .from('team_chat_messages')
      .delete()
      .eq('id', message_id)

    if (deleteError) {
      console.error('메시지 삭제 오류:', deleteError)
      return NextResponse.json({ error: '메시지를 삭제할 수 없습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('메시지 삭제 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
